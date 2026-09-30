import { NextRequest, NextResponse } from "next/server"
import { requireSession } from "@/lib/auth"
import {
  searchUsers,
  ScraperAuthError,
  ScraperRateLimitError,
} from "@/lib/instagram-scraper"

// POST /api/instagram/search — Account typeahead via the user's Instagram cookie.
// POST (not GET) keeps the cookie out of URLs and access logs.
export async function POST(request: NextRequest) {
  try {
    await requireSession()
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const { query, sessionId } = body as { query?: unknown; sessionId?: unknown }

  if (typeof query !== "string" || query.trim().length === 0 || query.length > 60) {
    return NextResponse.json(
      { error: "query is required (1–60 characters)" },
      { status: 400 }
    )
  }
  if (typeof sessionId !== "string" || sessionId.trim().length === 0) {
    return NextResponse.json(
      { error: "sessionId is required and must be a non-empty string" },
      { status: 400 }
    )
  }

  try {
    const users = await searchUsers(query, {
      sessionId,
      userAgent: request.headers.get("user-agent") ?? undefined,
    })
    return NextResponse.json({ users })
  } catch (err) {
    // 403, not 401: the Instagram cookie was rejected, not the Travelink session
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
