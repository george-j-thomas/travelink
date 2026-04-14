import { NextRequest, NextResponse } from "next/server"
import { requireSession } from "@/lib/auth"
import { prisma } from "@/lib/db"

type RouteContext = { params: Promise<{ id: string; locationId: string }> }

// PUT /api/artists/[id]/locations/[locationId] — Edit a location
export async function PUT(request: NextRequest, context: RouteContext) {
  let session
  try {
    session = await requireSession()
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id: artistId, locationId } = await context.params

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

    // Verify location exists and belongs to this artist
    const existing = await prisma.artistLocation.findUnique({
      where: { id: locationId },
    })

    if (!existing || existing.artistId !== artistId) {
      return NextResponse.json(
        { error: "Location not found" },
        { status: 404 }
      )
    }

    // If setting as primary, unset existing primary locations for this artist
    if (isPrimary) {
      await prisma.artistLocation.updateMany({
        where: { artistId, isPrimary: true, id: { not: locationId } },
        data: { isPrimary: false },
      })
    }

    // Bio-sourced locations become manual once edited (prevents overwrite on refresh)
    const source = existing.source === "bio" ? "manual" : existing.source

    const updated = await prisma.artistLocation.update({
      where: { id: locationId },
      data: {
        locationName: locationName.trim(),
        city: typeof city === "string" ? city.trim() || null : null,
        country: typeof country === "string" ? country.trim() || null : null,
        lat: typeof lat === "number" ? lat : null,
        lng: typeof lng === "number" ? lng : null,
        isPrimary: isPrimary === true,
        isGuestSpot: isGuestSpot === true,
        startDate: typeof startDate === "string" ? new Date(startDate) : null,
        endDate: typeof endDate === "string" ? new Date(endDate) : null,
        source,
      },
    })

    return NextResponse.json(updated)
  } catch (err) {
    console.error(
      `PUT /api/artists/${artistId}/locations/${locationId} failed:`,
      err
    )
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// DELETE /api/artists/[id]/locations/[locationId] — Delete a location
export async function DELETE(_request: NextRequest, context: RouteContext) {
  let session
  try {
    session = await requireSession()
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id: artistId, locationId } = await context.params

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

    // Verify location exists and belongs to this artist
    const existing = await prisma.artistLocation.findUnique({
      where: { id: locationId },
    })

    if (!existing || existing.artistId !== artistId) {
      return NextResponse.json(
        { error: "Location not found" },
        { status: 404 }
      )
    }

    await prisma.artistLocation.delete({
      where: { id: locationId },
    })

    return new NextResponse(null, { status: 204 })
  } catch (err) {
    console.error(
      `DELETE /api/artists/${artistId}/locations/${locationId} failed:`,
      err
    )
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
