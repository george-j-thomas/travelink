import type { ArtistLocation, Prisma } from "@prisma/client"

export type FetchStatus = "pending" | "fetched" | "unavailable" | "failed"

/**
 * What every query feeding serializeArtist (or the map) must include: the
 * locations and the stored photo's version. Never the photo bytes; only the
 * avatar route reads those.
 */
export const ARTIST_DTO_INCLUDE = {
  locations: true,
  avatar: { select: { version: true } },
} satisfies Prisma.ArtistInclude

export type ArtistForDto = Prisma.ArtistGetPayload<{ include: typeof ARTIST_DTO_INCLUDE }>

/** URL of an artist's stored photo. `v` changes with the photo, so browsers can cache each version for good. */
export function avatarPath(artistId: string, version: string): string {
  return `/api/artists/${encodeURIComponent(artistId)}/avatar?v=${encodeURIComponent(version)}`
}

/**
 * Our stored copy of the photo when there is one, otherwise the Instagram link
 * (which expires a few days after it was fetched).
 */
export function profilePicUrlFor(artist: Pick<ArtistForDto, "id" | "profilePicUrl" | "avatar">): string | null {
  return artist.avatar ? avatarPath(artist.id, artist.avatar.version) : artist.profilePicUrl
}

export function serializeLocation(loc: ArtistLocation) {
  return {
    id: loc.id,
    locationName: loc.locationName,
    city: loc.city,
    country: loc.country,
    lat: loc.lat,
    lng: loc.lng,
    isPrimary: loc.isPrimary,
    isGuestSpot: loc.isGuestSpot,
    startDate: loc.startDate,
    endDate: loc.endDate,
    source: loc.source,
  }
}

/** The artist shape returned by the artist API routes. Load it with ARTIST_DTO_INCLUDE. */
export function serializeArtist(artist: ArtistForDto, notes: string | null = null) {
  return {
    id: artist.id,
    instagramHandle: artist.instagramHandle,
    displayName: artist.displayName,
    bio: artist.bio,
    profilePicUrl: profilePicUrlFor(artist),
    accountType: artist.accountType,
    bioLastFetchedAt: artist.bioLastFetchedAt,
    fetchStatus: artist.fetchStatus as FetchStatus,
    fetchError: artist.fetchError,
    notes,
    locations: artist.locations.map(serializeLocation),
  }
}

export type SerializedArtist = ReturnType<typeof serializeArtist>
