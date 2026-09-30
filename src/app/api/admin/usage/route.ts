import { NextResponse } from "next/server"
import { ForbiddenError, requireAdmin } from "@/lib/auth"
import { getTodayUsage } from "@/lib/usage"

// GET /api/admin/usage — today's global API usage vs daily caps
export async function GET() {
  try {
    await requireAdmin()
  } catch (err) {
    return err instanceof ForbiddenError
      ? NextResponse.json({ error: "Forbidden" }, { status: 403 })
      : NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    return NextResponse.json(await getTodayUsage())
  } catch (err) {
    console.error("GET /api/admin/usage failed:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
