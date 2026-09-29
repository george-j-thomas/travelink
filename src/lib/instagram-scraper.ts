// Instagram Following Scraper
// Fetches a user's following list and artist profiles via Instagram's internal web API
// (the same endpoints instagram.com uses).
// Requires a `sessionid` cookie copied from the user's browser.
//
// SECURITY: The session ID is never logged or persisted — held in memory only.

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class ScraperAuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ScraperAuthError"
  }
}

export class ScraperRateLimitError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ScraperRateLimitError"
  }
}

// ---------------------------------------------------------------------------
// Credentials
// ---------------------------------------------------------------------------

export interface ScraperCredentials {
  /** The `sessionid` cookie value from the user's browser */
  sessionId: string
  /**
   * User-Agent of the browser the cookie was copied from. Requests should look
   * like they come from the same browser session that owns the cookie.
   */
  userAgent?: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// Same host + app ID the instagram.com web client uses, so requests are
// consistent with a browser-issued `sessionid` cookie.
const BASE_URL = "https://www.instagram.com/api/v1"
const WEB_APP_ID = "936619743392459"
const FALLBACK_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"

const PAGE_SIZE = 200
const PAGINATION_DELAY_MIN_MS = 1500
const PAGINATION_DELAY_MAX_MS = 3500
const MAX_HANDLES = 5000

const AUTH_ERROR_MESSAGE =
  "Session cookie is invalid or expired. Please copy a fresh sessionid from your browser."
const RATE_LIMIT_MESSAGE =
  "Instagram rate limit hit during scraping. Try again in a few minutes."

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildHeaders(cleanSessionId: string, userAgent?: string): Record<string, string> {
  return {
    "User-Agent": userAgent?.trim() || FALLBACK_USER_AGENT,
    Accept: "*/*",
    "Accept-Language": "en-US,en;q=0.9",
    Referer: "https://www.instagram.com/",
    Cookie: `sessionid=${cleanSessionId}`,
    "X-IG-App-ID": WEB_APP_ID,
    "X-Requested-With": "XMLHttpRequest",
  }
}

function cleanSessionId(raw: string): string {
  let cleaned = raw.trim()
  // Strip "sessionid=" prefix if the user pasted the full cookie
  if (cleaned.toLowerCase().startsWith("sessionid=")) {
    cleaned = cleaned.slice("sessionid=".length).trim()
  }
  if (!cleaned) {
    throw new ScraperAuthError("Session ID is empty. Please provide a valid sessionid cookie value.")
  }
  return cleaned
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function randomBetween(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min))
}

/**
 * Instagram signals throttling as a 401 "Please wait a few minutes" as well as
 * a 429, so the body must be inspected before treating a 401 as an auth failure.
 * An invalid cookie gets the same message but with `require_login: true`.
 */
async function throwForStatus(res: Response, context: string): Promise<void> {
  if (res.ok) return

  if (res.status === 429) {
    throw new ScraperRateLimitError(RATE_LIMIT_MESSAGE)
  }

  if (res.status === 401 || res.status === 403) {
    const body = await res.text().catch(() => "")
    if (/"require_login"\s*:\s*true/.test(body)) {
      throw new ScraperAuthError(AUTH_ERROR_MESSAGE)
    }
    if (/wait a few minutes|rate limit|too many requests/i.test(body)) {
      throw new ScraperRateLimitError(RATE_LIMIT_MESSAGE)
    }
    throw new ScraperAuthError(AUTH_ERROR_MESSAGE)
  }

  throw new Error(`Instagram ${context} request failed with status ${res.status}`)
}

// ---------------------------------------------------------------------------
// Internal API calls
// ---------------------------------------------------------------------------

/**
 * Instagram answers rejected sessions and flagged IPs (e.g. cloud hosts) with
 * redirects to login/challenge pages that loop forever, so redirects are never
 * followed — they are classified into actionable errors instead.
 */
async function igFetch(url: string, headers: Record<string, string>, context: string): Promise<Response> {
  const res = await fetch(url, { headers, redirect: "manual" })
  if (res.status < 300 || res.status >= 400) return res

  let path = ""
  try {
    path = new URL(res.headers.get("location") ?? "", "https://www.instagram.com").pathname
  } catch {
    // Unparseable Location — classify as unknown below
  }
  // Path only: query strings can echo request details
  console.warn(`Instagram ${context} redirected (${res.status}) to ${path || "<none>"}`)

  if (/\/(challenge|checkpoint)\b/.test(path)) {
    throw new ScraperAuthError(
      "Instagram wants to verify this session. Open Instagram in your browser or app, " +
        "complete any security check, then copy a fresh sessionid."
    )
  }
  if (/\/accounts\/(suspended|disabled)\b/.test(path)) {
    throw new ScraperAuthError("Instagram reports this account as suspended or disabled.")
  }
  if (/\/accounts\/login\b/.test(path) || path === "/") {
    throw new ScraperAuthError(
      "Instagram rejected the session from this server (redirected to login). " +
        "The cookie may be expired, or Instagram may be blocking requests from cloud hosting — " +
        "try a fresh sessionid, or run the import from a local copy of the app."
    )
  }
  throw new Error(`Instagram ${context} request redirected (${res.status}) to ${path || "unknown"}`)
}

