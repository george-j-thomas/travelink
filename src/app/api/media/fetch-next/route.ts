import { NextResponse } from "next/server"
import { requireSession } from "@/lib/auth"
import {
  countArtistsNeedingMedia,
  isMediaLookupConfigured,
  processNextArtistMedia,
} from "@/lib/media-pipeline"
import { BusinessDiscoveryConfigError, RateLimitError } from "@/lib/instagram"

// One Business Discovery media call + a handful of DB writes
export const maxDuration = 60

/** Slow down as Meta's reported usage for the token climbs (~200 calls/hour). */
function delayForUsage(usagePercent: number): number {
  if (usagePercent < 50) return 1_500
  if (usagePercent < 75) return 6_000
  if (usagePercent < 90) return 20_000
  return 60_000
}

// POST /api/media/fetch-next — Fetch recent posts for the user's next artist
// whose media is missing or stale. The browser calls this in a loop, waiting
// `nextDelayMs` between calls. All queue state is in the DB.
export async function POST() {
  let session
  try {
    session = await requireSession()
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const userId = session.user.id

  try {
    if (!isMediaLookupConfigured()) {
      return NextResponse.json({
        status: "not_configured",
        remaining: 0,
        message: "Instagram media lookup isn't set up yet.",
      })
    }

    const { handle, outcome, usagePercent } = await processNextArtistMedia(userId)
    const remaining = await countArtistsNeedingMedia(userId)

    if (!handle) {
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
      handle,
      remaining,
      nextDelayMs: outcome === "skipped" ? 0 : delayForUsage(usagePercent),
    })
  } catch (err) {
    if (err instanceof RateLimitError) {
      return NextResponse.json({
        status: "rate_limited",
        remaining: await countArtistsNeedingMedia(userId),
        retryAfterMs: err.retryAfterMs,
        message: err.message,
      })
    }
    if (err instanceof BusinessDiscoveryConfigError) {
      console.error("Media lookup config error:", err.message)
      return NextResponse.json({
        status: "not_configured",
        remaining: await countArtistsNeedingMedia(userId),
        message:
          "Instagram media lookup is misconfigured (the access token may have expired).",
      })
    }
    console.error("POST /api/media/fetch-next failed:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
