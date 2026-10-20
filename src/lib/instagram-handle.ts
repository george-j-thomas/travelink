// Instagram handle rules and profile-link parsing, shared by the server and the Add page.
// Client components import this, so keep it free of server-only imports.

const MAX_HANDLE_LENGTH = 30
const HANDLE_REGEX = /^[a-z0-9._]{1,30}$/

const INSTAGRAM_HOSTS = new Set(["instagram.com", "www.instagram.com", "m.instagram.com"])

/** First path segments of Instagram pages that aren't profiles (posts, reels, stories, settings…). */
const NON_PROFILE_PATHS = new Set([
  "p",
  "reel",
  "reels",
  "tv",
  "stories",
  "s",
  "share",
  "explore",
  "direct",
  "accounts",
  "about",
  "legal",
  "privacy",
  "terms",
  "developer",
  "web",
  "api",
  "challenge",
  "emails",
  "oauth",
  "directory",
  "your_activity",
  "notifications",
  "create",
  "session",
  "push",
  "archive",
  "download",
  "ar",
])

const NOT_INSTAGRAM_LINK = "That isn't an Instagram link. Enter a handle, or paste a link to the artist's profile."
const NOT_PROFILE_LINK = "That link isn't to an Instagram profile. Open the artist's profile and copy its link."

export type ParsedHandle = { ok: true; handle: string } | { ok: false; error: string }

export function normalizeHandle(raw: string): string {
  return raw.trim().replace(/^@+/, "").trim().toLowerCase()
}

export function isValidHandle(handle: string): boolean {
  return HANDLE_REGEX.test(handle)
}

/** Handles never contain `/`, so input with one (or an Instagram domain) is meant as a link. */
export function looksLikeLink(raw: string): boolean {
  return raw.includes("/") || /instagram\.com/i.test(raw)
}

/**
 * The handle in a link to an Instagram profile: `instagram.com/<handle>`, with or
 * without `https://`, `www.` or `m.`, a trailing slash, more path (a profile tab)
 * or a query string (share links add `?igsh=…`, QR codes `?utm_source=qr`).
 */
export function parseProfileLink(raw: string): ParsedHandle {
  const text = raw.trim()
  let url: URL
  try {
    url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(text) ? text : `https://${text.replace(/^\/+/, "")}`)
  } catch {
    return { ok: false, error: NOT_INSTAGRAM_LINK }
  }
  if ((url.protocol !== "https:" && url.protocol !== "http:") || !INSTAGRAM_HOSTS.has(url.hostname)) {
    return { ok: false, error: NOT_INSTAGRAM_LINK }
  }

  const segments = url.pathname.split("/").filter(Boolean)
  // instagram.com/_u/<handle> opens the profile in the app
  const first = segments[0] === "_u" ? segments[1] : segments[0]
  const handle = first?.replace(/^@/, "").toLowerCase()
  if (!handle || NON_PROFILE_PATHS.has(handle) || !isValidHandle(handle)) {
    return { ok: false, error: NOT_PROFILE_LINK }
  }
  return { ok: true, handle }
}

/** What the user typed or pasted to add an artist: `handle`, `@handle` or a link to the profile. */
export function parseHandleInput(raw: string): ParsedHandle {
  const text = raw.trim()
  if (looksLikeLink(text)) return parseProfileLink(text)

  const handle = normalizeHandle(text)
  if (!handle) return { ok: false, error: "Please enter an Instagram handle or profile link" }
  if (handle.length > MAX_HANDLE_LENGTH) {
    return { ok: false, error: `Handle is too long (max ${MAX_HANDLE_LENGTH} characters)` }
  }
  if (!isValidHandle(handle)) {
    return { ok: false, error: "Handles can only contain letters, numbers, periods, and underscores" }
  }
  return { ok: true, handle }
}
