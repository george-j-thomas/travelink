// Service worker: the only part of the extension that calls travel-ink. It answers the content
// script's "check" and "add" messages with the user's travel-ink session (the host permission for
// TRAVELINK_ORIGIN makes Chrome send its cookies), and finishes an add once a signed-out user
// has signed in. It never calls Instagram.
import { isValidHandle, normalizeHandle } from "../../src/lib/instagram-handle"
import { TRAVELINK_ORIGIN } from "./config"
import { addAfterSignInUrl, addPageUrl, artistPageUrl } from "./links"
import type { ExtensionPush, ExtensionRequest, ExtensionResponse } from "./messages"

const INSTAGRAM_ORIGIN = "https://www.instagram.com"
const CHECK_TIMEOUT_MS = 10_000
// How long the user's list is reused before checking a profile fetches it again. Short, so
// changes made on travel-ink show up soon.
const LIST_TTL_MS = 30_000
// Adding a new artist also fetches their bio (Instagram, Claude, Mapbox), which can take a while.
const ADD_TIMEOUT_MS = 60_000

const UNREACHABLE = "Couldn't reach travel-ink. Try again."
const FAILED = "Something went wrong on travel-ink. Try again."

/** Thrown for a 401: no travel-ink session (or it ended). */
class SignedOutError extends Error {}

async function callTravelink(path: string, init: RequestInit, timeoutMs: number): Promise<unknown> {
  let response: Response
  try {
    response = await fetch(`${TRAVELINK_ORIGIN}${path}`, {
      ...init,
      credentials: "include",
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (err) {
    console.warn("[travel-ink]", { event: "fetch.failed", path, error: String(err) })
    throw new Error(UNREACHABLE)
  }
  if (response.status === 401) throw new SignedOutError()

  let body: unknown = null
  try {
    body = await response.json()
  } catch {
    // Not JSON (a proxy error page, say); handled below by the status.
  }
  if (!response.ok) {
    console.warn("[travel-ink]", { event: "fetch.error", path, status: response.status })
    // 400s carry a message meant for the user (e.g. an invalid handle); anything else doesn't.
    const message = (body as { error?: unknown } | null)?.error
    throw new Error(response.status === 400 && typeof message === "string" ? message : FAILED)
  }
  return body
}

/** The user's list (handle → artist ID), fetched once and kept briefly, so checking a profile
 * doesn't tell travel-ink which profile it is. Lost when Chrome stops the service worker. */
let listCache: { fetchedAt: number; artists: Map<string, string> } | null = null
let listRequest: Promise<Map<string, string>> | null = null

async function userList(): Promise<Map<string, string>> {
  if (listCache && Date.now() - listCache.fetchedAt < LIST_TTL_MS) return listCache.artists
  // Profiles opened while the list loads share one request.
  listRequest ??= (async () => {
    try {
      const body = (await callTravelink("/api/artists/handles", { method: "GET" }, CHECK_TIMEOUT_MS)) as {
        artists?: { handle?: unknown; artistId?: unknown }[]
      }
      const artists = new Map<string, string>()
      for (const { handle, artistId } of body.artists ?? []) {
        if (typeof handle === "string" && typeof artistId === "string") artists.set(handle, artistId)
      }
      listCache = { fetchedAt: Date.now(), artists }
      return artists
    } finally {
      listRequest = null
    }
  })()
  return listRequest
}

async function check(handle: string): Promise<ExtensionResponse> {
  const artistId = (await userList()).get(handle)
  return artistId ? { result: "on-list", artistId } : { result: "not-on-list" }
}

async function add(handle: string): Promise<ExtensionResponse> {
  // Only the handle: the extension doesn't read the page, so it has no name or photo to send.
  const body = (await callTravelink(
    "/api/artists",
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ handle }) },
    ADD_TIMEOUT_MS,
  )) as { artist?: { id?: unknown }; status?: unknown; warnings?: unknown }
  const artistId = body.artist?.id
  if (typeof artistId !== "string") throw new Error(FAILED)
  listCache?.artists.set(handle, artistId)
  const warnings = Array.isArray(body.warnings) ? body.warnings.filter((w): w is string => typeof w === "string") : []
  return { result: "added", artistId, existing: body.status === "existing", warnings }
}

