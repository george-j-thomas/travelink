import { NextResponse, type NextRequest } from "next/server"
import { getInviteStatus } from "@/lib/access"

// GET /api/invites/[code] — public: lets the register page say whether a link still works
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params
  try {
    return NextResponse.json({ status: await getInviteStatus(code) })
  } catch (err) {
    console.error("GET /api/invites/[code] failed:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
