import { NextRequest, NextResponse } from "next/server"
import { requireSession } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { addArtistByHandle, InvalidHandleError } from "@/lib/artist-pipeline"
import { serializeArtist } from "@/lib/artist-dto"

// POST /api/artists — Add one artist by Instagram handle. The artist is saved
// even if its bio can't be fetched yet (it stays pending for the bio queue).
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

  const { handle, fullName, profilePicUrl } = (body ?? {}) as {
    handle?: unknown
    fullName?: unknown
    profilePicUrl?: unknown
  }

  if (!handle || typeof handle !== "string" || handle.trim().length === 0) {
    return NextResponse.json(
      { error: "handle is required and must be a non-empty string" },
      { status: 400 }
    )
  }

  try {
    const result = await addArtistByHandle(session.user.id, {
      username: handle,
      fullName: typeof fullName === "string" ? fullName : null,
      profilePicUrl: typeof profilePicUrl === "string" ? profilePicUrl : null,
    })
    return NextResponse.json(result, { status: result.status === "created" ? 201 : 200 })
  } catch (err) {
    if (err instanceof InvalidHandleError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
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

    const artists = userArtists.map((ua) => serializeArtist(ua.artist, ua.notes))

    return NextResponse.json(artists)
  } catch (err) {
    console.error("GET /api/artists failed:", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
