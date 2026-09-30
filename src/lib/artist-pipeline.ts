// Artist pipeline.
//
// Adding artists and fetching their bios are separate steps:
//   1. trackArtists() saves stub Artist rows + UserArtist links immediately — no
//      external calls, so a selection is never lost to a rate limit.
//   2. fetchArtistBio() fills a stub in later: Business Discovery (free) → paid
//      provider if BD has no profile → Claude bio parse → Mapbox geocode. Queue state (fetchStatus) lives on the Artist, so
//      the browser-driven loop can stop and resume at any time.

import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"
import {
  BusinessDiscoveryConfigError,
  fetchArtistProfile,
  isBusinessDiscoveryConfigured,
  isValidHandle,
  normalizeHandle,
  RateLimitError,
  type InstagramProfile,
} from "@/lib/instagram"
import {
  fetchProviderProfile,
  isProviderConfigured,
  ProviderConfigError,
} from "@/lib/instagram-provider"
import { parseBioLocations } from "@/lib/bio-parser"
import { BudgetExceededError, reserveUsage } from "@/lib/usage"
import { geocodeLocation } from "@/lib/geocoding"
import { serializeArtist, type SerializedArtist } from "@/lib/artist-dto"

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const MAX_TRACK_BATCH = 2000
const MAX_FETCH_ATTEMPTS = 3
/** A claim older than this is assumed abandoned (request timed out mid-fetch). */
const CLAIM_TTL_MS = 3 * 60_000

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Optional metadata already known from the following list or search results. */
export interface ArtistHint {
  username: string
  fullName?: string | null
  profilePicUrl?: string | null
}

export interface TrackResult {
  added: number
  alreadyTracked: number
  invalid: string[]
}

export type FetchOutcome = "fetched" | "unavailable" | "retry" | "failed" | "skipped"

export interface FetchBioResult {
  outcome: FetchOutcome
  usagePercent: number
  warnings: string[]
}

