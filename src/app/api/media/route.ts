import { NextResponse } from "next/server"
import { requireSession } from "@/lib/auth"
import { getUserMediaFeed } from "@/lib/media-pipeline"

// GET /api/media — Recent Instagram posts across the current user's artists.
export async function GET() {
  let session
  try {
    session = await requireSession()
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const posts = await getUserMediaFeed(session.user.id)
    return NextResponse.json(posts, {
      headers: { "Cache-Control": "no-store" },
    })
  } catch (err) {
    console.error("GET /api/media failed:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
