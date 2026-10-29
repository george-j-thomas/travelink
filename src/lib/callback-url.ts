// Where to send a user after signing in: back to the page they asked for, if it's on travel-ink.
// The login page runs this in the browser, so keep it free of server-only imports.

const FALLBACK_PATH = "/map"

// Sending a signed-in user back to these would loop
const SIGN_IN_PATHS = ["/login", "/register"]

/**
 * The path (with query string and hash) to go to after signing in: `callbackUrl` when
 * it's a page on `origin`, else `/map`. Takes a relative path (`/artists/add?handle=x`)
 * or an absolute URL on `origin` (older links, NextAuth's own redirects). Other origins
 * (including protocol-relative `//x` and backslash `/\x` URLs), schemes other than
 * http(s) and the sign-in pages themselves fall back to `/map`.
 */
export function safeCallbackPath(callbackUrl: string | null | undefined, origin: string): string {
  if (!callbackUrl?.trim()) return FALLBACK_PATH

  let base: URL
  let url: URL
  try {
    base = new URL(origin)
    // Resolved the way the browser would follow it: `//x` and `/\x` point to another host
    url = new URL(callbackUrl, base.origin)
  } catch {
    return FALLBACK_PATH
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") return FALLBACK_PATH
  if (url.origin !== base.origin) return FALLBACK_PATH
  // `https://<site>//x` is on the site, but its path alone would read as another host
  if (url.pathname.startsWith("//")) return FALLBACK_PATH

  const path = url.pathname.toLowerCase()
  if (SIGN_IN_PATHS.some((page) => path === page || path.startsWith(`${page}/`))) {
    return FALLBACK_PATH
  }

  return `${url.pathname}${url.search}${url.hash}`
}
