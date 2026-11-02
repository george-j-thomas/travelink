// Links into travel-ink. The origin is fixed at build time (src/config.ts).
import { TRAVELINK_ORIGIN } from "./config"

/** The Add page with the handle filled in (it signs the user in first if needed). */
export function addPageUrl(handle: string): string {
  return `${TRAVELINK_ORIGIN}/artists/add?handle=${encodeURIComponent(handle)}`
}

/** The artist's page on travel-ink. */
export function artistPageUrl(artistId: string): string {
  return `${TRAVELINK_ORIGIN}/artists/${encodeURIComponent(artistId)}`
}
