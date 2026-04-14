import { NextRequest, NextResponse } from "next/server"
import { requireSession } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { addArtistByHandle } from "@/lib/artist-pipeline"
import { RateLimitError } from "@/lib/instagram"

// POST /api/artists — Add artist by Instagram handle
export async function POST(request: NextRequest) {
  let session
  try {
    session = await requireSession()
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    )
  }

  const { handle } = body as { handle?: unknown }

  if (!handle || typeof handle !== "string" || handle.trim().length === 0) {
    return NextResponse.json(
      { error: "handle is required and must be a non-empty string" },
      { status: 400 }
    )
  }

  try {
    const result = await addArtistByHandle(handle, session.user.id)
    return NextResponse.json(result, { status: 201 })
  } catch (err) {
    if (err instanceof RateLimitError) {
      return NextResponse.json(
        { error: err.message },
        { status: 429 }
      )
    }
    console.error("POST /api/artists failed:", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// GET /api/artists — List current user's artists
export async function GET(request: NextRequest) {
  let session
  try {
    session = await requireSession()
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const search = request.nextUrl.searchParams.get("search")?.trim() || null

  try {
    const userArtists = await prisma.userArtist.findMany({
      where: {
        userId: session.user.id,
        ...(search
          ? {
              artist: {
                OR: [
                  { instagramHandle: { contains: search, mode: "insensitive" } },
                  { displayName: { contains: search, mode: "insensitive" } },
                  {
                    locations: {
                      some: {
                        OR: [
                          { city: { contains: search, mode: "insensitive" } },
                          { country: { contains: search, mode: "insensitive" } },
                        ],
                      },
                    },
                  },
                ],
              },
            }
          : {}),
      },
      include: {
        artist: {
          include: { locations: true },
        },
      },
      orderBy: { artist: { displayName: "asc" } },
    })

    const artists = userArtists.map((ua) => ({
      id: ua.artist.id,
      instagramHandle: ua.artist.instagramHandle,
      displayName: ua.artist.displayName,
      bio: ua.artist.bio,
      profilePicUrl: ua.artist.profilePicUrl,
      accountType: ua.artist.accountType,
      notes: ua.notes,
      locations: ua.artist.locations.map((loc) => ({
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
    }))

    return NextResponse.json(artists)
  } catch (err) {
    console.error("GET /api/artists failed:", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
