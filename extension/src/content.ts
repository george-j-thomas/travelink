// Content script for www.instagram.com: shows the "Add to travel-ink" button on profile pages.
// It only reads the handle from the page's URL path. No Instagram API calls, no cookies, no
// scraping. Checking and adding go through the service worker (src/background.ts), the only part
// that calls travel-ink.
import { createAddButton, type ButtonState } from "./button"
import { TRAVELINK_ORIGIN } from "./config"
import { addPageUrl, artistPageUrl } from "./links"
import type { ExtensionRequest, ExtensionResponse } from "./messages"
import { profileHandleFromPath } from "./profile-path"

// Instagram is a single-page app: it navigates with history.pushState, which fires no event a
// content script can see, so the page is checked on a timer. The button follows navigation within
// half a second, and comes back as quickly when Instagram's re-rendering takes it off the page.
const CHECK_INTERVAL_MS = 500

/** Asks the service worker. Null when it can't be reached (e.g. the extension was reloaded). */
async function ask(request: ExtensionRequest): Promise<ExtensionResponse | null> {
  try {
    return ((await chrome.runtime.sendMessage(request)) as ExtensionResponse | undefined) ?? null
  } catch (err) {
    console.debug("[travel-ink]", { event: "message.failed", type: request.type, error: String(err) })
    return null
  }
}

function start(): void {
  console.debug("[travel-ink]", { event: "content-script.start", origin: TRAVELINK_ORIGIN })
  // What we know about each handle seen this page session. Handles not in here show "add".
  const states = new Map<string, ButtonState>()
  const stateOf = (handle: string): ButtonState => states.get(handle) ?? { kind: "add" }
  // Bumped when an add starts, so a check sent before it can't overwrite its result.
  const addsStarted = new Map<string, number>()

  let syncedPath = location.pathname
  let handle = profileHandleFromPath(syncedPath)

  const setState = (forHandle: string, state: ButtonState): void => {
    states.set(forHandle, state)
    if (forHandle === handle) button.show(forHandle, state)
  }

  /** Whether `forHandle` is on the user's list. Never overrides an add. */
  const check = async (forHandle: string): Promise<void> => {
    const adds = addsStarted.get(forHandle) ?? 0
    const response = await ask({ type: "check", handle: forHandle })
    if ((addsStarted.get(forHandle) ?? 0) !== adds) return
    if (stateOf(forHandle).kind === "adding") return
    if (!response) {
      // No service worker (e.g. the extension was updated under this page): v0's Add page link.
      setState(forHandle, { kind: "add-link", href: addPageUrl(forHandle) })
      return
    }
    switch (response.result) {
      case "on-list":
      case "added":
        setState(forHandle, { kind: "on-list", href: artistPageUrl(response.artistId) })
        break
      case "not-on-list":
        setState(forHandle, { kind: "add" })
        break
      case "signed-out":
        setState(forHandle, { kind: "sign-in", href: addPageUrl(forHandle) })
        break
      case "error":
        // Keep what's showing. If travel-ink is down, adding says so.
        console.debug("[travel-ink]", { event: "check.error", handle: forHandle, message: response.message })
        break
    }
  }

  const add = async (forHandle: string): Promise<void> => {
    if (stateOf(forHandle).kind === "adding") return
    addsStarted.set(forHandle, (addsStarted.get(forHandle) ?? 0) + 1)
    setState(forHandle, { kind: "adding" })
    const response = await ask({ type: "add", handle: forHandle })
    if (!response) {
      setState(forHandle, { kind: "add-link", href: addPageUrl(forHandle) })
      return
    }
    switch (response.result) {
      case "added":
        setState(forHandle, {
          kind: "added",
          href: artistPageUrl(response.artistId),
          existing: response.existing,
          warning: response.warnings.length > 0 ? response.warnings.join(" ") : null,
        })
        break
      case "on-list":
        setState(forHandle, { kind: "on-list", href: artistPageUrl(response.artistId) })
        break
      case "signed-out":
        // The service worker opened the Add page, where the user signs in and comes back to it.
        setState(forHandle, { kind: "sign-in", href: addPageUrl(forHandle) })
        break
      case "not-on-list":
      case "error":
        setState(forHandle, {
          kind: "failed",
          message: response.result === "error" ? response.message : "Something went wrong. Try again.",
        })
        break
    }
  }

  const button = createAddButton({ onAdd: (forHandle) => void add(forHandle) })

  /** Shows the button for the current profile (and checks it), or hides it elsewhere. */
  const sync = (): void => {
    if (handle) {
      button.show(handle, stateOf(handle))
      console.debug("[travel-ink]", { event: "button.show", path: syncedPath, handle })
      void check(handle)
    } else {
      button.hide()
      console.debug("[travel-ink]", { event: "button.hide", path: syncedPath })
    }
  }
  sync()

  // Runs every tick, so it stays trivial: one string compare, plus on profile pages a show() that
  // changes nothing unless the button was taken off the page.
  const tick = (): void => {
    const path = location.pathname
    if (path !== syncedPath) {
      const previous = handle
      syncedPath = path
      handle = profileHandleFromPath(path)
      // Moving between a profile's tabs and posts keeps the handle, so there's nothing to update.
      if (handle !== previous) sync()
      return
    }
    // Same page: if Instagram's re-rendering removed the button, show() puts it back.
    if (handle && button.show(handle, stateOf(handle))) {
      console.debug("[travel-ink]", { event: "button.reattach", path, handle })
    }
  }
  setInterval(tick, CHECK_INTERVAL_MS)
  // Back/forward fires popstate, so those update straight away.
  window.addEventListener("popstate", tick)
  // Back on this tab: the list may have changed on travel-ink meanwhile (added, removed, signed
  // in or out).
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && handle) void check(handle)
  })
}

start()
