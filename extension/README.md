# travel-ink browser extension

v1 adds a floating **Add @handle** button to Instagram profile pages in desktop Chrome, Brave and Edge. Clicking it adds the artist to your travel-ink list without leaving Instagram, and profiles already on your list show **On your list** instead. The click is the confirmation: the extension never adds anything on its own. If you're signed out, the click opens travel-ink to sign in, and the artist is added as soon as you have.

## What it does

- A content script runs on `https://www.instagram.com/*` and reads the handle from the page's URL path. The button shows on profile pages: the profile itself (`/<handle>/`), its tabs (`/<handle>/tagged/`, `/<handle>/reels/`…) and posts opened from it (`/<handle>/p/<id>/`). It's hidden everywhere else: the feed, `/p/…`, `/reel/…`, `/reels/`, `/stories/…`, `/explore/…`, `/direct/…`, `/accounts/…`, notifications, settings and so on.
- The handle rules and the list of reserved Instagram routes come from the app's `src/lib/instagram-handle.ts`, bundled in, so the extension and the Add page agree on what a handle is. If the button shows on an Instagram page that isn't a profile, add that page's first path segment to `NON_PROFILE_PATHS` there. That also changes which links the app's Add page accepts, and the extension only picks it up when it's rebuilt.
- Instagram is a single-page app, so the script checks the path every 500 ms, and on back/forward, and updates the button when the path changes. If Instagram's re-rendering removes the button while you stay on the same profile, it comes back within about 0.5 s.
- It makes no Instagram API calls, reads no cookies and doesn't scrape the page: it only uses the URL.
- Only the service worker (`src/background.ts`) talks to travel-ink. Content scripts can't: their cross-origin requests are blocked even with a host permission. The content script sends it `{ type: "check" | "add", handle }` with `chrome.runtime.sendMessage`. The service worker only answers its own content script on `https://www.instagram.com` (it checks `sender.id` and `sender.origin`), checks the handle again with `isValidHandle`, and builds the travel-ink URLs itself.
- Its only access is the content script, one host permission, for the travel-ink origin it was built with, and the `storage` permission (no install warning) for `chrome.storage.session`, which remembers an add waiting for you to sign in. No `cookies` or `tabs` permission, no popup.

## Talking to travel-ink