/** Runs a check or an add. A 401 comes back as "signed-out" (and forgets the cached list). */
async function run(type: ExtensionRequest["type"], handle: string): Promise<ExtensionResponse> {
  try {
    return type === "check" ? await check(handle) : await add(handle)
  } catch (err) {
    if (err instanceof SignedOutError) {
      listCache = null
      return { result: "signed-out" }
    }
    return { result: "error", message: err instanceof Error ? err.message : FAILED }
  }
}

async function respond(request: ExtensionRequest, tab: chrome.tabs.Tab | undefined): Promise<ExtensionResponse> {
  const handle = normalizeHandle(request.handle)
  if (!isValidHandle(handle)) return { result: "error", message: "That isn't a valid Instagram handle." }
  const response = await run(request.type, handle)
  // After a click, send the user to sign in. The add finishes once they have (below).
  if (request.type === "add" && response.result === "signed-out") await openSignIn(handle, tab)
  return response
}

// ---------------------------------------------------------------------------
// Finishing an add after the user signs in
// ---------------------------------------------------------------------------
//
// A click on "Add" while signed out opens the Add page in a new tab (the site sends the user
// through its login page first), marked so that it shows the add's progress rather than the form.
// That tab is remembered here with the handle. Once it reaches a page only signed-in users can
// open, the user is signed in, so the add the click asked for goes ahead: the artist's page
// replaces the one the user landed on, and the Instagram tab they clicked in shows the result. If
// the add still can't happen (e.g. Brave doesn't send the cookie), the Add page's form replaces
// it instead, with the handle filled in.
//
// Remembered in chrome.storage.session (memory only, cleared when the browser closes), since
// Chrome stops an idle service worker within 30 seconds, often before the user has signed in.
// Only travel-ink tabs this service worker opened, for at most PENDING_TTL_MS, and each one once.

const PENDING_KEY = "pendingSignIns"
const PENDING_TTL_MS = 30 * 60_000
// The pages travel-ink's middleware keeps signed-out users away from (src/middleware.ts).
const SIGNED_IN_PATHS = ["/artists", "/map", "/admin"]

interface PendingSignIn {
  handle: string
  /** The Instagram tab the user clicked in, told about the add. */
  sourceTabId: number | null
  createdAt: number
}
/** By the travel-ink tab's ID. */
type PendingSignIns = Record<string, PendingSignIn>

async function loadPending(): Promise<PendingSignIns> {
  const stored = (await chrome.storage.session.get(PENDING_KEY))[PENDING_KEY] as PendingSignIns | undefined
  const now = Date.now()
  return Object.fromEntries(Object.entries(stored ?? {}).filter(([, pending]) => now - pending.createdAt < PENDING_TTL_MS))
}

// Changes run one at a time, so two of them can't both read the old value (and a tab's add can't
// be taken twice).
let pendingChanges: Promise<unknown> = Promise.resolve()

function changePending<T>(change: (all: PendingSignIns) => T): Promise<T> {
  const result = pendingChanges.then(async () => {
    const all = await loadPending()
    const value = change(all)
    await chrome.storage.session.set({ [PENDING_KEY]: all })
    return value
  })
  pendingChanges = result.catch(() => undefined)
  return result
}

