// Messages between the content script and the service worker. Only the service worker talks to
// travel-ink: it has the host permission, so its requests carry the user's travel-ink session
// cookie and skip CORS. Content scripts can't do either.

export type ExtensionRequest =
  /** Is this handle on the signed-in user's list? (Matched against GET /api/artists/handles.) */
  | { type: "check"; handle: string }
  /** Add this handle to the signed-in user's list (POST /api/artists). The user's click. */
  | { type: "add"; handle: string }

export type ExtensionResponse =
  | { result: "on-list"; artistId: string }
  | { result: "not-on-list" }
  /** Answers "add": `existing` when it was already on the list. Warnings come from travel-ink. */
  | { result: "added"; artistId: string; existing: boolean; warnings: string[] }
  /** No travel-ink session. After an "add", the service worker has opened the Add page. */
  | { result: "signed-out" }
  | { result: "error"; message: string }
