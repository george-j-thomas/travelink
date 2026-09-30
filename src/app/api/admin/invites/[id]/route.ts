import { NextResponse, type NextRequest } from "next/server"
import { ForbiddenError, requireAdmin } from "@/lib/auth"
import { revokeInvite } from "@/lib/access"

// DELETE /api/admin/invites/[id] — revoke an unused invite
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin()
  } catch (err) {
    return err instanceof ForbiddenError
      ? NextResponse.json({ error: "Forbidden" }, { status: 403 })
      : NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  try {
    if (!(await revokeInvite(id))) {
      return NextResponse.json({ error: "Invite not found or already used" }, { status: 404 })
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("DELETE /api/admin/invites/[id] failed:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
