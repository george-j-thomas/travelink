// Paid Instagram data provider (HikerAPI — https://hikerapi.com). Used where the
// official API can't help: account search (typeahead) and bios of personal
// accounts that Business Discovery doesn't return.
//
// Billing is a prepaid balance, so the worst case is losing the balance. Every
// call must be preceded by reserveUsage() — see src/lib/usage.ts.

import { isValidHandle, normalizeHandle, RateLimitError, type InstagramProfile } from "@/lib/instagram"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ProviderAccountType = "personal" | "business" | "creator" | "unknown"

export interface ProviderProfile extends InstagramProfile {
  accountType: ProviderAccountType
  isPrivate: boolean
}

export interface ProviderSearchResult {
  username: string
  fullName: string | null
  profilePicUrl: string | null
  isVerified: boolean
  isPrivate: boolean
}

interface HikerUser {
  username?: unknown
  full_name?: unknown
  biography?: unknown
  profile_pic_url?: unknown
  profile_pic_url_hd?: unknown
  external_url?: unknown
  is_private?: unknown
  is_verified?: unknown
  is_business?: unknown
  account_type?: unknown
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/** Missing/invalid key or empty balance — needs the operator to fix it. */
export class ProviderConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ProviderConfigError"
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BASE_URL = "https://api.hikerapi.com"
const SEARCH_TIMEOUT_MS = 8_000
const PROFILE_TIMEOUT_MS = 20_000
const DEFAULT_RETRY_AFTER_MS = 60_000
export const PROVIDER_SEARCH_LIMIT = 8

const BALANCE_PATTERN = /balance|funds|payment|top.?up|insufficient|limit of requests/i

export function isProviderConfigured(): boolean {
  return Boolean(process.env.HIKERAPI_ACCESS_KEY?.trim())
}

function getKey(): string {
  const key = process.env.HIKERAPI_ACCESS_KEY?.trim()
  if (!key) throw new ProviderConfigError("HikerAPI isn't set up: HIKERAPI_ACCESS_KEY is missing.")
  return key
}

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null)

function httpsUrl(v: unknown): string | null {
  const s = str(v)
  if (!s) return null
  try {
    return new URL(s).protocol === "https:" ? s : null
  } catch {
    return null
  }
}

// Instagram's internal account_type: 1 personal, 2 business, 3 creator
function mapAccountType(user: HikerUser): ProviderAccountType {
  const type = Number(user.account_type)
  if (type === 1) return "personal"
  if (type === 2) return "business"
  if (type === 3) return "creator"
  return user.is_business === true ? "business" : "unknown"
}

async function readError(res: Response): Promise<string> {
  const body = (await res.json().catch(() => null)) as { error?: unknown; detail?: unknown } | null
  const message = str(body?.error) ?? str(body?.detail)
  return message ?? `HTTP ${res.status}`
}

/**
 * GETs a HikerAPI endpoint. Returns null on 404 (no such account).
 *
 * @throws {ProviderConfigError} bad key or empty balance
 * @throws {RateLimitError} request rate exceeded
 */
async function hikerGet(path: string, params: Record<string, string>, timeoutMs: number): Promise<unknown> {
  const url = new URL(path, BASE_URL)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)

  const res = await fetch(url, {
    headers: { "x-access-key": getKey(), accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
  })

  if (res.ok) return res.json()
  if (res.status === 404) return null

  const message = await readError(res)
  if (res.status === 401 || res.status === 402 || BALANCE_PATTERN.test(message)) {
    throw new ProviderConfigError(`HikerAPI rejected the request (${res.status}): ${message}`)
  }
  if (res.status === 429) {
    const retryAfter = Number(res.headers.get("retry-after"))
    throw new RateLimitError(
      `HikerAPI rate limit: ${message}`,
      Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : DEFAULT_RETRY_AFTER_MS
    )
  }
  throw new Error(`HikerAPI request failed (${res.status}): ${message}`)
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Account search, ranked like Instagram's own search box.
 *
 * @throws {ProviderConfigError}
 * @throws {RateLimitError}
 */
export async function searchProviderAccounts(query: string): Promise<ProviderSearchResult[]> {
  const q = query.trim().replace(/^@+/, "").trim()
  if (!q) return []

  const data = (await hikerGet("/v2/fbsearch/accounts", { query: q }, SEARCH_TIMEOUT_MS)) as {
    users?: unknown
  } | null
  const users: HikerUser[] = Array.isArray(data?.users) ? data.users : []

  return users
    .filter((u) => typeof u?.username === "string")
    .slice(0, PROVIDER_SEARCH_LIMIT)
    .map((u) => ({
      username: String(u.username).toLowerCase(),
      fullName: str(u.full_name),
      profilePicUrl: httpsUrl(u.profile_pic_url),
      isVerified: u.is_verified === true,
      isPrivate: u.is_private === true,
    }))
}

/**
 * Public profile of any account (personal, business or creator; bios of
 * private accounts are visible too).
 *
 * @returns null when the account doesn't exist
 * @throws {ProviderConfigError}
 * @throws {RateLimitError}
 */
export async function fetchProviderProfile(handle: string): Promise<ProviderProfile | null> {
  const normalized = normalizeHandle(handle)
  if (!isValidHandle(normalized)) return null

  const data = (await hikerGet("/v2/user/by/username", { username: normalized }, PROFILE_TIMEOUT_MS)) as {
    user?: HikerUser
  } | null
  const user = data?.user
  if (!user || typeof user.username !== "string") return null

  return {
    username: user.username.toLowerCase(),
    name: str(user.full_name),
    biography: str(user.biography),
    profilePictureUrl: httpsUrl(user.profile_pic_url_hd) ?? httpsUrl(user.profile_pic_url),
    website: httpsUrl(user.external_url),
    accountType: mapAccountType(user),
    isPrivate: user.is_private === true,
  }
}
