// Artist pipeline.
//
// Adding artists and fetching their bios are separate steps:
//   1. trackArtists() saves stub Artist rows + UserArtist links immediately — no
//      external calls, so a selection is never lost to a rate limit.
//   2. fetchArtistBio() fills a stub in later: Business Discovery → Claude bio
//      parse → Mapbox geocode. Queue state (fetchStatus) lives on the Artist, so
//      the browser-driven loop can stop and resume at any time.
//
// A bio is fetched once. It's only fetched again when a user asks for it, with
// refreshArtistBio() (one artist) or refreshAllArtistBios() (all of their artists).

import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"
import {
  BusinessDiscoveryConfigError,
  fetchArtistProfile,
  isBusinessDiscoveryConfigured,
  isValidHandle,
  normalizeHandle,
  RateLimitError,
} from "@/lib/instagram"
import { parseBioLocations } from "@/lib/bio-parser"
import { BudgetExceededError, reserveUsage } from "@/lib/usage"
import { geocodeLocation } from "@/lib/geocoding"
import { serializeArtist, type SerializedArtist } from "@/lib/artist-dto"
import { isRecentlyFetched, REFRESH_CONFIRM_WINDOW_MS } from "@/lib/bio-refresh"

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const MAX_TRACK_BATCH = 2000
/** Instagram's cap on how many accounts one user can follow. */
export const MAX_ACCOUNT_TYPE_LOOKUP = 7500
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

interface ClaimedFetchResult extends FetchBioResult {
  outcome: Exclude<FetchOutcome, "skipped">
}

/**
 * "queued": Instagram is throttling or a budget ran out, so the artist was left
 * pending for the background queue. "in_progress": another request is fetching it.
 */
export type RefreshOutcome = Exclude<FetchOutcome, "skipped"> | "queued" | "in_progress"

export interface RefreshResult {
  artist: SerializedArtist
  outcome: RefreshOutcome
  warnings: string[]
}

/** What earlier bio lookups (by any user) found out about an Instagram account. */
export type KnownAccountType = "business" | "personal"

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

/** True when Business Discovery, the bio source, is set up. */
export function isBioLookupConfigured(): boolean {
  return isBusinessDiscoveryConfigured()
}

/** No other request is mid-fetch (claims past their TTL were abandoned). */
function unclaimedWhere(now: Date): Prisma.ArtistWhereInput {
  return {
    OR: [{ fetchClaimedAt: null }, { fetchClaimedAt: { lt: new Date(now.getTime() - CLAIM_TTL_MS) } }],
  }
}

