// The travel-ink browser extension's public listing. Client-safe (no server-only imports): the
// Artists page reads it.

/**
 * The extension's Chrome Web Store page, or null until it's published. While null, the app
 * describes the extension as coming soon and keeps the import as the main way to add artists.
 * Set it once the listing is live (Edge and Brave install from the Chrome Web Store too).
 */
export const EXTENSION_STORE_URL: string | null = null