- **Signing in:** the service worker's requests use `credentials: "include"`. With a host permission for travel-ink, Chrome treats them as same-site, so they carry the travel-ink login cookie (NextAuth, `SameSite=Lax`) and the API's usual `requireSession()` works unchanged. Where third-party cookies are blocked (Brave by default), the cookie isn't sent and the button always says **Sign in to travel-ink**. A "Connect extension" token for those browsers isn't built yet.
- **On your list:** `GET /api/artists/handles` returns the handles on your list. The service worker fetches the whole list and matches profiles itself, so travel-ink never learns which Instagram profiles you open. It keeps the list for 30 s, adds to it after each add, and drops it on a 401. Chrome stops idle service workers, and the list goes with it.
- **Adding:** `POST /api/artists` with `{ handle }` only, since the extension doesn't read the page. Like the Add page, it fetches the bio straight away (Business Discovery, Claude, geocoding, photo), so an add can take several seconds; the service worker waits up to 60 s. If Instagram is throttling, the artist stays pending and the bio arrives the next time you open travel-ink, since the bio queue only runs in a travel-ink tab.
- **Signed out (401):** the button becomes **Sign in to travel-ink**. Clicking it (or **Add**, if you turn out to be signed out) is still an add: the service worker opens the Add page (`/artists/add?handle=…`) in a new tab next to Instagram, which takes you through travel-ink's login page first, and the button says the artist is added once you've signed in there.
- **Adding after signing in:** the service worker remembers that tab and the handle in `chrome.storage.session` (Chrome stops an idle service worker within 30 s, often before you've signed in; session storage is cleared when the browser closes). When the tab reaches a page only signed-in users can open (`/artists…`, `/map…`, `/admin…`, the pages `src/middleware.ts` protects), it takes the handle off the list (so it's added once) and adds it. The tab then goes to the artist's page, unless you've already moved on from the page you landed on, and the Instagram tab you clicked in shows the result (`chrome.tabs.sendMessage`: `add-started`, then `add-finished`). It only ever acts on tabs it opened itself, never on a travel-ink link opened any other way, and forgets a tab when it's closed or after 30 minutes. If the add still can't happen (e.g. Brave doesn't send the cookie), the Add page stays open with the handle filled in.
- **Errors:** if travel-ink can't be reached or fails, the button says **Couldn't add. Try again** and keeps the reason in its tooltip. A 400's message (e.g. an invalid handle) is shown as is. If the service worker can't be reached at all (the extension was updated under an open tab), the button falls back to v0's link to the Add page.

## The button

- It sits at the bottom right, raised above Instagram's floating Messages pill, so it stays clear of the left nav and the profile header. When Instagram mirrors its layout for a right-to-left language, it moves to the bottom left.
- It shows the travel-ink badge and wordmark, the action and a minimize button. Minimizing shrinks it to the badge: it stays minimized on other profiles until you click the badge, which expands it again (it doesn't add or open anything while minimized), or the page reloads. Hovering or focusing the badge shows the button's state. Windows narrower than 600px always get the badge alone, and there the badge is the control.
- States (`ButtonState` in `src/button.ts`):

  | State | Shows | Control |
  |---|---|---|
  | `add` | Add @handle | button: adds in place |
  | `adding` | Adding @handle… | the same button, `aria-busy`; a second click does nothing |
  | `added` | Added to your list / Already on your list, plus any warning from travel-ink (in amber) | link to the artist's travel-ink page |
  | `on-list` | On your list (check mark badge) | link to the artist's travel-ink page |
  | `sign-in` | Sign in to travel-ink; after a click, a note that the artist is added once you've signed in | button: opens travel-ink to sign in, then adds |
  | `failed` | Couldn't add. Try again | button: adds again |
  | `add-link` | Add @handle | v0's link to the Add page (no service worker) |

- A profile shows `add` until the check answers. The content script remembers each handle's state for the page session and asks again when you open the profile again or come back to the tab.
- Only real clicks add: the click handler ignores events a page script dispatches (`event.isTrusted`).
- A visually hidden live region announces "Adding…", "Added…" and failures to screen readers.
- Links open in a new tab with no opener and no referrer (`rel="noopener noreferrer"`, `referrerpolicy="no-referrer"`).
- It renders in a closed shadow root on its own `<travelink-add-button>` element at the end of `<body>`, and never reads or changes Instagram's markup. Styles go in as a constructed stylesheet (`adoptedStyleSheets`), which Instagram's CSP doesn't block, and the DOM is built without `innerHTML`.
- It stays below Instagram's dialogs, menus and popovers (`HOST_Z_INDEX` in `src/button.ts`).

## On travel-ink

When the extension opens the Add page (signed out, or v0's link when there's no service worker), the Add page reads `?handle=` once and removes it from the address bar. It fills in and focuses the field and shows the usual suggestions. Only travel-ink's own directory is searched, because the new tab has no Instagram cookie. The page itself never adds anything until you click a suggestion or press Enter; after a signed-out click, the service worker does the add (above).

If you're signed out, you sign in first and come back to the Add page. One gap: if travel-ink refuses an Instagram sign-in, the login page loses the way back, so signing in with a password after that goes to the map.

## Layout

```
extension/
  manifest.json        MV3 manifest, copied to dist/
  build.mjs            build script (esbuild for the scripts, sharp for the icons)
  tsconfig.json        strict, DOM + chrome types
  icons/icon.svg       square source icon, rendered to dist/icons/icon-{16,32,48,128}.png
  src/content.ts       content script: follows navigation, asks the service worker, sets the button's state
  src/background.ts    service worker: the only code that calls travel-ink (check and add)
  src/messages.ts      the messages between the two
  src/profile-path.ts  pure path → handle function (no DOM)
  src/button.ts        the button UI: createAddButton({ onAdd }) → { show(handle, state): boolean, hide() }
  src/links.ts         travel-ink URLs (Add page, artist page)
  src/config.ts        travel-ink origin, set at build time
  dist/                build output, the folder you load (gitignored)
```

## Build

Use the repo's Node 24 (`nvm use`). The build needs Node 20.9 or later, for sharp, and stops on older versions. There's no `package.json` here: esbuild, sharp and `@types/chrome` come from the root `npm install`. Run these from the repo root:

```sh
npm run ext:build       # build into extension/dist/
npm run ext:watch       # rebuild the scripts on change, with inline source maps
npm run ext:typecheck   # type check with extension/tsconfig.json
npm run lint            # the root ESLint run covers extension/ too
```

`ext:watch` only rebuilds the scripts. Restart it after editing `manifest.json` or `icons/icon.svg`. The root `tsconfig.json` excludes `extension/`, so Next's type check and build never see it.

### `TRAVELINK_URL`

`TRAVELINK_URL` sets the travel-ink origin: where the service worker sends requests, where the button links to, and the extension's one host permission (`<origin>/*`), which the build adds to the manifest. Don't list host permissions in `manifest.json`: the build fails if you do. It's fixed at build time and defaults to `http://localhost:3000`.

- It must be a bare origin: scheme, host and optional port, with no path, query or fragment. One trailing slash is fine.
- It must use https, except on `localhost` and `127.0.0.1`.

Otherwise the build fails and says why. The build logs the origin it used, and `ext:build` warns when it's a local one. It's read from the shell, not from `.env`.

```sh
TRAVELINK_URL=https://<travel-ink domain> npm run ext:build
```

## Load it unpacked (Chrome, Brave, Edge)

1. Run `npm run ext:build`.
2. Open `chrome://extensions` (Brave: `brave://extensions`, Edge: `edge://extensions`).
3. Turn on **Developer mode** (top right; in Edge it's in the left sidebar).
4. Click **Load unpacked** and pick `extension/dist/`, not `extension/`.
5. With the default origin, start the app too (`npm run dev`). Open an Instagram profile: the button appears.

After a rebuild, click the extension's reload button on the extensions page, then reload the Instagram tab: open tabs keep the old content script. In DevTools, `content.js` is under Sources → Content scripts.

The content script writes `console.debug` messages prefixed `[travel-ink]` when it starts and when it shows, hides or reattaches the button. They're only visible with Chrome's **Verbose** log level.

The service worker has its own console: click **service worker** on the extension's card on the extensions page. It logs each `check` and `add` (`[travel-ink]`, Verbose) and warns when a request to travel-ink fails. To test signing in and out locally, turn off `DEV_AUTH_BYPASS` (in `.env.local`), which otherwise makes every request the dev user.

## Chrome Web Store zip

The store wants a zip with `manifest.json` at its root, so zip the contents of `dist/`, not the folder. Build with travel-ink's production origin first (the same origin as the app's `NEXTAUTH_URL`):

```sh
TRAVELINK_URL=https://<travel-ink domain> npm run ext:build
rm -f extension/travelink-extension.zip
(cd extension/dist && zip -r -X ../travelink-extension.zip .)
```

Zips in `extension/` are gitignored. Bump `version` in `manifest.json` before each upload, because the store rejects a version it already has.

Before the first upload:

- Once the listing is live, set `EXTENSION_STORE_URL` in `src/lib/extension.ts` to its URL. The Artists page's extension card then links to it (it says "Coming soon" until then), and the empty state makes the extension the main way to add artists.
- The store needs a privacy policy: the extension sends handles to travel-ink with the user's login cookie. travel-ink doesn't have a privacy policy page yet.
- The store warns that the extension can read and change data on www.instagram.com and on the travel-ink host. The listing should say why: the button on profiles, and adding to your travel-ink list.
- A host permission added in an update disables existing installs until users accept it. Nothing is on the store yet, so the first published version can include it without disabling anyone's install.

## Extending

- To add a script, add its source to `ENTRY_POINTS` in `build.mjs`, reference the built `.js` in `manifest.json`, and list that reference in `checkManifestFiles` (it already covers content scripts and the service worker), so the build fails if the file is missing.
- Scripts get the travel-ink origin from `TRAVELINK_ORIGIN` in `src/config.ts`. The host permission comes from the same validated origin in `build.mjs` (`buildManifest`), never from `manifest.json`.
- Never let the content script make the service worker request an arbitrary URL: messages carry a handle, and the service worker builds the URL.
- Not built yet: a "Connect extension" token for browsers that block third-party cookies (Brave by default). travel-ink would issue a long random token per user and store only its hash; the extension would keep it in `chrome.storage.local` and send it as a bearer token; only the extension's routes would accept it, still rejecting deleted or disabled users like `requireSession()`.
