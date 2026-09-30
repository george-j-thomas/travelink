import { NextResponse, type NextRequest } from "next/server"
import { ForbiddenError, requireAdmin } from "@/lib/auth"
import { createInvite, listInvites } from "@/lib/access"

// GET /api/admin/invites — all invites, newest first
export async function GET() {
  try {
    await requireAdmin()
  } catch (err) {
    return err instanceof ForbiddenError
      ? NextResponse.json({ error: "Forbidden" }, { status: 403 })
      : NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  try {
    return NextResponse.json(await listInvites())
  } catch (err) {
    console.error("GET /api/admin/invites failed:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST /api/admin/invites — { note?, expiresInDays? } → new invite
export async function POST(request: NextRequest) {
  let session
  try {
    session = await requireAdmin()
  } catch (err) {
    return err instanceof ForbiddenError
      ? NextResponse.json({ error: "Forbidden" }, { status: 403 })
      : NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: { note?: unknown; expiresInDays?: unknown } = {}
  try {
    body = await request.json()
  } catch {
    // Empty body is fine — defaults apply
  }

  try {
    const invite = await createInvite(session.user.id, {
      note: typeof body.note === "string" ? body.note : null,
      expiresInDays: typeof body.expiresInDays === "number" ? body.expiresInDays : undefined,
    })
    return NextResponse.json(
      { id: invite.id, code: invite.code, expiresAt: invite.expiresAt.toISOString() },
      { status: 201 },
    )
  } catch (err) {
    console.error("POST /api/admin/invites failed:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
