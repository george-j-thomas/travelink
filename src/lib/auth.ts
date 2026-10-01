import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth-options"
import { DEV_AUTH_BYPASS, DEV_USER_ID } from "@/lib/dev-auth"

const DEV_SESSION = {
  user: { id: DEV_USER_ID, email: "dev@travelink.app", name: "Dev User", isAdmin: true },
  expires: "",
} as const

export class ForbiddenError extends Error {
  constructor(message = "Forbidden") {
    super(message)
    this.name = "ForbiddenError"
  }
}

/** Create the dev user in the database if it doesn't exist yet. */
async function ensureDevUser() {
  const { prisma } = await import("@/lib/db")
  await prisma.user.upsert({
    where: { id: DEV_USER_ID },
    create: {
      id: DEV_USER_ID,
      email: "dev@travelink.app",
      name: "Dev User",
    },
    update: {},
  })
}

/** Get the current session, or null if not authenticated. */
export async function getSession() {
  if (DEV_AUTH_BYPASS) {
    await ensureDevUser()
    return DEV_SESSION
  }
  return getServerSession(authOptions)
}

/** Get the current session, or throw if not authenticated. Use in protected API routes. */
export async function requireSession() {
  if (DEV_AUTH_BYPASS) {
    await ensureDevUser()
    return DEV_SESSION
  }
  const session = await getServerSession(authOptions)
  if (!session) {
    throw new Error("Unauthorized: no active session")
  }
  // JWTs outlive account changes, so check the user still exists and isn't disabled
  const { prisma } = await import("@/lib/db")
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { disabledAt: true },
  })
  if (!user || user.disabledAt) {
    throw new Error("Unauthorized: account disabled")
  }
  return session
}

/**
 * Like requireSession, but also requires an admin (ADMIN_EMAILS).
 * @throws {ForbiddenError} signed in but not an admin — map to 403
 */
export async function requireAdmin() {
  const session = await requireSession()
  if (!session.user.isAdmin) throw new ForbiddenError()
  return session
}