function claimableWhere(now: Date): Prisma.ArtistWhereInput {
  return { fetchStatus: "pending", ...unclaimedWhere(now) }
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
 * @throws {BudgetExceededError} daily limit reached — the artist stays pending
 */
export async function fetchArtistBio(artistId: string, userId: string): Promise<FetchBioResult> {
  const now = new Date()
  const { count: claimed } = await prisma.artist.updateMany({
    where: { id: artistId, ...claimableWhere(now) },
    data: { fetchClaimedAt: now },
  })
  if (claimed === 0) return { outcome: "skipped", usagePercent: 0, warnings: [] }

  return runClaimedFetch(artistId, userId)
}

/** The fetch itself, for an artist this request has already claimed. Always releases the claim. */
async function runClaimedFetch(artistId: string, userId: string): Promise<ClaimedFetchResult> {
  const artist = await prisma.artist.findUniqueOrThrow({
    where: { id: artistId },
    include: { locations: true },
  })
  const warnings: string[] = []
  let usagePercent = 0

  try {
    await reserveUsage("bio_fetch", userId)
    const result = await fetchArtistProfile(artist.instagramHandle)
    usagePercent = result.usagePercent
    const profile = result.profile

    if (!profile) {
      await prisma.artist.update({
        where: { id: artistId },
        data: {
          accountType: "personal",
          bioLastFetchedAt: new Date(),
          fetchStatus: "unavailable",
          fetchAttempts: { increment: 1 },
          fetchError: null,
          fetchClaimedAt: null,
        },
      })
      // A refresh can find that an account stopped being a business account; keep what it had
      warnings.push(
        artist.bio
          ? "Instagram no longer shares this account's bio. It may have switched to a personal account or changed its handle. The bio and locations from the last fetch were kept."
          : "Instagram only shares bios of public Business/Creator accounts, and this isn't one. Add a location manually."
      )
      return { outcome: "unavailable", usagePercent, warnings }
    }

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
          accountType: "business",
          fetchSource: "business_discovery",
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
 * Fetches the bio of the user's next pending artist. Artists that were never
 * fetched go first, then refreshes (oldest bio first). Artists that errored go
 * to the back of the queue (ordered by attempts).
 *
 * @throws {RateLimitError}
 * @throws {BusinessDiscoveryConfigError}
 * @throws {BudgetExceededError}
 */
export async function processNextPendingArtist(userId: string): Promise<{
  artist: SerializedArtist | null
  outcome: FetchOutcome | null
  usagePercent: number
}> {
  const next = await prisma.artist.findFirst({
    where: { ...claimableWhere(new Date()), users: { some: { userId } } },
    orderBy: [
      { fetchAttempts: "asc" },
      { bioLastFetchedAt: { sort: "asc", nulls: "first" } },
      { createdAt: "asc" },
    ],
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
// Manual refresh (artist pages)
// ---------------------------------------------------------------------------

/**
 * Fetches a tracked artist's bio again right away, whatever its status. If
 * Instagram is throttling (or a budget is used up) the artist is left pending,
 * so the background queue refreshes it later.
 *
 * @param force refresh even if the bio was fetched within REFRESH_CONFIRM_WINDOW_MS
 * @throws {ArtistNotFoundError} the user doesn't track this artist
 * @throws {BusinessDiscoveryConfigError} bio lookup isn't set up — nothing was changed
 * @throws {RecentlyRefreshedError} fetched recently and `force` isn't set — nothing was changed
 */
export async function refreshArtistBio(
  userId: string,
  artistId: string,
  { force = false }: { force?: boolean } = {}
): Promise<RefreshResult> {
  const link = await prisma.userArtist.findUnique({
    where: { userId_artistId: { userId, artistId } },
    select: { artist: { select: { bioLastFetchedAt: true } } },
  })
  if (!link) throw new ArtistNotFoundError()
  if (!isBioLookupConfigured()) {
    throw new BusinessDiscoveryConfigError("Instagram bio lookup isn't set up, so bios can't be refreshed.")
  }

  const now = new Date()
  const lastFetchedAt = link.artist.bioLastFetchedAt
  if (!force && lastFetchedAt && isRecentlyFetched(lastFetchedAt, now.getTime())) {
    throw new RecentlyRefreshedError(lastFetchedAt)
  }

  // Back in the queue and claimed in one step, unless another request is mid-fetch
  const { count: claimed } = await prisma.artist.updateMany({
    where: { id: artistId, ...unclaimedWhere(now) },
    data: { fetchStatus: "pending", fetchAttempts: 0, fetchError: null, fetchClaimedAt: now },
  })

  let outcome: RefreshOutcome = "in_progress"
  const warnings: string[] = []
  if (claimed > 0) {
    try {
      const result = await runClaimedFetch(artistId, userId)
      outcome = result.outcome
      warnings.push(...result.warnings)
    } catch (err) {
      outcome = "queued"
      if (err instanceof RateLimitError) {
        warnings.push("Instagram is rate limiting right now, so the bio will refresh automatically later.")
      } else if (err instanceof BudgetExceededError) {
        warnings.push(`${err.message} The bio will refresh after that.`)
      } else if (err instanceof BusinessDiscoveryConfigError) {
        console.error("Bio lookup config error:", err.message)
        warnings.push("Instagram bio lookup is misconfigured, so the bio will refresh once it's fixed.")
      } else {
        throw err
      }
    }
  }

  const artist = await loadUserArtist(userId, artistId)
  if (!artist) throw new ArtistNotFoundError()
  return { artist, outcome, warnings }
}

/**
 * Puts all of a user's artists back in the bio queue, which then fetches them
 * one at a time (after any artists that were never fetched). Skips artists that
 * are already queued and, unless `includeRecent`, ones fetched within
 * REFRESH_CONFIRM_WINDOW_MS. Artists are shared, so the new bios show for
 * everyone who tracks them.
 *
 * @returns the ids of the artists now waiting for a bio
 * @throws {BusinessDiscoveryConfigError} bio lookup isn't set up — nothing was changed
 */
export async function refreshAllArtistBios(
  userId: string,
  { includeRecent = false }: { includeRecent?: boolean } = {}
): Promise<{ queuedIds: string[] }> {
  if (!isBioLookupConfigured()) {
    throw new BusinessDiscoveryConfigError("Instagram bio lookup isn't set up, so bios can't be refreshed.")
  }

  const where: Prisma.ArtistWhereInput = {
    users: { some: { userId } },
    // Pending artists are already queued, and they're the only ones a request can be fetching
    fetchStatus: { not: "pending" },
    ...(includeRecent
      ? {}
      : {
          OR: [
            { bioLastFetchedAt: null },
            { bioLastFetchedAt: { lt: new Date(Date.now() - REFRESH_CONFIRM_WINDOW_MS) } },
          ],
        }),
  }
  const artists = await prisma.artist.findMany({ where, select: { id: true } })
  const queuedIds = artists.map((a) => a.id)
  if (queuedIds.length > 0) {
    await prisma.artist.updateMany({
      where: { ...where, id: { in: queuedIds } },
      data: { fetchStatus: "pending", fetchAttempts: 0, fetchError: null },
    })
  }
  return { queuedIds }
}

// ---------------------------------------------------------------------------
// Account types (import page)
// ---------------------------------------------------------------------------

/**
 * Account types already known from earlier bio lookups. Artists are shared, so
 * any user's lookup counts. Handles that were never looked up are left out —
 * this makes no Instagram calls.
 */
export async function getKnownAccountTypes(handles: string[]): Promise<Record<string, KnownAccountType>> {
  const normalized = [...new Set(handles.map(normalizeHandle))].filter(isValidHandle)
  if (normalized.length === 0) return {}

  const artists = await prisma.artist.findMany({
    where: { instagramHandle: { in: normalized } },
    select: { instagramHandle: true, fetchStatus: true, accountType: true },
  })

  const types: Record<string, KnownAccountType> = {}
  for (const a of artists) {
    // The latest lookup result wins; accountType covers artists queued for a refresh
    if (a.fetchStatus === "fetched") types[a.instagramHandle] = "business"
    else if (a.fetchStatus === "unavailable") types[a.instagramHandle] = "personal"
    else if (a.accountType === "business" || a.accountType === "creator") types[a.instagramHandle] = "business"
    else if (a.accountType === "personal") types[a.instagramHandle] = "personal"
  }
  return types
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
        } else if (err instanceof BusinessDiscoveryConfigError) {
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

export class ArtistNotFoundError extends Error {
  constructor() {
    super("Artist not found")
    this.name = "ArtistNotFoundError"
  }
}

/** The bio was fetched within REFRESH_CONFIRM_WINDOW_MS; the user should confirm before refreshing again. */
export class RecentlyRefreshedError extends Error {
  constructor(public readonly lastRefreshedAt: Date) {
    super("This bio was refreshed recently.")
    this.name = "RecentlyRefreshedError"
  }
}
