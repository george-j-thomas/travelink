import { NextRequest, NextResponse } from "next/server"
import { requireSession } from "@/lib/auth"
import { prisma } from "@/lib/db"

type LocationType = "all" | "primary" | "guest_spot"

const VALID_TYPES = new Set<LocationType>(["all", "primary", "guest_spot"])

// GET /api/map — GeoJSON FeatureCollection of artist locations for current user
export async function GET(request: NextRequest) {
  let session
  try {
    session = await requireSession()
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const params = request.nextUrl.searchParams
  const typeParam = (params.get("type") || "all") as LocationType
  const countryParam = params.get("country")?.trim() || null

  if (!VALID_TYPES.has(typeParam)) {
    return NextResponse.json(
      { error: `Invalid type: must be one of ${[...VALID_TYPES].join(", ")}` },
      { status: 400 }
    )
  }

  try {
    const userArtists = await prisma.userArtist.findMany({
      where: { userId: session.user.id },
      include: {
        artist: {
          include: { locations: true },
        },
      },
    })

    // Flatten into (artist, location) tuples
    const tuples = userArtists.flatMap((ua) =>
      ua.artist.locations.map((loc) => ({ artist: ua.artist, location: loc }))
    )

    // Filter out locations missing coordinates
    const withCoords = tuples.filter(
      ({ location }) => location.lat != null && location.lng != null
    )

    // Apply type filter
    const afterType =
      typeParam === "primary"
        ? withCoords.filter(({ location }) => location.isPrimary)
        : typeParam === "guest_spot"
          ? withCoords.filter(({ location }) => location.isGuestSpot)
          : withCoords

    // Apply country filter (case-insensitive)
    const afterCountry = countryParam
      ? afterType.filter(
          ({ location }) =>
            location.country?.toLowerCase() === countryParam.toLowerCase()
        )
      : afterType

    // Transform to GeoJSON FeatureCollection
    const featureCollection = {
      type: "FeatureCollection" as const,
      features: afterCountry.map(({ artist, location }) => ({
        type: "Feature" as const,
        geometry: {
          type: "Point" as const,
          coordinates: [location.lng!, location.lat!], // GeoJSON uses [lng, lat] order
        },
        properties: {
          artistId: artist.id,
          handle: artist.instagramHandle,
          displayName: artist.displayName,
          profilePicUrl: artist.profilePicUrl,
          locationId: location.id,
          locationName: location.locationName,
          city: location.city,
          country: location.country,
          isPrimary: location.isPrimary,
          isGuestSpot: location.isGuestSpot,
          startDate: location.startDate,
          endDate: location.endDate,
          source: location.source,
        },
      })),
    }

    return NextResponse.json(featureCollection, {
      headers: {
        "Cache-Control": "no-store",
      },
    })
  } catch (err) {
    console.error("GET /api/map failed:", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
