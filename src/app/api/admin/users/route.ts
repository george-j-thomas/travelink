import { NextResponse } from "next/server"
import { ForbiddenError, requireAdmin } from "@/lib/auth"
import { listUsers } from "@/lib/access"

// GET /api/admin/users — all users with who invited them
export async function GET() {
  try {
    await requireAdmin()
  } catch (err) {
    return err instanceof ForbiddenError
      ? NextResponse.json({ error: "Forbidden" }, { status: 403 })
      : NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    return NextResponse.json(await listUsers())
  } catch (err) {
    console.error("GET /api/admin/users failed:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
