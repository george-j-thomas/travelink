import { NextRequest, NextResponse } from "next/server"
import { requireSession } from "@/lib/auth"
import {
  assertCookieOwner,
  scrapeFollowing,
  ScraperAuthError,
  ScraperRateLimitError,
} from "@/lib/instagram-scraper"

// Paginating a large following list with courtesy delays can take a while
export const maxDuration = 300

// POST /api/import/scrape — Fetch following list using Instagram session cookie
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

  const { sessionId, ownerId } = body as { sessionId?: unknown; ownerId?: unknown }

  if (!sessionId || typeof sessionId !== "string" || sessionId.trim().length === 0) {
    return NextResponse.json(
      { error: "sessionId is required and must be a non-empty string" },
      { status: 400 }
    )
  }

  try {
    assertCookieOwner(ownerId, session.user.id)
    const accounts = await scrapeFollowing({
      sessionId,
      userAgent: request.headers.get("user-agent") ?? undefined,
    })
    return NextResponse.json({ accounts, count: accounts.length })
  } catch (err) {
    // 403, not 401: the Instagram cookie was rejected, not the travel-ink session
    if (err instanceof ScraperAuthError) {
      return NextResponse.json({ error: err.message, code: "instagram_session" }, { status: 403 })
    }
    if (err instanceof ScraperRateLimitError) {
      return NextResponse.json({ error: err.message }, { status: 429 })
    }
    console.error("POST /api/import/scrape failed:", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
