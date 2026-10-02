import { NextRequest, NextResponse } from "next/server"
import { requireSession } from "@/lib/auth"
import {
  ArtistNotFoundError,
  RecentlyRefreshedError,
  refreshArtistBio,
} from "@/lib/artist-pipeline"
import { BusinessDiscoveryConfigError } from "@/lib/instagram"

// One Instagram lookup + Claude parse + a few geocodes
export const maxDuration = 60

type RouteContext = { params: Promise<{ id: string }> }

// POST /api/artists/[id]/refresh — Fetch the artist's bio again now.
// Body (optional): { force?: boolean }. Without force, a bio fetched in the last
// 72 hours returns 409 `recently_refreshed` so the client can ask to confirm.
export async function POST(request: NextRequest, context: RouteContext) {
  let session
  try {
    session = await requireSession()
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await context.params

  let body: unknown = {}
  const text = await request.text()
  if (text.trim()) {
    try {
      body = JSON.parse(text)
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }
  }
  const force = (body as { force?: unknown } | null)?.force === true

  try {
    const result = await refreshArtistBio(session.user.id, id, { force })
    return NextResponse.json(result, { status: result.outcome === "queued" ? 202 : 200 })
  } catch (err) {
    if (err instanceof ArtistNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 })
    }
    if (err instanceof RecentlyRefreshedError) {
      return NextResponse.json(
        { error: err.message, code: "recently_refreshed", lastRefreshedAt: err.lastRefreshedAt },
        { status: 409 }
      )
    }
    if (err instanceof BusinessDiscoveryConfigError) {
      return NextResponse.json({ error: err.message }, { status: 503 })
    }
    console.error(`POST /api/artists/${id}/refresh failed:`, err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
