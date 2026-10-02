import { NextRequest, NextResponse } from "next/server"
import { requireSession } from "@/lib/auth"
import { refreshAllArtistBios } from "@/lib/artist-pipeline"
import { BusinessDiscoveryConfigError } from "@/lib/instagram"

// POST /api/artists/refresh-all — Put all of the user's artists back in the bio
// queue, which fetches their bios afterwards. Body (optional): { includeRecent?: boolean }.
// Without includeRecent, artists whose bio was fetched in the last 72 hours are skipped.
// Returns { queuedIds }: the artists now waiting for a bio.
export async function POST(request: NextRequest) {
  let session
  try {
    session = await requireSession()
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: unknown = {}
  const text = await request.text()
  if (text.trim()) {
    try {
      body = JSON.parse(text)
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }
  }
  const includeRecent = (body as { includeRecent?: unknown } | null)?.includeRecent === true

  try {
    return NextResponse.json(await refreshAllArtistBios(session.user.id, { includeRecent }))
  } catch (err) {
    if (err instanceof BusinessDiscoveryConfigError) {
      return NextResponse.json({ error: err.message }, { status: 503 })
    }
    console.error("POST /api/artists/refresh-all failed:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
