import { NextRequest, NextResponse } from "next/server"
import { requireSession } from "@/lib/auth"
import { RateLimitError } from "@/lib/instagram"
import {
  isProviderConfigured,
  ProviderConfigError,
  searchProviderAccounts,
} from "@/lib/instagram-provider"
import {
  searchUsers,
  ScraperAuthError,
  ScraperRateLimitError,
} from "@/lib/instagram-scraper"
import { BudgetExceededError, reserveUsage } from "@/lib/usage"

const MIN_QUERY = 2
const MAX_QUERY = 60

// GET /api/instagram/search — Whether search works without an Instagram cookie.
export async function GET() {
  try {
    await requireSession()
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  return NextResponse.json({ provider: isProviderConfigured() })
}

// POST /api/instagram/search — Account typeahead. Uses the paid provider when
// configured (budgeted), otherwise — or if it fails — the user's own cookie.
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

  const { query, sessionId } = body as { query?: unknown; sessionId?: unknown }
  const q = typeof query === "string" ? query.trim().replace(/^@+/, "").trim() : ""

  if (q.length < MIN_QUERY || q.length > MAX_QUERY) {
    return NextResponse.json(
      { error: `query is required (${MIN_QUERY}–${MAX_QUERY} characters)` },
      { status: 400 }
    )
  }
  const cookie = typeof sessionId === "string" && sessionId.trim() ? sessionId : null

  if (isProviderConfigured()) {
    try {
      await reserveUsage("search", session.user.id)
      return NextResponse.json({ users: await searchProviderAccounts(q), source: "provider" })
    } catch (err) {
      if (err instanceof ProviderConfigError) console.error("HikerAPI config error:", err.message)
      else if (!(err instanceof BudgetExceededError)) console.error("Provider search failed:", err)

      if (!cookie) {
        if (err instanceof BudgetExceededError) {
          return NextResponse.json({ error: err.message, code: "search_limit" }, { status: 429 })
        }
        if (err instanceof RateLimitError) {
          return NextResponse.json({ error: "Search is busy. Try again in a minute." }, { status: 429 })
        }
        return NextResponse.json({ error: "Search is unavailable right now." }, { status: 503 })
      }
      // Fall through to the user's own cookie
    }
  }

  if (!cookie) {
    return NextResponse.json(
      { error: "Search needs an Instagram connection.", code: "search_unavailable" },
      { status: 400 }
    )
  }

  try {
    const users = await searchUsers(q, {
      sessionId: cookie,
      userAgent: request.headers.get("user-agent") ?? undefined,
    })
    return NextResponse.json({ users, source: "cookie" })
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
