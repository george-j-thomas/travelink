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

/**
 * Browsers send the cookie with the travel-ink user it was connected under.
 * Refuse it for anyone else, e.g. after an account switch in another tab.
 * @throws {ScraperAuthError} so the client drops its copy
 */
export function assertCookieOwner(ownerId: unknown, userId: string) {
  if (ownerId !== userId) {
    throw new ScraperAuthError("Your travel-ink account changed in another tab. Reload this page.")
  }
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

// Printable ASCII without whitespace, quotes, commas, semicolons or backslashes (RFC 6265)
const COOKIE_VALUE_RE = /^[\x21\x23-\x2B\x2D-\x3A\x3C-\x5B\x5D-\x7E]+$/

/**
 * Accepts a bare `sessionid` value, `sessionid=<value>`, or a full Cookie
 * header copied from DevTools (which carries csrftoken/mid too and looks more
 * like the real browser).
 */
function parseCookieInput(raw: string): Map<string, string> {
  const trimmed = raw.trim()
  const jar = new Map<string, string>()

  if (/(^|;)\s*sessionid\s*=/i.test(trimmed)) {
    for (const part of trimmed.split(";")) {
      const eq = part.indexOf("=")
      if (eq <= 0) continue
      const name = part.slice(0, eq).trim()
      const value = part.slice(eq + 1).trim()
      if (!name || !value) continue
      jar.set(name.toLowerCase() === "sessionid" ? "sessionid" : name, value)
    }
  } else if (trimmed) {
    jar.set("sessionid", trimmed)
  }

  const sessionId = jar.get("sessionid")
  if (!sessionId) {
    throw new ScraperAuthError("Session ID is empty. Please provide a valid sessionid cookie value.")
  }
  for (const [name, value] of jar) {
    if (!COOKIE_VALUE_RE.test(name) || !COOKIE_VALUE_RE.test(value)) {
      throw new ScraperAuthError(
        "That doesn't look like a sessionid cookie value. Copy just the value of the sessionid cookie."
      )
    }
  }
  return jar
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

const MAX_REDIRECTS = 3

/**
 * One logical browser session: a tiny cookie jar plus browser-like headers.
 *
 * Instagram sets cookies (csrftoken, mid, …) via a redirect back to the same
 * URL and expects them on the retry, the way a browser would. Node's fetch has
 * no cookie jar, so following redirects blindly loops forever — redirects are
 * followed manually here, carrying cookies, and login/challenge redirects are
 * turned into actionable errors.
 */
class InstagramSession {
  private readonly jar: Map<string, string>
  private readonly userAgent: string
  readonly userId: string | null

  constructor(credentials: ScraperCredentials) {
    this.jar = parseCookieInput(credentials.sessionId)
    this.userAgent = credentials.userAgent?.trim() || FALLBACK_USER_AGENT
    this.userId = userIdFromSessionId(this.jar.get("sessionid")!)
    if (this.userId && !this.jar.has("ds_user_id")) {
      this.jar.set("ds_user_id", this.userId)
    }
  }

  private headers(): Record<string, string> {
    const headers: Record<string, string> = {
      "User-Agent": this.userAgent,
      Accept: "*/*",
      "Accept-Language": "en-US,en;q=0.9",
      Referer: "https://www.instagram.com/",
      Cookie: Array.from(this.jar, ([name, value]) => `${name}=${value}`).join("; "),
      "X-IG-App-ID": WEB_APP_ID,
      "X-Requested-With": "XMLHttpRequest",
    }
    const csrf = this.jar.get("csrftoken")
    if (csrf) headers["X-CSRFToken"] = csrf
    return headers
  }

  /** Applies Set-Cookie headers to the jar; returns the cookie names (never values). */
  private absorbCookies(res: Response): string[] {
    const names: string[] = []
    for (const line of res.headers.getSetCookie()) {
      const [pair, ...attrs] = line.split(";")
      const eq = pair.indexOf("=")
      if (eq <= 0) continue
      const name = pair.slice(0, eq).trim()
      const value = pair.slice(eq + 1).trim()
      names.push(name)

      const expired = attrs.some((a) => {
        const [key, val = ""] = a.split("=").map((s) => s.trim())
        if (/^max-age$/i.test(key)) return Number(val) <= 0
        if (/^expires$/i.test(key)) return Date.parse(val) < Date.now()
        return false
      })
      if (expired || value === "" || value === '""') {
        this.jar.delete(name)
      } else if (COOKIE_VALUE_RE.test(value)) {
        this.jar.set(name, value)
      }
    }
    return names
  }

  async get(url: string, context: string): Promise<Response> {
    let current = url

    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const res = await fetch(current, { headers: this.headers(), redirect: "manual" })
      const setCookies = this.absorbCookies(res)
      if (res.status < 300 || res.status >= 400) return res

      let next: URL | null = null
      try {
        next = new URL(res.headers.get("location") ?? "", current)
      } catch {
        // Unparseable Location — handled below
      }
      const path = next?.pathname ?? ""
      // Path and cookie names only: values and query strings can carry secrets
      console.warn(
        `Instagram ${context} redirected (${res.status}) to ${path || "<none>"}; ` +
          `set-cookie: ${setCookies.join(", ") || "none"}`
      )

      if (!this.jar.has("sessionid")) {
        throw new ScraperAuthError(AUTH_ERROR_MESSAGE)
      }
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
            "try a fresh sessionid, or run the app locally."
        )
      }
      if (!next || next.hostname !== "www.instagram.com") {
        throw new Error(`Instagram ${context} request redirected (${res.status}) to ${path || "unknown"}`)
      }
      current = next.toString()
    }

    throw new ScraperAuthError(
      "Instagram kept redirecting instead of answering — it may be blocking requests from " +
        "this server. Try a fresh sessionid, or run the app locally."
    )
  }
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

