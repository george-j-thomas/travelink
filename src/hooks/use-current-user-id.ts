"use client"

import { createContext, useContext } from "react"
import { useSession } from "next-auth/react"

/**
 * The dev user's ID when the dev auth bypass is on, else null. The server acts
 * as the dev user under the bypass whatever NextAuth says, so the root layout
 * passes this down.
 */
export const DevUserIdContext = createContext<string | null>(null)

/**
 * The travel-ink user the server acts as: the signed-in user, or the dev user
 * under the dev auth bypass. Null while loading or when signed out.
 */
export function useCurrentUserId(): string | null {
  const { data: session } = useSession()
  const devUserId = useContext(DevUserIdContext)
  return devUserId ?? session?.user?.id ?? null
}
