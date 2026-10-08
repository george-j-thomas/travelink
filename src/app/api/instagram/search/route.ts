import { NextRequest, NextResponse } from "next/server"
import { requireSession } from "@/lib/auth"
import {
  assertCookieOwner,
  searchUsers,
  ScraperAuthError,
  ScraperRateLimitError,
} from "@/lib/instagram-scraper"

const MIN_QUERY = 2
const MAX_QUERY = 60

// POST /api/instagram/search — Account typeahead via the user's Instagram cookie.
// POST (not GET) keeps the cookie out of URLs and access logs.
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

  const { query, sessionId, ownerId } = body as {
    query?: unknown
    sessionId?: unknown
    ownerId?: unknown
  }
  const q = typeof query === "string" ? query.trim().replace(/^@+/, "").trim() : ""

  if (q.length < MIN_QUERY || q.length > MAX_QUERY) {
    return NextResponse.json(
      { error: `query is required (${MIN_QUERY}–${MAX_QUERY} characters)` },
      { status: 400 }
    )
  }
  const cookie = typeof sessionId === "string" && sessionId.trim() ? sessionId : null

  if (!cookie) {
    return NextResponse.json(
      { error: "Search needs an Instagram connection.", code: "search_unavailable" },
      { status: 400 }
    )
  }

  try {
    assertCookieOwner(ownerId, session.user.id)
    const users = await searchUsers(q, {
      sessionId: cookie,
      userAgent: request.headers.get("user-agent") ?? undefined,
    })
    return NextResponse.json({ users })
  } catch (err) {
    // 403, not 401: the Instagram cookie was rejected, not the travel-ink session
    if (err instanceof ScraperAuthError) {
      return NextResponse.json({ error: err.message, code: "instagram_session" }, { status: 403 })
    }
    if (err instanceof ScraperRateLimitError) {
      return NextResponse.json({ error: err.message }, { status: 429 })
    }
    console.error("POST /api/instagram/search failed:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
