"use client"

import { useCallback, useSyncExternalStore } from "react"

// The Instagram cookie lives only in this browser. It is sent with each
// request that needs it and never stored server-side.
const STORAGE_KEY = "travelink.instagramSessionId"
const listeners = new Set<() => void>()

function read(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? ""
  } catch {
    return ""
  }
}

function write(value: string | null) {
  try {
    if (value) localStorage.setItem(STORAGE_KEY, value)
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Storage unavailable (private mode) — the cookie just isn't remembered
  }
  listeners.forEach((notify) => notify())
}

function subscribe(notify: () => void) {
  listeners.add(notify)
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) notify()
  }
  window.addEventListener("storage", onStorage)
  return () => {
    listeners.delete(notify)
    window.removeEventListener("storage", onStorage)
  }
}

export function useInstagramCookie() {
  const cookie = useSyncExternalStore(subscribe, read, () => "")
  const save = useCallback((value: string) => write(value.trim() || null), [])
  const clear = useCallback(() => write(null), [])
  return { cookie, save, clear }
}
