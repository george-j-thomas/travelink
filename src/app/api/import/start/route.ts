import { NextRequest, NextResponse } from "next/server"
import { requireSession } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { failStaleJob, isStaleJob } from "@/lib/import-runner"

const MAX_HANDLES = 2000
const VALID_SOURCES = new Set(["upload", "scrape"])

// POST /api/import/start — Create a bulk import job.
// The client then drives it via POST /api/import/[id]/next.
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

  const { handles: rawHandles, source } = body as {
    handles?: unknown
    source?: unknown
  }

  if (
    !Array.isArray(rawHandles) ||
    rawHandles.length === 0 ||
    !rawHandles.every((h) => typeof h === "string")
  ) {
    return NextResponse.json(
      { error: "handles must be a non-empty array of strings" },
      { status: 400 }
    )
  }

  if (typeof source !== "string" || !VALID_SOURCES.has(source)) {
    return NextResponse.json(
      { error: 'source must be "upload" or "scrape"' },
      { status: 400 }
    )
  }

  const handles = rawHandles.slice(0, MAX_HANDLES) as string[]
  const userId = session.user.id

  try {
    // Check for existing in-progress job
    const existingJob = await prisma.importJob.findFirst({
      where: { userId, status: { in: ["pending", "processing"] } },
    })

    // A job abandoned mid-import (tab closed) shouldn't block new imports
    if (existingJob && isStaleJob(existingJob)) {
      await failStaleJob(existingJob)
    } else if (existingJob) {
      return NextResponse.json(
        { error: "An import is already in progress" },
        { status: 409 }
      )
    }

    // Pre-fetch handles already tracked by this user
    const existingArtists = await prisma.userArtist.findMany({
      where: { userId },
      include: { artist: { select: { instagramHandle: true } } },
    })
    const existingHandles = new Set(
      existingArtists.map((ua) => ua.artist.instagramHandle)
    )

    // Create import job
    const job = await prisma.importJob.create({
      data: {
        userId,
        status: "pending",
        source,
        totalHandles: handles.length,
        handles: JSON.stringify(handles),
      },
    })

    return NextResponse.json(
      {
        jobId: job.id,
        total: handles.length,
        alreadyTracked: handles.filter((h) =>
          existingHandles.has(h.toLowerCase())
        ).length,
      },
      { status: 201 }
    )
  } catch (err) {
    console.error("POST /api/import/start failed:", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
