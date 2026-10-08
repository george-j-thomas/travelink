"use client"

import { useCallback, useEffect, useSyncExternalStore } from "react"
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import { useCurrentUserId } from "@/hooks/use-current-user-id"

// The Instagram cookie is a full login to the user's Instagram account, so it
// is only held in this tab's memory (never localStorage or sessionStorage),
// for the travel-ink user who pasted it. Reloading or closing the tab drops it,
// and so do signing out, the session ending and the sign-in pages. It is sent
// with each request that needs it and never stored server-side.

// Older builds kept it in localStorage, shared by every account in the browser
const LEGACY_STORAGE_KEY = "travelink.instagramSessionId"
const SIGN_IN_PATHS = new Set(["/login", "/register"])

let stored: { userId: string; value: string } | null = null
const listeners = new Set<() => void>()

function set(next: typeof stored) {
  // On the server this module is shared by every request — never hold it there
  if (typeof window === "undefined") return
  stored = next
  listeners.forEach((notify) => notify())
}

function subscribe(notify: () => void) {
  listeners.add(notify)
  return () => {
    listeners.delete(notify)
  }
}

/** Drops the cookie right away (e.g. on sign-out). */
export function forgetInstagramCookie() {
  if (stored) set(null)
}

/**
 * Drops the cookie when the travel-ink session ends (including sign-out in
 * another tab) or another user signs in. Mount once, in the root providers.
 */
export function useInstagramCookieGuard() {
  const { status } = useSession()
  const userId = useCurrentUserId()
  const onSignInPage = SIGN_IN_PATHS.has(usePathname())

  useEffect(() => {
    try {
      localStorage.removeItem(LEGACY_STORAGE_KEY)
    } catch {
      // Storage unavailable — nothing was saved there
    }
  }, [])

  useEffect(() => {
    // Reaching a sign-in page means the session is over even if this tab hasn't
    // noticed yet (API 401s redirect there), or someone is switching accounts
    const sessionOver = onSignInPage || (status !== "loading" && stored?.userId !== userId)
    if (sessionOver) forgetInstagramCookie()
  }, [onSignInPage, status, userId])
}

export function useInstagramCookie() {
  const userId = useCurrentUserId()
  const cookie = useSyncExternalStore(
    subscribe,
    () => (stored && stored.userId === userId ? stored.value : ""),
    () => ""
  )
  const save = useCallback(
    (value: string) => {
      const trimmed = value.trim()
      set(trimmed && userId ? { userId, value: trimmed } : null)
    },
    [userId]
  )
  return { cookie, save, clear: forgetInstagramCookie }
}