async function fetchUserId(session: InstagramSession): Promise<string> {
  const url = `${BASE_URL}/accounts/current_user/?edit=true`
  const res = await session.get(url, "current_user")
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

/** An account from the user's following list. */
export interface FollowingAccount {
  username: string
  fullName: string | null
  profilePicUrl: string | null
  /**
   * Business/Creator accounts can't be private, so a private account never has a
   * bio travel-ink can read. Instagram's list doesn't say which accounts are business.
   */
  isPrivate: boolean
}

interface FollowingPage {
  accounts: FollowingAccount[]
  nextMaxId: string | null
}

async function fetchFollowingPage(
  session: InstagramSession,
  userId: string,
  maxId?: string
): Promise<FollowingPage> {
  let url = `${BASE_URL}/friendships/${userId}/following/?count=${PAGE_SIZE}`
  if (maxId) {
    url += `&max_id=${encodeURIComponent(maxId)}`
  }

  const res = await session.get(url, "following")
  await throwForStatus(res, "following")

  const data = await res.json()

  if (!Array.isArray(data?.users)) {
    throw new Error(
      "Unexpected response shape from Instagram following endpoint: missing users array"
    )
  }

  const accounts: FollowingAccount[] = (data.users as Record<string, unknown>[])
    .filter((u) => typeof u?.username === "string")
    .map((u) => ({
      username: String(u.username),
      fullName: typeof u.full_name === "string" && u.full_name ? u.full_name : null,
      profilePicUrl: typeof u.profile_pic_url === "string" ? u.profile_pic_url : null,
      isPrivate: u.is_private === true,
    }))

  const nextMaxId: string | null =
    data.next_max_id !== undefined && data.next_max_id !== null && data.next_max_id !== ""
      ? String(data.next_max_id)
      : null

  return { accounts, nextMaxId }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface InstagramSearchResult {
  username: string
  fullName: string | null
  profilePicUrl: string | null
  isVerified: boolean
  isPrivate: boolean
}

const SEARCH_LIMIT = 8

/**
 * Account search, as used by the search box on instagram.com.
 * Returns up to 8 accounts in Instagram's ranking order.
 */
export async function searchUsers(
  query: string,
  credentials: ScraperCredentials
): Promise<InstagramSearchResult[]> {
  const q = query.trim().replace(/^@+/, "").trim()
  if (!q) return []

  const session = new InstagramSession(credentials)
  const url =
    `${BASE_URL}/web/search/topsearch/?context=blended&include_reel=false` +
    `&query=${encodeURIComponent(q)}`
  const res = await session.get(url, "search")
  await throwForStatus(res, "search")

  const data = await res.json()
  const entries: unknown[] = Array.isArray(data?.users) ? data.users : []

  return entries
    .map((entry) => (entry as { user?: Record<string, unknown> })?.user)
    .filter((u): u is Record<string, unknown> => typeof u?.username === "string")
    .slice(0, SEARCH_LIMIT)
    .map((u) => ({
      username: String(u.username).toLowerCase(),
      fullName: typeof u.full_name === "string" && u.full_name ? u.full_name : null,
      profilePicUrl: typeof u.profile_pic_url === "string" ? u.profile_pic_url : null,
      isVerified: u.is_verified === true,
      isPrivate: u.is_private === true,
    }))
}

/**
 * Scrapes the authenticated user's full following list from Instagram.
 * Returns accounts sorted and deduplicated by lowercased username.
 *
 * @param credentials - The `sessionid` cookie (and browser User-Agent) from the user's browser
 */
export async function scrapeFollowing(credentials: ScraperCredentials): Promise<FollowingAccount[]> {
  const session = new InstagramSession(credentials)
  const userId = session.userId ?? (await fetchUserId(session))

  const all: FollowingAccount[] = []
  let nextMaxId: string | null = null

  do {
    const page = await fetchFollowingPage(session, userId, nextMaxId ?? undefined)
    all.push(...page.accounts)

    // Safety cap — return what we have without error
    if (all.length >= MAX_HANDLES) {
      break
    }

    nextMaxId = page.nextMaxId

    // Jittered delay between pages — fixed intervals look automated
    if (nextMaxId) {
      await delay(randomBetween(PAGINATION_DELAY_MIN_MS, PAGINATION_DELAY_MAX_MS))
    }
  } while (nextMaxId)

  const byUsername = new Map<string, FollowingAccount>()
  for (const account of all) {
    const username = account.username.trim().toLowerCase()
    if (username && !byUsername.has(username)) {
      byUsername.set(username, { ...account, username })
    }
  }

  return [...byUsername.values()].sort((a, b) => a.username.localeCompare(b.username))
}
