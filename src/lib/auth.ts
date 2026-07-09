import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth-options"

const DEV_SESSION = {
  user: { id: "dev-user", email: "dev@travelink.app", name: "Dev User" },
  expires: "",
} as const

/** Create the dev user in the database if it doesn't exist yet. */
async function ensureDevUser() {
  const { prisma } = await import("@/lib/db")
  await prisma.user.upsert({
    where: { id: "dev-user" },
    create: {
      id: "dev-user",
      email: "dev@travelink.app",
      name: "Dev User",
    },
    update: {},
  })
}

/** Get the current session, or null if not authenticated. */
export async function getSession() {
  if (process.env.DEV_AUTH_BYPASS === "true") {
    await ensureDevUser()
    return DEV_SESSION
  }
  return getServerSession(authOptions)
}

/** Get the current session, or throw if not authenticated. Use in protected API routes. */
export async function requireSession() {
  if (process.env.DEV_AUTH_BYPASS === "true") {
    await ensureDevUser()
    return DEV_SESSION
  }
  const session = await getServerSession(authOptions)
  if (!session) {
    throw new Error("Unauthorized: no active session")
  }
  return session
}