async function openSignIn(handle: string, sourceTab: chrome.tabs.Tab | undefined): Promise<void> {
  try {
    // Clicked again: bring back the tab that's already open for this handle rather than opening
    // (and later adding from) another one.
    for (const [tabId, pending] of Object.entries(await loadPending())) {
      if (pending.handle !== handle) continue
      const open = await chrome.tabs.get(Number(tabId)).catch(() => null)
      if (!open?.id) continue
      await chrome.tabs.update(open.id, { active: true })
      if (open.windowId !== undefined) await chrome.windows.update(open.windowId, { focused: true }).catch(() => undefined)
      return
    }
    const tab = await chrome.tabs.create({
      url: addAfterSignInUrl(handle),
      ...(sourceTab?.index !== undefined ? { index: sourceTab.index + 1 } : {}),
      ...(sourceTab?.id !== undefined ? { openerTabId: sourceTab.id } : {}),
    })
    const tabId = tab.id
    if (tabId === undefined) return
    await changePending((all) => {
      all[tabId] = { handle, sourceTabId: sourceTab?.id ?? null, createdAt: Date.now() }
    })
  } catch (err) {
    console.warn("[travel-ink]", { event: "sign-in.open.failed", error: String(err) })
  }
}

/** The path of `url` when it's a travel-ink page only signed-in users can open, else null. */
function signedInPath(url: string | undefined): string | null {
  if (!url) return null
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  if (parsed.origin !== TRAVELINK_ORIGIN) return null
  const { pathname } = parsed
  return SIGNED_IN_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`)) ? pathname : null
}

function tell(tabId: number | null, push: ExtensionPush): void {
  if (tabId === null) return
  // The tab may have been closed or reloaded since; then there's no one to tell.
  chrome.tabs.sendMessage(tabId, push).catch(() => undefined)
}

async function finishAddAfterSignIn(tabId: number, landedOn: string): Promise<void> {
  if (!(await loadPending())[tabId]) return
  const pending = await changePending((all) => {
    const taken = all[tabId] ?? null
    // One add per handle, even if other tabs were somehow opened for it too.
    for (const [id, other] of Object.entries(all)) {
      if (id === String(tabId) || (taken && other.handle === taken.handle)) delete all[id]
    }
    return taken
  })
  if (!pending) return
  const { handle, sourceTabId } = pending
  console.debug("[travel-ink]", { event: "add-after-sign-in.start", handle })
  tell(sourceTabId, { type: "add-started", handle })
  const response = await run("add", handle)
  console.debug("[travel-ink]", { event: "add-after-sign-in.done", handle, result: response.result })
  tell(sourceTabId, { type: "add-finished", handle, response })
  // Show the artist, or the form to add them by hand if that didn't work, unless the user has
  // already moved on from the page they landed on.
  const tab = await chrome.tabs.get(tabId).catch(() => null)
  if (signedInPath(tab?.url) !== landedOn) return
  const url = response.result === "added" ? artistPageUrl(response.artistId) : addPageUrl(handle)
  await chrome.tabs
    .update(tabId, { url })
    .catch((err: unknown) => console.warn("[travel-ink]", { event: "tabs.update.failed", error: String(err) }))
}

// Fires for every tab, but tab.url is only filled in for travel-ink's origin (the host
// permission); other tabs stop at the first check.
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url === undefined && changeInfo.status !== "complete") return
  const path = signedInPath(tab.url)
  if (path) void finishAddAfterSignIn(tabId, path)
})

chrome.tabs.onRemoved.addListener((tabId) => {
  void loadPending().then((all) => {
    if (!all[tabId]) return
    void changePending((latest) => {
      delete latest[tabId]
    })
  })
})

function isExtensionRequest(message: unknown): message is ExtensionRequest {
  const { type, handle } = (message ?? {}) as { type?: unknown; handle?: unknown }
  return (type === "check" || type === "add") && typeof handle === "string"
}

chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
  // Only our own content script on Instagram. (Without externally_connectable, web pages can't
  // message the extension at all; this also rules out any other extension page.)
  if (sender.id !== chrome.runtime.id || sender.origin !== INSTAGRAM_ORIGIN || !isExtensionRequest(message)) {
    return false
  }
  console.debug("[travel-ink]", { event: `${message.type}.start`, handle: message.handle })
  respond(message, sender.tab).then((response) => {
    console.debug("[travel-ink]", { event: `${message.type}.done`, handle: message.handle, result: response.result })
    sendResponse(response)
  })
  // Keeps the channel open for the async response.
  return true
})
