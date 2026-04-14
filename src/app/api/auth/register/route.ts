import { NextResponse } from "next/server"
import { hash } from "bcryptjs"
import { prisma } from "@/lib/db"

export async function POST(request: Request) {
  const body = await request.json()
  const { email, password, name } = body as {
    email?: string
    password?: string
    name?: string
  }

  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 })
  }

  if (!password || password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 },
    )
  }

  const existingUser = await prisma.user.findUnique({ where: { email } })
  if (existingUser) {
    return NextResponse.json(
      { error: "A user with this email already exists" },
      { status: 409 },
    )
  }

  const passwordHash = await hash(password, 12)

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      name: name || null,
    },
  })

  return NextResponse.json(
    { id: user.id, email: user.email, name: user.name },
    { status: 201 },
  )
}
