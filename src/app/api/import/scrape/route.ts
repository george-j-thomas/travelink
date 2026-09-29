import { NextRequest, NextResponse } from "next/server"
import { requireSession } from "@/lib/auth"
import {
  scrapeFollowing,
  ScraperAuthError,
  ScraperRateLimitError,
} from "@/lib/instagram-scraper"

// Paginating a large following list with courtesy delays can take a while
export const maxDuration = 300

// POST /api/import/scrape — Fetch following list using Instagram session cookie
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
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    )
  }

  const { sessionId } = body as { sessionId?: unknown }

  if (!sessionId || typeof sessionId !== "string" || sessionId.trim().length === 0) {
    return NextResponse.json(
      { error: "sessionId is required and must be a non-empty string" },
      { status: 400 }
    )
  }

  try {
    const handles = await scrapeFollowing({
      sessionId,
      userAgent: request.headers.get("user-agent") ?? undefined,
    })
    return NextResponse.json({ handles, count: handles.length })
  } catch (err) {
    if (err instanceof ScraperAuthError) {
      return NextResponse.json({ error: err.message }, { status: 401 })
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
