// Recent-work media pipeline.
//
// Mirrors the bio queue, but for Instagram posts. Media comes from Business
// Discovery's free media edge (Business/Creator accounts only), so only artists
// whose bio was successfully fetched (fetchStatus = "fetched") are eligible.
//
// Queue state lives on the Artist (mediaLastFetchedAt / mediaClaimedAt), so the
// browser-driven loop can stop and resume at any time. Instagram CDN image URLs
// expire after a few hours, so media is refreshed once it goes stale.

import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"
import {
  BusinessDiscoveryConfigError,
  fetchArtistMedia,
  isBusinessDiscoveryConfigured,
  RateLimitError,
} from "@/lib/instagram"

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Posts fetched per artist. */
const MEDIA_LIMIT = 12
/** Refresh an artist's media once it's older than this (URLs expire). */
const MEDIA_STALE_MS = 6 * 60 * 60_000
/** A claim older than this is assumed abandoned (request timed out mid-fetch). */
const CLAIM_TTL_MS = 2 * 60_000
/** Cap on how many posts the feed returns — a tight, recent board. */
const FEED_LIMIT = 30

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MediaFetchOutcome = "fetched" | "unavailable" | "failed" | "skipped"

export interface MediaPost {
  id: string
  imageUrl: string
  permalink: string
  caption: string | null
  mediaType: string
  takenAt: string
  artist: {
    id: string
    instagramHandle: string
    displayName: string | null
    profilePicUrl: string | null
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Media is only available via the free Business Discovery media edge. */
export function isMediaLookupConfigured(): boolean {
  return isBusinessDiscoveryConfigured()
}

function staleMediaWhere(now: Date): Prisma.ArtistWhereInput {
  return {
    fetchStatus: "fetched",
    OR: [
      { mediaLastFetchedAt: null },
      { mediaLastFetchedAt: { lt: new Date(now.getTime() - MEDIA_STALE_MS) } },
    ],
  }
}

function unclaimedWhere(now: Date): Prisma.ArtistWhereInput {
  return {
    OR: [
      { mediaClaimedAt: null },
      { mediaClaimedAt: { lt: new Date(now.getTime() - CLAIM_TTL_MS) } },
    ],
  }
}

// ---------------------------------------------------------------------------
// Queue
// ---------------------------------------------------------------------------

/** Number of the user's artists whose media is missing or stale. */
export function countArtistsNeedingMedia(userId: string): Promise<number> {
  return prisma.artist.count({
    where: { ...staleMediaWhere(new Date()), users: { some: { userId } } },
  })
}

/**
 * Fetches and caches recent posts for the user's next artist whose media is
 * missing or stale.
 *
 * External calls are intentionally NOT wrapped in the final Prisma transaction.
 *
 * @throws {RateLimitError} Instagram is throttling — the artist stays unclaimed
 * @throws {BusinessDiscoveryConfigError} token missing/expired — stays unclaimed
 */
export async function processNextArtistMedia(userId: string): Promise<{
  handle: string | null
  outcome: MediaFetchOutcome | null
  usagePercent: number
}> {
  const now = new Date()
  const next = await prisma.artist.findFirst({
    where: {
      ...staleMediaWhere(now),
      ...unclaimedWhere(now),
      users: { some: { userId } },
    },
    orderBy: [{ mediaLastFetchedAt: { sort: "asc", nulls: "first" } }, { createdAt: "asc" }],
    select: { id: true, instagramHandle: true },
  })
  if (!next) return { handle: null, outcome: null, usagePercent: 0 }

  // Claim it so concurrent tabs don't fetch the same artist
  const { count: claimed } = await prisma.artist.updateMany({
    where: { id: next.id, ...unclaimedWhere(now) },
    data: { mediaClaimedAt: now },
  })
  if (claimed === 0) return { handle: null, outcome: "skipped", usagePercent: 0 }

  try {
    const { media, usagePercent } = await fetchArtistMedia(next.instagramHandle, MEDIA_LIMIT)

    if (!media) {
      // Account isn't reachable via BD anymore — back off until stale again
      await prisma.artist.update({
        where: { id: next.id },
        data: { mediaLastFetchedAt: now, mediaClaimedAt: null },
      })
      return { handle: next.instagramHandle, outcome: "unavailable", usagePercent }
    }

    const keepIds = media.map((m) => m.id)
    await prisma.$transaction([
      // Drop posts that are no longer in the artist's recent feed
      prisma.artistMedia.deleteMany({
        where: { artistId: next.id, igMediaId: { notIn: keepIds.length > 0 ? keepIds : [""] } },
      }),
      ...media.map((m) =>
        prisma.artistMedia.upsert({
          where: { artistId_igMediaId: { artistId: next.id, igMediaId: m.id } },
          create: {
            artistId: next.id,
            igMediaId: m.id,
            mediaType: m.mediaType,
            imageUrl: m.imageUrl,
            permalink: m.permalink,
            caption: m.caption,
            takenAt: new Date(m.timestamp),
          },
          update: {
            mediaType: m.mediaType,
            imageUrl: m.imageUrl,
            permalink: m.permalink,
            caption: m.caption,
            takenAt: new Date(m.timestamp),
            fetchedAt: now,
          },
        })
      ),
      prisma.artist.update({
        where: { id: next.id },
        data: { mediaLastFetchedAt: now, mediaClaimedAt: null },
      }),
    ])

    return { handle: next.instagramHandle, outcome: "fetched", usagePercent }
  } catch (err) {
    if (err instanceof RateLimitError || err instanceof BusinessDiscoveryConfigError) {
      // Not the artist's fault — release the claim without marking it fetched
      await prisma.artist.update({
        where: { id: next.id },
        data: { mediaClaimedAt: null },
      })
      throw err
    }

    // Transient/unexpected error: back off until stale again so we don't loop
    await prisma.artist.update({
      where: { id: next.id },
      data: { mediaLastFetchedAt: now, mediaClaimedAt: null },
    })
    console.error(`Media fetch for @${next.instagramHandle} failed:`, err)
    return { handle: next.instagramHandle, outcome: "failed", usagePercent: 0 }
  }
}

// ---------------------------------------------------------------------------
// Feed
// ---------------------------------------------------------------------------

/** Recent posts across all of the user's artists, newest first. */
export async function getUserMediaFeed(userId: string): Promise<MediaPost[]> {
  const rows = await prisma.artistMedia.findMany({
    where: { artist: { users: { some: { userId } } } },
    orderBy: { takenAt: "desc" },
    take: FEED_LIMIT,
    include: {
      artist: {
        select: {
          id: true,
          instagramHandle: true,
          displayName: true,
          profilePicUrl: true,
        },
      },
    },
  })

  return rows.map((row) => ({
    id: row.id,
    imageUrl: row.imageUrl,
    permalink: row.permalink,
    caption: row.caption,
    mediaType: row.mediaType,
    takenAt: row.takenAt.toISOString(),
    artist: {
      id: row.artist.id,
      instagramHandle: row.artist.instagramHandle,
      displayName: row.artist.displayName,
      profilePicUrl: row.artist.profilePicUrl,
    },
  }))
}
