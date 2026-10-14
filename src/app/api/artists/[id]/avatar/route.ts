import { NextRequest, NextResponse } from "next/server"
import { requireSession } from "@/lib/auth"
import { prisma } from "@/lib/db"

type RouteContext = { params: Promise<{ id: string }> }

// Always `private`: a shared (CDN) cache could serve the photo without the auth check
const VERSIONED_CACHE = "private, max-age=31536000, immutable"
const SHORT_CACHE = "private, max-age=60"

/** If-None-Match holds `*` or a comma-separated list of ETags, possibly weak (W/"..."). */
function matchesEtag(ifNoneMatch: string | null, etag: string): boolean {
  if (!ifNoneMatch) return false
  return ifNoneMatch
    .split(",")
    .map((tag) => tag.trim().replace(/^W\//, ""))
    .some((tag) => tag === "*" || tag === etag)
}

// GET /api/artists/[id]/avatar?v=<version> — The stored copy of a tracked artist's
// profile photo. Only serves what the bio fetch stored; it never downloads anything.
export async function GET(request: NextRequest, context: RouteContext) {
  let session
  try {
    session = await requireSession()
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await context.params

  try {
    const link = await prisma.userArtist.findUnique({
      where: { userId_artistId: { userId: session.user.id, artistId: id } },
      select: {
        artist: { select: { avatar: { select: { data: true, contentType: true, version: true } } } },
      },
    })
    if (!link) {
      return NextResponse.json(
        { error: "Artist not found" },
        { status: 404, headers: { "Cache-Control": SHORT_CACHE } }
      )
    }
    const avatar = link.artist.avatar
    if (!avatar) {
      return NextResponse.json(
        { error: "No stored photo" },
        { status: 404, headers: { "Cache-Control": SHORT_CACHE } }
      )
    }

    const etag = `"${avatar.version}"`
    const headers = {
      ETag: etag,
      // An unversioned or outdated URL may get a newer photo soon, so cache it briefly
      "Cache-Control": request.nextUrl.searchParams.get("v") === avatar.version ? VERSIONED_CACHE : SHORT_CACHE,
    }
    if (matchesEtag(request.headers.get("if-none-match"), etag)) {
      return new NextResponse(null, { status: 304, headers })
    }

    // Prisma returns a Buffer; copy it into a Uint8Array for the response body
    return new NextResponse(new Uint8Array(avatar.data), {
      status: 200,
      headers: { ...headers, "Content-Type": avatar.contentType, "X-Content-Type-Options": "nosniff" },
    })
  } catch (err) {
    console.error(`GET /api/artists/${id}/avatar failed:`, err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
