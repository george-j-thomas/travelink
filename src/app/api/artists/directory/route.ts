import { NextRequest, NextResponse } from "next/server"
import { requireSession } from "@/lib/auth"
import {
  DIRECTORY_QUERY_MAX_LENGTH,
  DIRECTORY_QUERY_MIN_LENGTH,
  normalizeDirectoryQuery,
  searchArtistDirectory,
} from "@/lib/artist-directory"

// GET /api/artists/directory?q= — Typeahead over artists already in travel-ink:
// the user's own matches (onList: true), then public Business/Creator accounts
// other users have added. No Instagram calls, so no cookie or budget needed.
export async function GET(request: NextRequest) {
  let session
  try {
    session = await requireSession()
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const query = normalizeDirectoryQuery(request.nextUrl.searchParams.get("q") ?? "")
  if (query.length < DIRECTORY_QUERY_MIN_LENGTH || query.length > DIRECTORY_QUERY_MAX_LENGTH) {
    return NextResponse.json(
      { error: `q is required (${DIRECTORY_QUERY_MIN_LENGTH}–${DIRECTORY_QUERY_MAX_LENGTH} characters)` },
      { status: 400 }
    )
  }

  try {
    const artists = await searchArtistDirectory(session.user.id, query)
    return NextResponse.json({ artists })
  } catch (err) {
    console.error("GET /api/artists/directory failed:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
