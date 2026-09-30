import { NextResponse, type NextRequest } from "next/server"
import { ForbiddenError, requireAdmin } from "@/lib/auth"
import { setUserDisabled } from "@/lib/access"

// PATCH /api/admin/users/[id] — { disabled: boolean }
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin()
  } catch (err) {
    return err instanceof ForbiddenError
      ? NextResponse.json({ error: "Forbidden" }, { status: 403 })
      : NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: { disabled?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }
  if (typeof body.disabled !== "boolean") {
    return NextResponse.json({ error: "disabled must be a boolean" }, { status: 400 })
  }

  const { id } = await params
  try {
    if (!(await setUserDisabled(id, body.disabled))) {
      return NextResponse.json(
        { error: "User not found, or is an admin (admins can't be disabled)" },
        { status: 404 },
      )
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("PATCH /api/admin/users/[id] failed:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
