import { NextResponse } from "next/server"
import { requireSession } from "@/lib/auth"
import {
  countPendingArtists,
  processNextPendingArtist,
} from "@/lib/artist-pipeline"
import {
  BusinessDiscoveryConfigError,
  isBusinessDiscoveryConfigured,
  RateLimitError,
} from "@/lib/instagram"

// One Instagram lookup + Claude parse + a few geocodes
export const maxDuration = 60

/** Slow down as Meta's reported usage for the token climbs (~200 calls/hour). */
function delayForUsage(usagePercent: number): number {
  if (usagePercent < 50) return 1_500
  if (usagePercent < 75) return 6_000
  if (usagePercent < 90) return 20_000
  return 60_000
}

// POST /api/artists/fetch-next — Fetch the bio of the user's next pending artist.
// The browser calls this in a loop, waiting `nextDelayMs` between calls. All
// queue state is in the DB, so stopping (navigating away) loses nothing.
export async function POST() {
  let session
  try {
    session = await requireSession()
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const userId = session.user.id

  try {
    if (!isBusinessDiscoveryConfigured()) {
      return NextResponse.json({
        status: "not_configured",
        remaining: await countPendingArtists(userId),
        message: "Instagram bio lookup isn't set up yet.",
      })
    }

    const { artist, outcome, usagePercent } = await processNextPendingArtist(userId)
    const remaining = await countPendingArtists(userId)

    if (!artist) {
      // Nothing claimable: either done, or another tab holds the remaining claims
      return NextResponse.json({
        status: remaining > 0 ? "busy" : "idle",
        remaining,
        nextDelayMs: remaining > 0 ? 30_000 : null,
      })
    }

    return NextResponse.json({
      status: "processed",
      outcome,
      artist,
      remaining,
      nextDelayMs: outcome === "skipped" ? 0 : delayForUsage(usagePercent),
    })
  } catch (err) {
    if (err instanceof RateLimitError) {
      return NextResponse.json({
        status: "rate_limited",
        remaining: await countPendingArtists(userId),
        retryAfterMs: err.retryAfterMs,
        message: err.message,
      })
    }
    if (err instanceof BusinessDiscoveryConfigError) {
      console.error("Business Discovery config error:", err.message)
      return NextResponse.json({
        status: "not_configured",
        remaining: await countPendingArtists(userId),
        message: "Instagram bio lookup is misconfigured (the access token may have expired).",
      })
    }
    console.error("POST /api/artists/fetch-next failed:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
