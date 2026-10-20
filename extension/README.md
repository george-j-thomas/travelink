# travel-ink browser extension

v0 adds a floating **Add @handle** button to Instagram profile pages in desktop Chrome, Brave and Edge. Clicking it opens travel-ink's Add page for that handle (`<origin>/artists/add?handle=<handle>`) in a new tab, where you confirm and add the artist as usual. The extension never adds anything itself.

## What it does

- A content script runs on `https://www.instagram.com/*` and reads the handle from the page's URL path. The button shows on profile pages: the profile itself (`/<handle>/`), its tabs (`/<handle>/tagged/`, `/<handle>/reels/`…) and posts opened from it (`/<handle>/p/<id>/`). It's hidden everywhere else: the feed, `/p/…`, `/reel/…`, `/reels/`, `/stories/…`, `/explore/…`, `/direct/…`, `/accounts/…`, notifications, settings and so on.
- The handle rules and the list of reserved Instagram routes come from the app's `src/lib/instagram-handle.ts`, bundled in, so the extension and the Add page agree on what a handle is. If the button shows on an Instagram page that isn't a profile, add that page's first path segment to `NON_PROFILE_PATHS` there. That also changes which links the app's Add page accepts, and the extension only picks it up when it's rebuilt.
- Instagram is a single-page app, so the script checks the path every 500 ms, and on back/forward, and updates the button when the path changes. If Instagram's re-rendering removes the button while you stay on the same profile, it comes back within about 0.5 s.
- It makes no Instagram API calls, reads no cookies and doesn't scrape the page: it only uses the URL. It also never calls travel-ink, because the button is a plain link.
- It asks for no permissions: no `permissions`, no `host_permissions`, no service worker, no popup. The content-script match is its only access.
- It can't tell whether a profile exists. On Instagram's "page isn't available" page for a handle that looks valid, the button still shows.

## The button

- It sits at the bottom right, raised above Instagram's floating Messages pill, so it stays clear of the left nav and the profile header. When Instagram mirrors its layout for a right-to-left language, it moves to the bottom left.
- It shows the travel-ink badge and wordmark, **Add @handle** and a minimize button. Minimizing shrinks it to the badge for the rest of the page session: it stays minimized on other profiles until the page reloads. The badge is still the link, and hovering or focusing it shows "Add @handle to travel-ink". Windows narrower than 600px always get the badge alone.
- The link opens in a new tab with no opener and no referrer (`rel="noopener noreferrer"`, `referrerpolicy="no-referrer"`).
- It renders in a closed shadow root on its own `<travelink-add-button>` element at the end of `<body>`, and never reads or changes Instagram's markup. Styles go in as a constructed stylesheet (`adoptedStyleSheets`), which Instagram's CSP doesn't block, and the DOM is built without `innerHTML`.
- It stays below Instagram's dialogs, menus and popovers (`HOST_Z_INDEX` in `src/button.ts`).

## On travel-ink

The Add page reads `?handle=` once and removes it from the address bar. It fills in and focuses the field and shows the usual suggestions, so you can see whether the artist is already on your list. Only travel-ink's own directory is searched, because the new tab has no Instagram cookie. Nothing is added until you click a suggestion or press Enter.

If you're signed out, you sign in first and come back to the Add page. One gap: if travel-ink refuses an Instagram sign-in, the login page loses the way back, so signing in with a password after that goes to the map.

## Layout

```
extension/
  manifest.json        MV3 manifest, copied to dist/
  build.mjs            build script (esbuild for the scripts, sharp for the icons)
  tsconfig.json        strict, DOM + chrome types
  icons/icon.svg       square source icon, rendered to dist/icons/icon-{16,32,48,128}.png
  src/content.ts       content script: follows navigation, shows or hides the button
  src/profile-path.ts  pure path → handle function (no DOM)
  src/button.ts        the button UI: createAddButton() → { show(handle, href): boolean, hide() }
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

`TRAVELINK_URL` sets the travel-ink origin the button links to. It's fixed at build time and defaults to `http://localhost:3000`.

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

## Chrome Web Store zip

The store wants a zip with `manifest.json` at its root, so zip the contents of `dist/`, not the folder. Build with travel-ink's production origin first (the same origin as the app's `NEXTAUTH_URL`):

```sh
TRAVELINK_URL=https://<travel-ink domain> npm run ext:build
rm -f extension/travelink-extension.zip
(cd extension/dist && zip -r -X ../travelink-extension.zip .)
```

Zips in `extension/` are gitignored. Bump `version` in `manifest.json` before each upload, because the store rejects a version it already has.

## Extending

- To add a script (such as a v1 service worker), add its source to `ENTRY_POINTS` in `build.mjs`, reference the built `.js` in `manifest.json`, and list that reference in `checkManifestFiles`, so the build fails if the file is missing.
- Scripts get the travel-ink origin from `TRAVELINK_ORIGIN` in `src/config.ts`. A host permission for travel-ink should come from the same validated origin in `build.mjs`, not be hardcoded in `manifest.json`.
- Planned for v1 (not built): add the artist in place through a service worker with a host permission for the travel-ink origin, and show "✓ On your list" from a new endpoint that checks one exact handle.
