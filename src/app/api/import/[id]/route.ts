import { NextRequest, NextResponse } from "next/server"
import { requireSession } from "@/lib/auth"
import {
  cancelImportJob,
  getImportJob,
  ImportJobNotFoundError,
} from "@/lib/import-runner"

// GET /api/import/[id] — Get import job progress
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

  try {
    const job = await getImportJob(id, session.user.id)
    return NextResponse.json(job)
  } catch (err) {
    if (err instanceof ImportJobNotFoundError) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
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
  let session
  try {
    session = await requireSession()
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  try {
    const job = await cancelImportJob(id, session.user.id)
    return NextResponse.json(job)
  } catch (err) {
    if (err instanceof ImportJobNotFoundError) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    console.error("DELETE /api/import/[id] failed:", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
