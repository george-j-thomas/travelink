import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth-options"

/** Get the current session, or null if not authenticated. */
export async function getSession() {
  return getServerSession(authOptions)
}

/** Get the current session, or throw if not authenticated. Use in protected API routes. */
export async function requireSession() {
  const session = await getServerSession(authOptions)
  if (!session) {
    throw new Error("Unauthorized: no active session")
  }
  return session
}
