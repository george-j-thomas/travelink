import { NextRequest, NextResponse } from "next/server"
import { requireSession } from "@/lib/auth"
import { prisma } from "@/lib/db"

type RouteContext = { params: Promise<{ id: string }> }

// GET /api/artists/[id] — Get single artist detail
export async function GET(
  _request: NextRequest,
  context: RouteContext
) {
  let session
  try {
    session = await requireSession()
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await context.params

  try {
    // Verify the user follows this artist
    const userArtist = await prisma.userArtist.findUnique({
      where: {
        userId_artistId: { userId: session.user.id, artistId: id },
      },
      include: {
        artist: {
          include: { locations: true },
        },
      },
    })

    if (!userArtist) {
      return NextResponse.json({ error: "Artist not found" }, { status: 404 })
    }

    const { artist } = userArtist

    return NextResponse.json({
      id: artist.id,
      instagramHandle: artist.instagramHandle,
      displayName: artist.displayName,
      bio: artist.bio,
      profilePicUrl: artist.profilePicUrl,
      accountType: artist.accountType,
      notes: userArtist.notes,
      locations: artist.locations.map((loc) => ({
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
    })
  } catch (err) {
    console.error(`GET /api/artists/${id} failed:`, err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// DELETE /api/artists/[id] — Remove artist from user's list
export async function DELETE(
  _request: NextRequest,
  context: RouteContext
) {
  let session
  try {
    session = await requireSession()
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await context.params

  try {
    // Only delete the UserArtist link — the Artist record is shared
    const deleted = await prisma.userArtist.deleteMany({
      where: { userId: session.user.id, artistId: id },
    })

    if (deleted.count === 0) {
      return NextResponse.json({ error: "Artist not found" }, { status: 404 })
    }

    return new NextResponse(null, { status: 204 })
  } catch (err) {
    console.error(`DELETE /api/artists/${id} failed:`, err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
