import { prisma } from "@/lib/db"
import { fetchArtistProfile, RateLimitError } from "@/lib/instagram"
import { parseBioLocations } from "@/lib/bio-parser"
import { geocodeLocation } from "@/lib/geocoding"

export interface PipelineResult {
  artist: {
    id: string
    instagramHandle: string
    displayName: string | null
    bio: string | null
    profilePicUrl: string | null
    accountType: string
  }
  locations: {
    id: string
    locationName: string
    city: string | null
    country: string | null
    lat: number | null
    lng: number | null
    isPrimary: boolean
    isGuestSpot: boolean
    startDate: Date | null
    endDate: Date | null
    source: string
  }[]
  status: "created" | "existing" | "updated"
  warnings: string[]
}

function normalizeHandle(handle: string): string {
  return handle.replace(/^@/, "").trim().toLowerCase()
}

/**
 * Orchestrates: Instagram fetch → bio parse → geocode → DB write.
 *
 * External API calls (Instagram, Claude, Mapbox) are intentionally NOT wrapped
 * in a Prisma transaction — they are slow and shouldn't hold a connection open.
 * Partial data from a mid-pipeline failure is still useful.
 */
export async function addArtistByHandle(
  handle: string,
  userId: string
): Promise<PipelineResult> {
  const warnings: string[] = []
  const normalized = normalizeHandle(handle)

  // ------------------------------------------------------------------
  // Step 1 — Check if artist already exists
  // ------------------------------------------------------------------
  const existing = await prisma.artist.findUnique({
    where: { instagramHandle: normalized },
    include: { locations: true },
  })

  if (existing) {
    // Ensure UserArtist link exists
    await prisma.userArtist.upsert({
      where: {
        userId_artistId: { userId, artistId: existing.id },
      },
      create: { userId, artistId: existing.id },
      update: {},
    })

    return {
      artist: {
        id: existing.id,
        instagramHandle: existing.instagramHandle,
        displayName: existing.displayName,
        bio: existing.bio,
        profilePicUrl: existing.profilePicUrl,
        accountType: existing.accountType,
      },
      locations: existing.locations.map((loc) => ({
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
      })),
      status: "existing",
      warnings,
    }
  }

  // ------------------------------------------------------------------
  // Step 2 — Fetch Instagram profile
  // ------------------------------------------------------------------
  const profile = await fetchArtistProfile(normalized)

  let artistData: {
    instagramHandle: string
    displayName: string | null
    bio: string | null
    profilePicUrl: string | null
    accountType: string
    bioLastFetchedAt: Date | null
  }

  if (!profile) {
    warnings.push(
      "Instagram profile not found. You can add locations manually."
    )
    artistData = {
      instagramHandle: normalized,
      displayName: null,
      bio: null,
      profilePicUrl: null,
      accountType: "unknown",
      bioLastFetchedAt: null,
    }
  } else {
    artistData = {
      instagramHandle: profile.username,
      displayName: profile.name,
      bio: profile.biography,
      profilePicUrl: profile.profilePictureUrl,
      accountType: profile.accountType,
      bioLastFetchedAt: new Date(),
    }
  }

  // ------------------------------------------------------------------
  // Step 3 — Create Artist record
  // ------------------------------------------------------------------
  const artist = await prisma.artist.create({ data: artistData })

  // ------------------------------------------------------------------
  // Step 4 — Parse bio for locations
  // ------------------------------------------------------------------
  let locationRecords: PipelineResult["locations"] = []

  if (artistData.bio) {
    const parsed = await parseBioLocations(artistData.bio)

    if (parsed.length === 0) {
      warnings.push("No locations found in bio. You can add locations manually.")
    } else {
      // -----------------------------------------------------------------
      // Step 5 — Geocode each parsed location
      // -----------------------------------------------------------------
      const toCreate: {
        artistId: string
        locationName: string
        city: string | null
        country: string | null
        lat: number | null
        lng: number | null
        isPrimary: boolean
        isGuestSpot: boolean
        startDate: Date | null
        endDate: Date | null
        source: string
      }[] = []

      let primaryAssigned = false

      for (const loc of parsed) {
        const geo = await geocodeLocation(loc.locationName)

        if (!geo) {
          warnings.push(`Could not geocode: ${loc.locationName}`)
        }

        // First non-guest-spot location becomes primary
        const isPrimary = !loc.isGuestSpot && !primaryAssigned
        if (isPrimary) primaryAssigned = true

        toCreate.push({
          artistId: artist.id,
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

      // Bulk-create all location records
      await prisma.artistLocation.createMany({ data: toCreate })

      // Re-fetch to get generated IDs
      const created = await prisma.artistLocation.findMany({
        where: { artistId: artist.id },
      })

      locationRecords = created.map((loc) => ({
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
      }))
    }
  }

  // ------------------------------------------------------------------
  // Step 6 — Link artist to user
  // ------------------------------------------------------------------
  await prisma.userArtist.create({
    data: { userId, artistId: artist.id },
  })

  return {
    artist: {
      id: artist.id,
      instagramHandle: artist.instagramHandle,
      displayName: artist.displayName,
      bio: artist.bio,
      profilePicUrl: artist.profilePicUrl,
      accountType: artist.accountType,
    },
    locations: locationRecords,
    status: "created",
    warnings,
  }
}
