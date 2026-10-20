// Content script for www.instagram.com: shows the "Add to travel-ink" button on profile pages.
// It only reads the handle from the page's URL path. No Instagram API calls, no cookies, no scraping.
import { createAddButton, type AddButton } from "./button"
import { TRAVELINK_ORIGIN } from "./config"
import { profileHandleFromPath } from "./profile-path"

// Instagram is a single-page app: it navigates with history.pushState, which fires no event a
// content script can see, so the page is checked on a timer. The button follows navigation within
// half a second, and comes back as quickly when Instagram's re-rendering takes it off the page.
const CHECK_INTERVAL_MS = 500

/** The profile a page belongs to, and the travel-ink Add page link for it. */
interface Profile {
  handle: string
  href: string
}

function addArtistUrl(handle: string): string {
  return `${TRAVELINK_ORIGIN}/artists/add?handle=${encodeURIComponent(handle)}`
}

/** The profile at `path`, or null when `path` isn't a profile page. */
function profileAt(path: string): Profile | null {
  const handle = profileHandleFromPath(path)
  return handle ? { handle, href: addArtistUrl(handle) } : null
}

/** Shows the button for `profile`, or hides it on pages that aren't profiles. */
function syncButton(button: AddButton, path: string, profile: Profile | null): void {
  if (profile) {
    button.show(profile.handle, profile.href)
    console.debug("[travel-ink]", { event: "button.show", path, handle: profile.handle, href: profile.href })
  } else {
    button.hide()
    console.debug("[travel-ink]", { event: "button.hide", path })
  }
}

function start(): void {
  console.debug("[travel-ink]", { event: "content-script.start", origin: TRAVELINK_ORIGIN })
  const button = createAddButton()
  let syncedPath = location.pathname
  let profile = profileAt(syncedPath)
  syncButton(button, syncedPath, profile)

  // Runs every tick, so it stays trivial: one string compare, plus on profile pages a show() that
  // changes nothing unless the button was taken off the page.
  const check = (): void => {
    const path = location.pathname
    if (path !== syncedPath) {
      syncedPath = path
      profile = profileAt(path)
      syncButton(button, path, profile)
      return
    }
    // Same page: if Instagram's re-rendering removed the button, show() puts it back.
    if (profile && button.show(profile.handle, profile.href)) {
      console.debug("[travel-ink]", { event: "button.reattach", path, handle: profile.handle })
    }
  }
  setInterval(check, CHECK_INTERVAL_MS)
  // Back/forward fires popstate, so those update straight away.
  window.addEventListener("popstate", check)
}

start()