export interface AddArtistResult {
  artist: SerializedArtist
  status: "created" | "existing"
  warnings: string[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const cleanText = (value: string | null | undefined, max: number) => {
  const trimmed = value?.trim()
  return trimmed ? trimmed.slice(0, max) : null
}

function cleanUrl(value: string | null | undefined): string | null {
  if (!value) return null
  try {
    const url = new URL(value)
    return url.protocol === "https:" ? url.toString() : null
  } catch {
    return null
  }
}

/** True when at least one bio source is set up. */
export function isBioLookupConfigured(): boolean {
  return isBusinessDiscoveryConfigured() || isProviderConfigured()
}

interface SourcedProfile {
  profile: InstagramProfile
  source: "business_discovery" | "provider"
  accountType: string
}

/**
 * Business Discovery first (free, Business/Creator accounts only), then the
 * paid provider for anything BD can't see. Each call is budgeted.
 */
async function lookupProfile(
  handle: string,
  userId: string
): Promise<{ found: SourcedProfile | null; usagePercent: number; providerDown: boolean }> {
  let usagePercent = 0
  const bdConfigured = isBusinessDiscoveryConfigured()

  if (bdConfigured) {
    const result = await fetchArtistProfile(handle)
    usagePercent = result.usagePercent
    if (result.profile) {
      return {
        found: { profile: result.profile, source: "business_discovery", accountType: "business" },
        usagePercent,
        providerDown: false,
      }
    }
  }

  if (!isProviderConfigured()) return { found: null, usagePercent, providerDown: false }

  await reserveUsage("profile", userId)
  try {
    const profile = await fetchProviderProfile(handle)
    return {
      found: profile ? { profile, source: "provider", accountType: profile.accountType } : null,
      usagePercent,
      providerDown: false,
    }
  } catch (err) {
    // With BD working, a broken fallback shouldn't stall the whole queue
    if (err instanceof ProviderConfigError && bdConfigured) {
      console.error("HikerAPI config error (falling back to unavailable):", err.message)
      return { found: null, usagePercent, providerDown: true }
    }
    throw err
  }
}

function claimableWhere(now: Date): Prisma.ArtistWhereInput {
  return {
    fetchStatus: "pending",
    OR: [{ fetchClaimedAt: null }, { fetchClaimedAt: { lt: new Date(now.getTime() - CLAIM_TTL_MS) } }],
  }
}

// ---------------------------------------------------------------------------
// Step 1 — save selections
// ---------------------------------------------------------------------------

/**
 * Saves handles to the user's list as stub artists. Fast and idempotent: no
 * Instagram, Claude, or Mapbox calls.
 */
export async function trackArtists(userId: string, accounts: ArtistHint[]): Promise<TrackResult> {
  const invalid: string[] = []
  const byHandle = new Map<string, ArtistHint>()

  for (const account of accounts.slice(0, MAX_TRACK_BATCH)) {
    const handle = normalizeHandle(account.username)
    if (!isValidHandle(handle)) {
      invalid.push(account.username)
      continue
    }
    if (!byHandle.has(handle)) byHandle.set(handle, account)
  }

  const handles = [...byHandle.keys()]
  if (handles.length === 0) return { added: 0, alreadyTracked: 0, invalid }

  await prisma.artist.createMany({
    data: handles.map((handle) => {
      const hint = byHandle.get(handle)!
      return {
        instagramHandle: handle,
        displayName: cleanText(hint.fullName, 200),
        profilePicUrl: cleanUrl(hint.profilePicUrl),
      }
    }),
    skipDuplicates: true,
  })

  const artists = await prisma.artist.findMany({
    where: { instagramHandle: { in: handles } },
    select: { id: true },
  })

  const { count: added } = await prisma.userArtist.createMany({
    data: artists.map((a) => ({ userId, artistId: a.id })),
    skipDuplicates: true,
  })

  return { added, alreadyTracked: artists.length - added, invalid }
}

// ---------------------------------------------------------------------------
// Step 2 — fetch bios
// ---------------------------------------------------------------------------

/**
 * Fetches, parses, and geocodes one pending artist's bio.
 *
 * External calls are intentionally NOT wrapped in a Prisma transaction — they
 * are slow and shouldn't hold a connection open.
 *
 * @param userId whose daily budget the lookup counts against
 * @throws {RateLimitError} Instagram is throttling — the artist stays pending
 * @throws {BusinessDiscoveryConfigError} token missing/expired — the artist stays pending
 * @throws {ProviderConfigError} provider is the only source and its key/balance is bad — stays pending
 * @throws {BudgetExceededError} daily limit reached — the artist stays pending
 */
export async function fetchArtistBio(artistId: string, userId: string): Promise<FetchBioResult> {
  const now = new Date()
  const { count: claimed } = await prisma.artist.updateMany({
    where: { id: artistId, ...claimableWhere(now) },
    data: { fetchClaimedAt: now },
  })
  if (claimed === 0) return { outcome: "skipped", usagePercent: 0, warnings: [] }

  const artist = await prisma.artist.findUniqueOrThrow({
    where: { id: artistId },
    include: { locations: true },
  })
  const warnings: string[] = []
  let usagePercent = 0

  try {
    await reserveUsage("bio_fetch", userId)
    const lookup = await lookupProfile(artist.instagramHandle, userId)
    usagePercent = lookup.usagePercent

    if (!lookup.found) {
      const providerTried = isProviderConfigured() && !lookup.providerDown
      await prisma.artist.update({
        where: { id: artistId },
        data: {
          fetchStatus: "unavailable",
          fetchAttempts: { increment: 1 },
          fetchError: lookup.providerDown ? "Paid lookup was unavailable" : null,
          fetchClaimedAt: null,
        },
      })
      warnings.push(
        providerTried
          ? "Couldn't find this Instagram account. Check the handle, or add a location manually."
          : "Instagram only shares bios of public Business/Creator accounts, and this isn't one. Add a location manually."
      )
      return { outcome: "unavailable", usagePercent, warnings }
    }
    const { profile, source, accountType } = lookup.found

    // Parse + geocode before writing, so a Claude/Mapbox failure retries cleanly
    const parsed = profile.biography ? await parseBioLocations(profile.biography) : []
    const hasManualPrimary = artist.locations.some((l) => l.source !== "bio" && l.isPrimary)
    let primaryAssigned = hasManualPrimary
    const locations: Prisma.ArtistLocationCreateManyInput[] = []

    for (const loc of parsed) {
      const geo = await geocodeLocation(loc.locationName)
      if (!geo) warnings.push(`Could not geocode: ${loc.locationName}`)

      // First non-guest-spot location becomes primary
      const isPrimary = !loc.isGuestSpot && !primaryAssigned
      if (isPrimary) primaryAssigned = true

      locations.push({
        artistId,
        locationName: loc.locationName,
        city: geo?.city ?? loc.city,
        country: geo?.country ?? loc.country,
        lat: geo?.lat ?? null,
        lng: geo?.lng ?? null,
        isPrimary,
        isGuestSpot: loc.isGuestSpot,
        startDate: loc.startDate ? new Date(loc.startDate) : null,
        endDate: loc.endDate ? new Date(loc.endDate) : null,
        source: "bio",
      })
    }

    if (profile.biography && parsed.length === 0) {
      warnings.push("No locations found in bio. You can add locations manually.")
    }

    await prisma.$transaction([
      prisma.artistLocation.deleteMany({ where: { artistId, source: "bio" } }),
      prisma.artistLocation.createMany({ data: locations }),
      prisma.artist.update({
        where: { id: artistId },
        data: {
          displayName: profile.name ?? artist.displayName,
          bio: profile.biography,
          profilePicUrl: profile.profilePictureUrl ?? artist.profilePicUrl,
          accountType,
          fetchSource: source,
          bioLastFetchedAt: new Date(),
          fetchStatus: "fetched",
          fetchAttempts: { increment: 1 },
          fetchError: null,
          fetchClaimedAt: null,
        },
      }),
    ])

    return { outcome: "fetched", usagePercent, warnings }
  } catch (err) {
    if (
      err instanceof RateLimitError ||
      err instanceof BusinessDiscoveryConfigError ||
      err instanceof ProviderConfigError ||
      err instanceof BudgetExceededError
    ) {
      // Not the artist's fault — release the claim without using up an attempt
      await prisma.artist.update({ where: { id: artistId }, data: { fetchClaimedAt: null } })
      throw err
    }

    const message = err instanceof Error ? err.message : String(err)
    const attempts = artist.fetchAttempts + 1
    const failed = attempts >= MAX_FETCH_ATTEMPTS
    await prisma.artist.update({
      where: { id: artistId },
      data: {
        fetchStatus: failed ? "failed" : "pending",
        fetchAttempts: attempts,
        fetchError: message.slice(0, 500),
        fetchClaimedAt: null,
      },
    })
    console.error(`Bio fetch for @${artist.instagramHandle} failed (attempt ${attempts}):`, err)
    return { outcome: failed ? "failed" : "retry", usagePercent, warnings: [message] }
  }
}

/** Number of the user's artists still waiting for a bio fetch. */
export function countPendingArtists(userId: string): Promise<number> {
  return prisma.artist.count({
    where: { fetchStatus: "pending", users: { some: { userId } } },
  })
}

/**
 * Fetches the bio of the user's next pending artist. Artists that errored go to
 * the back of the queue (ordered by attempts).
 *
 * @throws {RateLimitError}
 * @throws {BusinessDiscoveryConfigError}
 * @throws {ProviderConfigError}
 * @throws {BudgetExceededError}
 */
export async function processNextPendingArtist(userId: string): Promise<{
  artist: SerializedArtist | null
  outcome: FetchOutcome | null
  usagePercent: number
}> {
  const next = await prisma.artist.findFirst({
    where: { ...claimableWhere(new Date()), users: { some: { userId } } },
    orderBy: [{ fetchAttempts: "asc" }, { createdAt: "asc" }],
    select: { id: true },
  })
  if (!next) return { artist: null, outcome: null, usagePercent: 0 }

  const { outcome, usagePercent } = await fetchArtistBio(next.id, userId)
  return { artist: await loadUserArtist(userId, next.id), outcome, usagePercent }
}

async function loadUserArtist(userId: string, artistId: string): Promise<SerializedArtist | null> {
  const link = await prisma.userArtist.findUnique({
    where: { userId_artistId: { userId, artistId } },
    include: { artist: { include: { locations: true } } },
  })
  return link ? serializeArtist(link.artist, link.notes) : null
}

// ---------------------------------------------------------------------------
// Single add (Add Artist page)
// ---------------------------------------------------------------------------

/**
 * Saves one artist, then tries to fetch its bio right away. If Instagram is
 * rate limiting (or lookups aren't configured) the artist is still saved and
 * stays pending for the background queue.
 */
export async function addArtistByHandle(userId: string, hint: ArtistHint): Promise<AddArtistResult> {
  const { added, invalid } = await trackArtists(userId, [hint])
  if (invalid.length > 0) {
    throw new InvalidHandleError(hint.username)
  }

  const handle = normalizeHandle(hint.username)
  // Adding an artist whose fetch errored out is an explicit request to try again
  await prisma.artist.updateMany({
    where: { instagramHandle: handle, fetchStatus: "failed" },
    data: { fetchStatus: "pending", fetchAttempts: 0, fetchError: null },
  })
  const artist = await prisma.artist.findUniqueOrThrow({
    where: { instagramHandle: handle },
    select: { id: true, fetchStatus: true },
  })

  const warnings: string[] = []
  if (artist.fetchStatus === "pending") {
    if (!isBioLookupConfigured()) {
      warnings.push("Saved. Instagram bio lookup isn't set up yet, so this artist's bio will be fetched once it is.")
    } else {
      try {
        const result = await fetchArtistBio(artist.id, userId)
        warnings.push(...result.warnings)
        if (result.outcome === "retry" || result.outcome === "skipped") {
          warnings.push("Saved. The bio will be fetched automatically from your Artists page.")
        }
      } catch (err) {
        if (err instanceof RateLimitError) {
          warnings.push("Saved. Instagram is rate limiting right now — the bio will be fetched automatically later.")
        } else if (err instanceof BudgetExceededError) {
          warnings.push(`Saved. ${err.message} The bio will be fetched after that.`)
        } else if (err instanceof BusinessDiscoveryConfigError || err instanceof ProviderConfigError) {
          console.error("Bio lookup config error:", err.message)
          warnings.push("Saved. Instagram bio lookup is misconfigured, so the bio will be fetched once it's fixed.")
        } else {
          throw err
        }
      }
    }
  }

  const serialized = await loadUserArtist(userId, artist.id)
  if (!serialized) throw new Error(`Artist @${handle} was saved but could not be reloaded`)

  return { artist: serialized, status: added > 0 ? "created" : "existing", warnings }
}

export class InvalidHandleError extends Error {
  constructor(handle: string) {
    super(
      `Invalid Instagram handle "${handle}". Handles must be 1-30 characters and contain only letters, numbers, periods, or underscores.`
    )
    this.name = "InvalidHandleError"
  }
}
