// Instagram Business Discovery client (official Graph API, "Instagram API with
// Facebook Login"). Reads public profile data of Business/Creator accounts by
// username using a server-side token — no user cookie, no scraping.
//
// Personal accounts are not returned by the API. Rate limit is ~200 calls/hour
// per token; usage headers are exposed so callers can pace themselves.

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface InstagramProfile {
  username: string
  name: string | null
  biography: string | null
  profilePictureUrl: string | null
  website: string | null
}

export interface BusinessDiscoveryResult {
  /** null when the account doesn't exist or isn't a public Business/Creator account. */
  profile: InstagramProfile | null
  /** Highest rate-limit usage reported by Meta for this token, 0–100. */
  usagePercent: number
}

interface GraphErrorDetail {
  message: string
  type?: string
  code: number
  error_subcode?: number
}

interface BusinessDiscoveryResponse {
  business_discovery?: {
    username?: string
    name?: string
    biography?: string
    profile_picture_url?: string
    website?: string
  }
  error?: GraphErrorDetail
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

const DEFAULT_RATE_LIMIT_BACKOFF_MS = 15 * 60_000

export class RateLimitError extends Error {
  constructor(
    message = "Instagram API rate limit exceeded",
    public readonly retryAfterMs = DEFAULT_RATE_LIMIT_BACKOFF_MS
  ) {
    super(message)
    this.name = "RateLimitError"
  }
}

/** Missing, invalid or expired Business Discovery token — needs the operator to fix config. */
export class BusinessDiscoveryConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "BusinessDiscoveryConfigError"
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const GRAPH_API_BASE = "https://graph.facebook.com/v25.0"
const HANDLE_REGEX = /^[a-z0-9._]{1,30}$/

// https://developers.facebook.com/docs/graph-api/overview/rate-limiting
const RATE_LIMIT_CODES = new Set([4, 17, 32, 613])
const isBucRateLimit = (code: number) => code >= 80001 && code <= 80014
// Token expired, revoked, or lacks permission
const AUTH_ERROR_CODES = new Set([102, 190])
const isPermissionError = (code: number) => code === 10 || (code >= 200 && code <= 299)
// "Cannot find User" — no such account, or a personal (non-professional) account
const USER_NOT_FOUND_SUBCODE = 2207013

export function normalizeHandle(raw: string): string {
  return raw.trim().replace(/^@+/, "").trim().toLowerCase()
}

export function isValidHandle(handle: string): boolean {
  return HANDLE_REGEX.test(handle)
}

export function isBusinessDiscoveryConfigured(): boolean {
  return Boolean(
    process.env.INSTAGRAM_APP_ACCESS_TOKEN?.trim() && process.env.INSTAGRAM_APP_USER_ID?.trim()
  )
}

function getConfig(): { accessToken: string; appUserId: string } {
  const accessToken = process.env.INSTAGRAM_APP_ACCESS_TOKEN?.trim()
  const appUserId = process.env.INSTAGRAM_APP_USER_ID?.trim()
  if (!accessToken || !appUserId) {
    throw new BusinessDiscoveryConfigError(
      "Instagram Business Discovery isn't set up: INSTAGRAM_APP_ACCESS_TOKEN and " +
        "INSTAGRAM_APP_USER_ID must both be configured."
    )
  }
  return { accessToken, appUserId }
}

interface UsageStats {
  percent: number
  regainAccessMs: number
}

/** Reads Meta's x-app-usage / x-business-use-case-usage headers. */
export function parseUsageHeaders(headers: Headers): UsageStats {
  let percent = 0
  let regainAccessMs = 0

  const consider = (entry: unknown) => {
    if (!entry || typeof entry !== "object") return
    const e = entry as Record<string, unknown>
    for (const key of ["call_count", "total_time", "total_cputime"]) {
      if (typeof e[key] === "number") percent = Math.max(percent, e[key] as number)
    }
    if (typeof e.estimated_time_to_regain_access === "number") {
      regainAccessMs = Math.max(regainAccessMs, e.estimated_time_to_regain_access * 60_000)
    }
  }

  try {
    const app = headers.get("x-app-usage")
    if (app) consider(JSON.parse(app))
    const buc = headers.get("x-business-use-case-usage")
    if (buc) {
      const parsed = JSON.parse(buc) as Record<string, unknown>
      for (const entries of Object.values(parsed)) {
        if (Array.isArray(entries)) entries.forEach(consider)
      }
    }
  } catch {
    // Malformed usage headers shouldn't fail the request
  }

  return { percent: Math.min(percent, 100), regainAccessMs }
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Fetches a Business/Creator account's public profile via Business Discovery.
 *
 * @throws {BusinessDiscoveryConfigError} token missing, expired, or lacking permission
 * @throws {RateLimitError} Meta is throttling this token
 */
export async function fetchArtistProfile(handle: string): Promise<BusinessDiscoveryResult> {
  const normalized = normalizeHandle(handle)
  if (!isValidHandle(normalized)) {
    return { profile: null, usagePercent: 0 }
  }

  const { accessToken, appUserId } = getConfig()

  const url = new URL(`${GRAPH_API_BASE}/${encodeURIComponent(appUserId)}`)
  url.searchParams.set(
    "fields",
    `business_discovery.username(${normalized}){username,name,biography,profile_picture_url,website}`
  )
  url.searchParams.set("access_token", accessToken)

  const response = await fetch(url, { cache: "no-store" })
  const usage = parseUsageHeaders(response.headers)
  const body = (await response.json().catch(() => ({}))) as BusinessDiscoveryResponse

  if (interpretBusinessDiscovery(body, response, usage) === "not_found") {
    return { profile: null, usagePercent: usage.percent }
  }

  const bd = body.business_discovery
  if (!bd) {
    return { profile: null, usagePercent: usage.percent }
  }

  return {
    profile: {
      username: bd.username?.toLowerCase() ?? normalized,
      name: bd.name || null,
      biography: bd.biography || null,
      profilePictureUrl: bd.profile_picture_url || null,
      website: bd.website || null,
    },
    usagePercent: usage.percent,
  }
}

/**
 * Maps a Business Discovery response's error (if any) to an action:
 * returns "ok" when the call succeeded, "not_found" for a missing/personal
 * account, and throws {@link RateLimitError} / {@link BusinessDiscoveryConfigError}
 * / a generic Error for everything else.
 */
function interpretBusinessDiscovery(
  body: BusinessDiscoveryResponse,
  response: Response,
  usage: UsageStats
): "ok" | "not_found" {
  if (!body.error && response.ok) return "ok"

  const err = body.error
  const code = err?.code ?? 0

  if (response.status === 429 || RATE_LIMIT_CODES.has(code) || isBucRateLimit(code)) {
    throw new RateLimitError(
      `Instagram API rate limit: ${err?.message ?? `HTTP ${response.status}`}`,
      usage.regainAccessMs || DEFAULT_RATE_LIMIT_BACKOFF_MS
    )
  }
  if (err?.error_subcode === USER_NOT_FOUND_SUBCODE || code === 110) {
    return "not_found"
  }
  if (AUTH_ERROR_CODES.has(code) || isPermissionError(code)) {
    throw new BusinessDiscoveryConfigError(
      `Instagram API token was rejected (code ${code}): ${err?.message ?? "unknown error"}. ` +
        "Generate a new long-lived token and update INSTAGRAM_APP_ACCESS_TOKEN."
    )
  }
  throw new Error(
    err
      ? `Instagram API error (code ${code}): ${err.message}`
      : `Instagram API request failed with HTTP ${response.status}`
  )
}
