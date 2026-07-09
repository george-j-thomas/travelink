// Instagram Following Scraper
// Fetches a user's following list via Instagram's private mobile API.
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
// Constants
// ---------------------------------------------------------------------------

const BASE_URL = "https://i.instagram.com/api/v1"
const PAGE_SIZE = 200
const PAGINATION_DELAY_MS = 500
const MAX_HANDLES = 5000

const AUTH_ERROR_MESSAGE =
  "Session cookie is invalid or expired. Please copy a fresh sessionid from your browser."
const RATE_LIMIT_MESSAGE =
  "Instagram rate limit hit during scraping. Try again in a few minutes."

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildHeaders(cleanSessionId: string): Record<string, string> {
  return {
    "User-Agent":
      "Instagram 76.0.0.15.395 Android (24/7.0; 640dpi; 1440x2560; samsung; SM-G930F; herolte; samsungexynos8890; en_US; 138226743)",
    Cookie: `sessionid=${cleanSessionId}`,
    "X-IG-App-ID": "936619743392459",
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

// ---------------------------------------------------------------------------
// Internal API calls
// ---------------------------------------------------------------------------

async function fetchUserId(headers: Record<string, string>): Promise<string> {
  const url = `${BASE_URL}/accounts/current_user/?edit=true`
  const res = await fetch(url, { headers })

  if (res.status === 401 || res.status === 403) {
    throw new ScraperAuthError(AUTH_ERROR_MESSAGE)
  }

  if (!res.ok) {
    throw new Error(`Instagram current_user request failed with status ${res.status}`)
  }

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

  const res = await fetch(url, { headers })

  if (res.status === 401 || res.status === 403) {
    throw new ScraperAuthError(AUTH_ERROR_MESSAGE)
  }
  if (res.status === 429) {
    throw new ScraperRateLimitError(RATE_LIMIT_MESSAGE)
  }
  if (!res.ok) {
    throw new Error(`Instagram following request failed with status ${res.status}`)
  }

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
    data.next_max_id && data.big_list ? String(data.next_max_id) : null

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
  sessionId: string
): Promise<ScrapedProfile | null> {
  const cleaned = cleanSessionId(sessionId)
  const headers = buildHeaders(cleaned)
  const normalized = handle.replace(/^@/, "").trim().toLowerCase()

  const url = `${BASE_URL}/users/web_profile_info/?username=${encodeURIComponent(normalized)}`
  const res = await fetch(url, { headers })

  if (res.status === 401 || res.status === 403) {
    throw new ScraperAuthError(AUTH_ERROR_MESSAGE)
  }
  if (res.status === 429) {
    throw new ScraperRateLimitError(RATE_LIMIT_MESSAGE)
  }
  if (res.status === 404) {
    return null
  }
  if (!res.ok) {
    throw new Error(`Instagram web_profile_info request failed with status ${res.status}`)
  }

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
 * @param sessionId - The `sessionid` cookie value from the user's browser
 */
export async function scrapeFollowing(sessionId: string): Promise<string[]> {
  const cleaned = cleanSessionId(sessionId)
  const headers = buildHeaders(cleaned)

  const userId = await fetchUserId(headers)

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

    // Rate-limit courtesy delay between pages
    if (nextMaxId) {
      await delay(PAGINATION_DELAY_MS)
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
