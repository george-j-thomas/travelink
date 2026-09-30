import { NextResponse, type NextRequest } from "next/server"
import { EmailTakenError, InviteError, registerUser } from "@/lib/access"

// POST /api/auth/register — invite-only sign-up
export async function POST(request: NextRequest) {
  let body: { email?: unknown; password?: unknown; name?: unknown; inviteCode?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const email = typeof body.email === "string" ? body.email.trim() : ""
  const password = typeof body.password === "string" ? body.password : ""
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 100) : null
  const inviteCode = typeof body.inviteCode === "string" ? body.inviteCode : null

  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 },
    )
  }

  try {
    const user = await registerUser({ email, password, name, inviteCode })
    return NextResponse.json(
      { id: user.id, email: user.email, name: user.name },
      { status: 201 },
    )
  } catch (err) {
    if (err instanceof InviteError) {
      return NextResponse.json({ error: err.message, code: `invite_${err.status}` }, { status: 403 })
    }
    if (err instanceof EmailTakenError) {
      return NextResponse.json({ error: err.message }, { status: 409 })
    }
    console.error("POST /api/auth/register failed:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