/** The sessionid cookie is `<user_id>:<token>:...` (URL-encoded). */
function userIdFromSessionId(cleanSessionId: string): string | null {
  let decoded = cleanSessionId
  try {
    decoded = decodeURIComponent(cleanSessionId)
  } catch {
    // Not URL-encoded — use as-is
  }
  const prefix = decoded.split(":")[0]
  return /^\d+$/.test(prefix) ? prefix : null
}

async function fetchUserId(headers: Record<string, string>): Promise<string> {
  const url = `${BASE_URL}/accounts/current_user/?edit=true`
  const res = await igFetch(url, headers, "current_user")
  await throwForStatus(res, "current_user")

  const data = await res.json()
  const userId = data?.user?.pk
  if (userId === undefined || userId === null) {
    throw new Error(
      "Unexpected response shape from Instagram current_user endpoint: missing user.pk"
    )
  }

  return String(userId)
}

interface FollowingPage {
  usernames: string[]
  nextMaxId: string | null
}

async function fetchFollowingPage(
  headers: Record<string, string>,
  userId: string,
  maxId?: string
): Promise<FollowingPage> {
  let url = `${BASE_URL}/friendships/${userId}/following/?count=${PAGE_SIZE}`
  if (maxId) {
    url += `&max_id=${maxId}`
  }

  const res = await igFetch(url, headers, "following")
  await throwForStatus(res, "following")

  const data = await res.json()

  if (!Array.isArray(data?.users)) {
    throw new Error(
      "Unexpected response shape from Instagram following endpoint: missing users array"
    )
  }

  const usernames: string[] = data.users
    .map((u: { username?: string }) => u.username)
    .filter((name: unknown): name is string => typeof name === "string")

  const nextMaxId: string | null =
    data.next_max_id !== undefined && data.next_max_id !== null && data.next_max_id !== ""
      ? String(data.next_max_id)
      : null

  return { usernames, nextMaxId }
}

// ---------------------------------------------------------------------------
// Profile scraping
// ---------------------------------------------------------------------------

export interface ScrapedProfile {
  username: string
  fullName: string | null
  biography: string | null
  profilePicUrl: string | null
  isPrivate: boolean
  isBusiness: boolean
}

/**
 * Fetches a single user's profile (bio, name, profile pic) via the private API.
 * Returns null if the user is not found.
 */
export async function scrapeProfile(
  handle: string,
  credentials: ScraperCredentials
): Promise<ScrapedProfile | null> {
  const cleaned = cleanSessionId(credentials.sessionId)
  const headers = buildHeaders(cleaned, credentials.userAgent)
  const normalized = handle.replace(/^@/, "").trim().toLowerCase()

  const url = `${BASE_URL}/users/web_profile_info/?username=${encodeURIComponent(normalized)}`
  const res = await igFetch(url, headers, "web_profile_info")

  if (res.status === 404) {
    return null
  }
  await throwForStatus(res, "web_profile_info")

  const data = await res.json()
  const user = data?.data?.user

  if (!user) {
    return null
  }

  return {
    username: user.username ?? normalized,
    fullName: user.full_name ?? null,
    biography: user.biography ?? null,
    profilePicUrl: user.profile_pic_url_hd ?? user.profile_pic_url ?? null,
    isPrivate: user.is_private ?? false,
    isBusiness: user.is_business_account ?? false,
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Scrapes the authenticated user's full following list from Instagram.
 * Returns a sorted, deduplicated, lowercased array of usernames.
 *
 * @param credentials - The `sessionid` cookie (and browser User-Agent) from the user's browser
 */
export async function scrapeFollowing(credentials: ScraperCredentials): Promise<string[]> {
  const cleaned = cleanSessionId(credentials.sessionId)
  const headers = buildHeaders(cleaned, credentials.userAgent)

  const userId = userIdFromSessionId(cleaned) ?? (await fetchUserId(headers))

  const allUsernames: string[] = []
  let nextMaxId: string | null = null

  do {
    const page = await fetchFollowingPage(headers, userId, nextMaxId ?? undefined)
    allUsernames.push(...page.usernames)

    // Safety cap — return what we have without error
    if (allUsernames.length >= MAX_HANDLES) {
      break
    }

    nextMaxId = page.nextMaxId

    // Jittered delay between pages — fixed intervals look automated
    if (nextMaxId) {
      await delay(randomBetween(PAGINATION_DELAY_MIN_MS, PAGINATION_DELAY_MAX_MS))
    }
  } while (nextMaxId)

  // Normalize, deduplicate, sort
  const seen = new Set<string>()
  const result: string[] = []

  for (const username of allUsernames) {
    const normalized = username.trim().toLowerCase()
    if (normalized && !seen.has(normalized)) {
      seen.add(normalized)
      result.push(normalized)
    }
  }

  result.sort()
  return result
}
