import type { Artist, ArtistLocation } from "@prisma/client"

export type FetchStatus = "pending" | "fetched" | "unavailable" | "failed"

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

/** The artist shape returned by the artist API routes. */
export function serializeArtist(
  artist: Artist & { locations: ArtistLocation[] },
  notes: string | null = null
) {
  return {
    id: artist.id,
    instagramHandle: artist.instagramHandle,
    displayName: artist.displayName,
    bio: artist.bio,
    profilePicUrl: artist.profilePicUrl,
    accountType: artist.accountType,
    bioLastFetchedAt: artist.bioLastFetchedAt,
    fetchStatus: artist.fetchStatus as FetchStatus,
    fetchError: artist.fetchError,
    notes,
    locations: artist.locations.map(serializeLocation),
  }
}

export type SerializedArtist = ReturnType<typeof serializeArtist>
