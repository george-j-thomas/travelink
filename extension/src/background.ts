// Service worker: the only part of the extension that calls travel-ink. It answers the content
// script's "check" and "add" messages with the user's travel-ink session (the host permission for
// TRAVELINK_ORIGIN makes Chrome send its cookies). It never calls Instagram.
import { isValidHandle, normalizeHandle } from "../../src/lib/instagram-handle"
import { TRAVELINK_ORIGIN } from "./config"
import { addPageUrl } from "./links"
import type { ExtensionRequest, ExtensionResponse } from "./messages"

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

async function respond(request: ExtensionRequest, tab: chrome.tabs.Tab | undefined): Promise<ExtensionResponse> {
  const handle = normalizeHandle(request.handle)
  if (!isValidHandle(handle)) return { result: "error", message: "That isn't a valid Instagram handle." }
  try {
    return request.type === "check" ? await check(handle) : await add(handle)
  } catch (err) {
    if (err instanceof SignedOutError) {
      listCache = null
      // After a click, send the user to sign in; the Add page brings them back to this handle.
      if (request.type === "add") {
        await chrome.tabs
          .create({
            url: addPageUrl(handle),
            ...(tab?.index !== undefined ? { index: tab.index + 1 } : {}),
            ...(tab?.id !== undefined ? { openerTabId: tab.id } : {}),
          })
          .catch((tabError: unknown) => console.warn("[travel-ink]", { event: "tabs.create.failed", error: String(tabError) }))
      }
      return { result: "signed-out" }
    }
    return { result: "error", message: err instanceof Error ? err.message : FAILED }
  }
}

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
