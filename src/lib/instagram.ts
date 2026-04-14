// Instagram Business Discovery API client
// Fetches tattoo artist profile data (bio, name, profile pic) using a server-side token.

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface InstagramProfile {
  username: string
  name: string | null
  biography: string | null
  profilePictureUrl: string | null
  accountType: "business" | "creator" | "unknown"
}

/** Raw shape returned by the Instagram Graph API business_discovery endpoint. */
interface InstagramApiBusinessDiscovery {
  biography?: string
  username?: string
  name?: string
  profile_picture_url?: string
  id?: string
}

interface InstagramApiSuccessResponse {
  business_discovery: InstagramApiBusinessDiscovery
  id: string
}

interface InstagramApiErrorDetail {
  message: string
  type: string
  code: number
  error_subcode?: number
  fbtrace_id?: string
}

interface InstagramApiErrorResponse {
  error: InstagramApiErrorDetail
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class RateLimitError extends Error {
  constructor(message = "Instagram API rate limit exceeded") {
    super(message)
    this.name = "RateLimitError"
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const HANDLE_REGEX = /^[a-zA-Z0-9._]{1,30}$/

function normalizeHandle(raw: string): string {
  return raw.replace(/^@/, "").trim().toLowerCase()
}

function validateHandle(handle: string): void {
  if (!HANDLE_REGEX.test(handle)) {
    throw new Error(
      `Invalid Instagram handle "${handle}". ` +
        "Handles must be 1-30 characters and contain only letters, numbers, periods, or underscores.",
    )
  }
}

function getConfig(): { accessToken: string; appUserId: string } {
  const accessToken = process.env.INSTAGRAM_APP_ACCESS_TOKEN
  const appUserId = process.env.INSTAGRAM_APP_USER_ID

  if (!accessToken) {
    throw new Error(
      "Missing INSTAGRAM_APP_ACCESS_TOKEN environment variable. " +
        "Set it to a valid long-lived token for the Instagram Business Discovery API.",
    )
  }
  if (!appUserId) {
    throw new Error(
      "Missing INSTAGRAM_APP_USER_ID environment variable. " +
        "Set it to the Instagram user ID associated with INSTAGRAM_APP_ACCESS_TOKEN.",
    )
  }

  return { accessToken, appUserId }
}

function isErrorResponse(
  body: unknown,
): body is InstagramApiErrorResponse {
  return (
    typeof body === "object" &&
    body !== null &&
    "error" in body &&
    typeof (body as InstagramApiErrorResponse).error?.code === "number"
  )
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Fetch an Instagram business/creator account's public profile via the
 * Business Discovery API.
 *
 * Returns `null` when the handle does not exist (API error subcode 2207013
 * or error code 100).
 *
 * Returns a partial profile with `accountType: "unknown"` when the target is
 * a personal account (API error code 10 — permissions error).
 *
 * @throws {Error} on invalid handle or missing config
 * @throws {RateLimitError} on HTTP 429
 */
export async function fetchArtistProfile(
  handle: string,
): Promise<InstagramProfile | null> {
  const normalized = normalizeHandle(handle)
  validateHandle(normalized)

  const { accessToken, appUserId } = getConfig()

  const fields =
    "business_discovery.fields(biography,username,name,profile_picture_url)"
  const url = new URL(`https://graph.instagram.com/v21.0/${appUserId}`)
  url.searchParams.set("fields", fields)
  url.searchParams.set("business_discovery", `@${normalized}`)
  url.searchParams.set("access_token", accessToken)

  const response = await fetch(url.toString())
  const body: unknown = await response.json()

  // -- Rate limit --------------------------------------------------------
  if (response.status === 429) {
    const msg = isErrorResponse(body)
      ? body.error.message
      : "Rate limit exceeded"
    throw new RateLimitError(`Instagram API rate limit: ${msg}`)
  }

  // -- Error responses ---------------------------------------------------
  if (!response.ok) {
    if (isErrorResponse(body)) {
      const { code, error_subcode, message } = body.error

      // Handle not found (subcode 2207013 or code 100)
      if (error_subcode === 2207013 || code === 100) {
        return null
      }

      // Personal account — not eligible for business discovery
      if (code === 10) {
        return {
          username: normalized,
          name: null,
          biography: null,
          profilePictureUrl: null,
          accountType: "unknown",
        }
      }

      throw new Error(
        `Instagram API error (code ${code}): ${message}`,
      )
    }

    throw new Error(
      `Instagram API request failed with HTTP ${response.status}`,
    )
  }

  // -- Success -----------------------------------------------------------
  const data = body as InstagramApiSuccessResponse
  const bd = data.business_discovery

  return {
    username: bd.username ?? normalized,
    name: bd.name ?? null,
    biography: bd.biography ?? null,
    profilePictureUrl: bd.profile_picture_url ?? null,
    // Business Discovery API only works with business/creator accounts.
    // If we got a successful response, it's one of those two — the API
    // doesn't distinguish between them in this endpoint, so we default
    // to "business".
    accountType: "business",
  }
}
