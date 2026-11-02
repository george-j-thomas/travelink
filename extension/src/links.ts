// Links into travel-ink. The origin is fixed at build time (src/config.ts).
import { TRAVELINK_ORIGIN } from "./config"

/** The Add page with the handle filled in (it signs the user in first if needed). */
export function addPageUrl(handle: string): string {
  return `${TRAVELINK_ORIGIN}/artists/add?handle=${encodeURIComponent(handle)}`
}

/** The Add page for a signed-out click: once the user has signed in, it shows the add's progress
 * (instead of the form) while the service worker adds the artist, which then replaces it. */
export function addAfterSignInUrl(handle: string): string {
  return `${addPageUrl(handle)}&adding=1`
}

/** The artist's page on travel-ink. */
export function artistPageUrl(artistId: string): string {
  return `${TRAVELINK_ORIGIN}/artists/${encodeURIComponent(artistId)}`
}
