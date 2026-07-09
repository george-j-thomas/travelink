import { NextRequest, NextResponse } from "next/server"
import { requireSession } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { getJobProgress, cancelJob } from "@/lib/import-runner"

const STALE_THRESHOLD_MS = 10 * 60 * 1000 // 10 minutes

// GET /api/import/[id] — Poll import job progress
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let session
  try {
    session = await requireSession()
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  // Fast path: in-memory progress
  const progress = getJobProgress(id)
  if (progress) {
    return NextResponse.json({ id, ...progress })
  }

  // Fallback: DB lookup (server may have restarted)
  try {
    const job = await prisma.importJob.findUnique({ where: { id } })

    if (!job || job.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    // Detect stale "processing" jobs
    let status = job.status
    let errors: { handle: string; error: string }[] = []

    try {
      errors = job.errors ? JSON.parse(job.errors) : []
    } catch {
      errors = []
    }

    if (
      status === "processing" &&
      Date.now() - job.updatedAt.getTime() > STALE_THRESHOLD_MS
    ) {
      status = "failed"
      const staleError = "Import was interrupted. Please try again."
      errors.push({ handle: "unknown", error: staleError })

      await prisma.importJob.update({
        where: { id },
        data: { status: "failed", errors: JSON.stringify(errors) },
      })
    }

    return NextResponse.json({
      id: job.id,
      status,
      total: job.totalHandles,
      completed: job.completed,
      failed: job.failed,
      skipped: job.skipped,
      errors,
      currentHandle: null,
    })
  } catch (err) {
    console.error("GET /api/import/[id] failed:", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// DELETE /api/import/[id] — Cancel an import job
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSession()
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  cancelJob(id)

  return NextResponse.json({ cancelled: true })
}
