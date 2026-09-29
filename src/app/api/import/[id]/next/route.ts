import { NextRequest, NextResponse } from "next/server"
import { requireSession } from "@/lib/auth"
import { ImportJobNotFoundError, processNextHandle } from "@/lib/import-runner"

// One artist = Instagram fetch + Claude parse + geocoding; well under a minute
export const maxDuration = 60

// POST /api/import/[id]/next — Process the next handle of an import job.
// The client calls this in a loop, waiting `nextDelayMs` between calls.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let session
  try {
    session = await requireSession()
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  let body: { sessionId?: unknown; retry?: unknown } = {}
  try {
    body = await request.json()
  } catch {
    // Empty body is fine — no cookie, first attempt
  }

  const sessionId =
    typeof body.sessionId === "string" && body.sessionId.trim()
      ? body.sessionId.trim()
      : undefined
  const scraper = sessionId
    ? { sessionId, userAgent: request.headers.get("user-agent") ?? undefined }
    : undefined

  try {
    const result = await processNextHandle(id, session.user.id, scraper, body.retry === true)
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof ImportJobNotFoundError) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    console.error("POST /api/import/[id]/next failed:", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
