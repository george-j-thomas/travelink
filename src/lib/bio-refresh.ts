// Bio refresh rules, shared by the server (artist-pipeline) and the artist pages.
// Client components import this, so keep it free of server-only imports.

/** Refreshing a bio again within this window needs the user to confirm. */
export const REFRESH_CONFIRM_WINDOW_MS = 72 * 60 * 60_000

/** Whether a bio fetched at `fetchedAt` is recent enough that refreshing it needs confirming. */
export function isRecentlyFetched(
  fetchedAt: Date | string | null | undefined,
  now: number = Date.now()
): boolean {
  if (!fetchedAt) return false
  return now - new Date(fetchedAt).getTime() < REFRESH_CONFIRM_WINDOW_MS
}
