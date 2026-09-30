import { NextRequest, NextResponse } from "next/server"
import { requireSession } from "@/lib/auth"
import { MAX_TRACK_BATCH, trackArtists, type ArtistHint } from "@/lib/artist-pipeline"

function toHint(value: unknown): ArtistHint | null {
  if (typeof value === "string") return { username: value }
  if (!value || typeof value !== "object") return null
  const v = value as Record<string, unknown>
  if (typeof v.username !== "string") return null
  return {
    username: v.username,
    fullName: typeof v.fullName === "string" ? v.fullName : null,
    profilePicUrl: typeof v.profilePicUrl === "string" ? v.profilePicUrl : null,
  }
}

// POST /api/artists/bulk — Save selected accounts to the user's list right away.
// No Instagram calls: bios are fetched later by POST /api/artists/fetch-next.
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
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const raw = (body as { accounts?: unknown } | null)?.accounts
  if (!Array.isArray(raw) || raw.length === 0) {
    return NextResponse.json(
      { error: "accounts must be a non-empty array" },
      { status: 400 }
    )
  }
  if (raw.length > MAX_TRACK_BATCH) {
    return NextResponse.json(
      { error: `At most ${MAX_TRACK_BATCH} accounts can be added at once` },
      { status: 400 }
    )
  }

  const hints = raw.map(toHint)
  if (hints.some((h) => h === null)) {
    return NextResponse.json(
      { error: "Each account must be a username string or { username, fullName?, profilePicUrl? }" },
      { status: 400 }
    )
  }

  try {
    const result = await trackArtists(session.user.id, hints as ArtistHint[])
    return NextResponse.json(result, { status: 201 })
  } catch (err) {
    console.error("POST /api/artists/bulk failed:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
