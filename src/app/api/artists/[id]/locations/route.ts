import { NextRequest, NextResponse } from "next/server"
import { requireSession } from "@/lib/auth"
import { prisma } from "@/lib/db"

type RouteContext = { params: Promise<{ id: string }> }

// POST /api/artists/[id]/locations — Add a manual location to an artist
export async function POST(request: NextRequest, context: RouteContext) {
  let session
  try {
    session = await requireSession()
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id: artistId } = await context.params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    )
  }

  const {
    locationName,
    city,
    country,
    lat,
    lng,
    isPrimary,
    isGuestSpot,
    startDate,
    endDate,
  } = body as {
    locationName?: unknown
    city?: unknown
    country?: unknown
    lat?: unknown
    lng?: unknown
    isPrimary?: unknown
    isGuestSpot?: unknown
    startDate?: unknown
    endDate?: unknown
  }

  if (
    !locationName ||
    typeof locationName !== "string" ||
    locationName.trim().length === 0
  ) {
    return NextResponse.json(
      { error: "locationName is required and must be a non-empty string" },
      { status: 400 }
    )
  }

  try {
    // Verify user follows this artist
    const userArtist = await prisma.userArtist.findUnique({
      where: {
        userId_artistId: { userId: session.user.id, artistId },
      },
    })

    if (!userArtist) {
      return NextResponse.json(
        { error: "You do not follow this artist" },
        { status: 403 }
      )
    }

    // If setting as primary, unset existing primary locations for this artist
    if (isPrimary) {
      await prisma.artistLocation.updateMany({
        where: { artistId, isPrimary: true },
        data: { isPrimary: false },
      })
    }

    const location = await prisma.artistLocation.create({
      data: {
        artistId,
        locationName: locationName.trim(),
        city: typeof city === "string" ? city.trim() || null : null,
        country: typeof country === "string" ? country.trim() || null : null,
        lat: typeof lat === "number" ? lat : null,
        lng: typeof lng === "number" ? lng : null,
        isPrimary: isPrimary === true,
        isGuestSpot: isGuestSpot === true,
        startDate: typeof startDate === "string" ? new Date(startDate) : null,
        endDate: typeof endDate === "string" ? new Date(endDate) : null,
        source: "manual",
      },
    })

    return NextResponse.json(location, { status: 201 })
  } catch (err) {
    console.error(`POST /api/artists/${artistId}/locations failed:`, err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// GET /api/artists/[id]/locations — List all locations for an artist
export async function GET(_request: NextRequest, context: RouteContext) {
  let session
  try {
    session = await requireSession()
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id: artistId } = await context.params

  try {
    // Verify user follows this artist
    const userArtist = await prisma.userArtist.findUnique({
      where: {
        userId_artistId: { userId: session.user.id, artistId },
      },
    })

    if (!userArtist) {
      return NextResponse.json(
        { error: "You do not follow this artist" },
        { status: 403 }
      )
    }

    const locations = await prisma.artistLocation.findMany({
      where: { artistId },
      orderBy: [
        { isPrimary: "desc" },
        { isGuestSpot: "desc" },
        { locationName: "asc" },
      ],
    })

    return NextResponse.json(locations)
  } catch (err) {
    console.error(`GET /api/artists/${artistId}/locations failed:`, err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
