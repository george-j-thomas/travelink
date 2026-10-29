# travel-ink — Project Guidelines

## Overview

Tattoo artist location tracker. Users import their Instagram following list, the app fetches artist bios via Instagram's Business Discovery API, extracts locations using Claude, and displays artists on a Mapbox map.

**Stack**: Next.js 15 (App Router, TypeScript) · Prisma 5 + PostgreSQL · NextAuth v4 · Claude API · Mapbox GL · Tailwind CSS v4 + shadcn/ui

## Architecture

### Route Groups
- `/` (`src/app/page.tsx`) — Public landing page: explains what travel-ink does, how it works and its main features, with a mock of the map (pure markup, `aria-hidden`). Invite links point here (`/?invite=CODE`) and its "Get started" buttons forward the code to `/register`. Signed-in users without an invite are redirected to `/map`.
- `(auth)` — Login, register. Centered layout, no navbar.
- `(app)` — All authenticated routes. Navbar + content layout.

### Key Layers
- `src/lib/` — Service modules. Each is self-contained with its own types, error classes, and a single public API:
  - `artist-pipeline.ts` — Orchestrator. `trackArtists` saves selected handles immediately as `fetchStatus: "pending"` stubs (no external calls); `fetchArtistBio` claims one artist (DB claim with TTL), then Business Discovery → Claude bio parse → Mapbox geocode → DB write (records `fetchSource`, `bioLastFetchedAt`) → stores a copy of the profile photo (`avatars.ts`, after the transaction; failures are only logged). The queue fetches never-fetched artists first, then refreshes (oldest bio first), then ones that errored. Bios are fetched once; `refreshArtistBio` (manual only) re-queues and claims an artist in one update, then fetches it, throwing `RecentlyRefreshedError` within `REFRESH_CONFIRM_WINDOW_MS` (72h) unless forced. `refreshAllArtistBios` puts a user's artists back in the queue (no claim, no external calls), skipping pending ones and, unless `includeRecent`, ones fetched within the window. A refresh that comes back unavailable keeps the old bio, locations and stored photo. `getKnownAccountTypes` reports which handles earlier lookups found to be business/personal (DB only)
  - `avatars.ts` — Stored profile photos. `storeArtistAvatar` downloads the Business Discovery profile picture (Instagram CDN hosts only, no redirects, 5s timeout, 2 MB cap), re-encodes it with sharp to a 240×240 WebP and upserts it into `artist_avatars`. `version` hashes the encoder settings with the source bytes, so an unchanged photo isn't re-encoded and a settings change gives every photo a new URL. Server-only (sharp, imported lazily by the pipeline); throws `AvatarError`; sharp may only load JPEG, PNG and WebP. The CDN download isn't metered (it's not a Graph API call). File tracing misses sharp's native binary, so every route that runs bio fetches must be listed in `outputFileTracingIncludes` in `next.config.ts`
  - `artist-dto.ts` — `serializeArtist`, the artist shape the API returns. Queries feeding it (or the map) include `ARTIST_DTO_INCLUDE`: locations plus the stored photo's `version`, never its bytes. `profilePicUrlFor` gives `/api/artists/[id]/avatar?v=<version>` when a photo is stored, else the Instagram link
  - `artist-directory.ts` — Add page search (DB only). `searchArtistDirectory` matches handle prefixes, name word prefixes and handle segments after `.`/`_` among the user's own artists (any account type), then the directory of artists other users added; at most 10, ranked exact handle → handle prefix → name → segment. `DIRECTORY_ARTIST_WHERE` (shared with the avatar route) decides who's in the directory: `accountType` `business` or `creator`, tracked by at least one user. Not `fetchStatus: "fetched"`, which early imports also set on personal accounts. Directory rows only get the stored photo, never `profilePicUrl` (that can be a hint from whoever added the artist). Prisma doesn't escape `%`/`_` in `contains`/`startsWith`, so user input goes through `escapeLike`
  - `instagram.ts` — Official Business Discovery client (`graph.facebook.com`, server-side token). Maps Graph errors to `RateLimitError` / `BusinessDiscoveryConfigError`; personal accounts come back as `profile: null`
  - `instagram-scraper.ts` — Cookie-based internal web API client, used **only** for the user's following list and for account search on the Add page (profile fetches from Vercel IPs get rate-limited instantly). `InstagramSession` keeps a per-request cookie jar and follows redirects manually (Instagram sets cookies via self-redirects); sends the user's own browser User-Agent. Following-list entries carry `isPrivate` — Instagram doesn't say which are business accounts, but Business/Creator accounts can't be private
  - `instagram-handle.ts` — Handle rules (`normalizeHandle`, `isValidHandle`) and profile-link parsing: `parseHandleInput` accepts a handle, `@handle` or an `instagram.com/<handle>` link (with or without `https://`, `www.`/`m.`, a trailing slash or a query string like `?igsh=`), and rejects posts, reels, stories and other non-profile paths (`NON_PROFILE_PATHS`, Instagram's reserved routes). Imported by client pages and also bundled into the browser extension (`extension/src/profile-path.ts`), so it must stay client-safe, free of server-only imports. Changes affect both the app and the extension: `NON_PROFILE_PATHS` also decides where the extension's button shows. Type-check both (`npx tsc --noEmit` and `npm run ext:typecheck`); the extension only picks up changes when it's rebuilt
  - `bio-parser.ts` — Claude (Sonnet) structured outputs (`output_config` JSON schema) for location extraction. Newer models reject forced `tool_choice`. With `ANTHROPIC_FEDERATION_RULE_ID` set it uses workload identity federation instead of `ANTHROPIC_API_KEY`: the SDK's `oidcFederationProvider` exchanges `getVercelOidcToken()` (`@vercel/oidc`: the request's `x-vercel-oidc-token` header on Vercel; locally a token minted with the Vercel CLI login for the linked project) for a short-lived token, which it caches and renews. The client is created on first use and passes `apiKey: null` and `authToken: null`, because those default to env vars that would win over `credentials`
  - `geocoding.ts` — Mapbox forward geocoding
  - `import-parser.ts` — Instagram data export JSON parser
  - `auth-options.ts` — NextAuth config (imported by route handler AND server helpers). Instagram OAuth only signs in already-linked accounts (no sign-up)
  - `auth.ts` — `requireSession()` (also rejects deleted/disabled users with a DB lookup, since JWTs live 30 days) and `requireAdmin()` (throws `ForbiddenError`)
  - `callback-url.ts` — `safeCallbackPath(callbackUrl, origin)`: where to go after signing in. Gives a same-origin relative path (query and hash kept), else `/map`: other origins (including `//x` and `/\x`), non-http(s) schemes and `/login` / `/register` (they'd loop) all fall back. `src/middleware.ts` sends signed-out users on `/artists`, `/map` and `/admin` to `/login?callbackUrl=<path + query>`, relative, and the login page passes it through `safeCallbackPath` for both credentials and Instagram sign-in, so a signed-out user lands back on the page they asked for (e.g. `/artists/add?handle=foo`). Known gap: a refused Instagram sign-in redirects to `/login?error=InviteRequired`, which drops `callbackUrl`. The login page runs it in the browser, so it must stay free of server-only imports
  - `admin.ts` — Admins are the emails in `ADMIN_EMAILS` (comma-separated env var), not a DB role
  - `access.ts` — Invite-only registration (`registerUser` consumes a single-use invite atomically), invite create/revoke, user disable
  - `bio-refresh.ts` — `REFRESH_CONFIRM_WINDOW_MS` and `isRecentlyFetched`. Imported by client pages too, so it must stay free of server-only imports
  - `usage.ts` — Daily budgets for metered external calls (`reserveUsage(kind, userId)` atomically increments global + per-user counters, throws `BudgetExceededError`)
  - `db.ts` — Prisma client singleton

- `src/app/api/` — Route handlers. All follow the same pattern:
  - Auth via `requireSession()` in try/catch → 401
  - `NextRequest`/`NextResponse` from `next/server`
  - Error shape: `{ error: string }` with appropriate HTTP status
  - Next.js 15 params: `params: Promise<{ id: string }>`
  - Exception: `GET /api/artists/[id]/avatar` returns image bytes, only to users tracking the artist or, for directory artists (`DIRECTORY_ARTIST_WHERE`), to any signed-in user (404 otherwise). An artist that turns out to be personal on a later fetch keeps its stored photo, but only the users tracking it can load it. It sends an ETag (304 on `If-None-Match`), `Cache-Control: private, max-age=31536000, immutable` when `?v=` is the current version and `private, max-age=60` otherwise. Never `public`: a shared cache would skip the auth check. It never downloads from Instagram

- `src/components/` — React components. `ui/` is shadcn-managed (do not hand-edit). Custom components sit alongside.
  - `bio-queue.tsx` — `BioQueueProvider` (in the `(app)` layout) drains pending bios by calling `POST /api/artists/fetch-next` in a loop, waiting the returned `nextDelayMs`; rate-limit pauses persist in localStorage. All queue state lives in the DB, so navigation never loses work

- `extension/` — Browser extension (Chrome MV3; also installs in Brave and Edge), built separately from the app. v0 shows a floating "Add @handle" button on Instagram profile pages; its link opens `<origin>/artists/add?handle=<handle>` in a new tab (no opener, no referrer), where the user confirms (see Add Flow). It only reads the handle from the URL: no Instagram API calls, no Instagram cookies, no scraping. It never adds anything itself. Its only access is one content script on `https://www.instagram.com/*` (no `permissions`, `host_permissions`, service worker or popup). Details in `extension/README.md`
  - `src/content.ts` — Polls `location.pathname` every 500 ms (plus `popstate`) to follow Instagram's SPA navigation, and shows or hides the button. `src/profile-path.ts` (`profileHandleFromPath`, pure) gets the handle with `instagram-handle.ts`
  - `src/button.ts` — The button, in a closed shadow root styled with a constructed stylesheet (`adoptedStyleSheets`, which Instagram's CSP doesn't block); no `innerHTML`. Bottom right, above Instagram's Messages pill. Minimizing shrinks it to a badge until the page reloads
  - `build.mjs` — esbuild bundles the scripts into `extension/dist/` (gitignored; the folder to load or zip) and sharp renders `icons/icon.svg` to 16/32/48/128 PNGs. `TRAVELINK_URL` sets the travel-ink origin at build time (scripts read it as `TRAVELINK_ORIGIN` from `src/config.ts`): default `http://localhost:3000`, a bare origin, https unless it's `localhost` or `127.0.0.1`
  - Own `tsconfig.json` (DOM + `chrome` types). The root `tsconfig.json` excludes `extension`, so Next's type check and build never see it; the root ESLint run covers it

### Import Flow
1. Get the following list (cookie scrape via `/api/import/scrape`, or data export via `/api/import/upload`) — returns accounts only, nothing is saved server-side. The import page keeps the list + selection as a per-user localStorage draft
2. The select step's "Hide personal" filter (on by default) hides untracked accounts that are private (scrape only; exports have `isPrivate: null`) or that `POST /api/import/account-types` reports as personal. It never calls Business Discovery — classifying whole lists would burn the shared rate limit and daily budgets. Accounts with a tattoo word in their handle or name (`TATTOO_WORDS`, client-side) are grouped first under "Likely tattoo artists"
3. `POST /api/artists/bulk` saves the selection as pending artists right away
4. The bio queue fetches bios in the background of any app page

Bios aren't re-fetched automatically. The artist page's "Refresh bio" calls `POST /api/artists/[id]/refresh`; a 409 `recently_refreshed` means the bio was checked within 72h, and the client confirms before retrying with `{ force: true }`. If Instagram is throttling (or a budget is used up) the artist stays pending (202 `queued`) for the bio queue. The artists list's "Refresh bios" calls `POST /api/artists/refresh-all` (`{ includeRecent?: boolean }`, returns `{ queuedIds }`) and then kicks the bio queue. Every successful fetch also stores the photo again, so refreshing is how a changed photo is picked up (bios from the last 72h only when the user ticks "Include … checked in the last 72 hours")

### Add Flow
The Add page's field takes a name, a handle or a profile link; a pasted link is replaced by its handle. As the user types, `GET /api/artists/directory?q=` (2–60 characters) suggests matches, grouped as "On your list" (opens the artist), "Added by other travel-ink users", "From Instagram" (only with a connected cookie, via `POST /api/instagram/search`), and a final "Not here? Add @handle". `useDebouncedSearch` (`src/hooks/`) debounces each source, cancels superseded requests and caches results per query. Enter without a highlighted suggestion adds the typed handle. Adding calls `POST /api/artists` (`addArtistByHandle`), which only looks the artist up when they're new, pending or failed, so adding a directory artist whose bio is already fetched makes no external calls

Opened with `?handle=` (how the browser extension links here), the page reads it once with `parseHandleInput` (a handle, `@handle` or a profile link) and removes it from the address bar, so a reload doesn't fill it in again. A valid handle fills in and focuses the field and shows the suggestions, searching only the travel-ink directory (a new tab has no Instagram cookie). An invalid value shows the usual validation message. Nothing is added until the user clicks a suggestion or presses Enter. Signed-out users sign in first and come back to the same URL (see `callback-url.ts`)

### Data Flow
Artists are **shared** across users. `UserArtist` is the join table — deleting an artist from a user's list only removes the link, not the artist record. Other users can find an artist in Add page search only while it's in the directory (public Business/Creator accounts, `DIRECTORY_ARTIST_WHERE`). Never reveal who added an artist or how many users track one: with a small invite-only user base, that could identify someone.

Business/creator profile photos are stored in `artist_avatars` (one row per artist, deleted with it) when a bio fetch succeeds, and change only with a later fetch. Personal and unavailable accounts never get one; they keep the Instagram link from import, which expires about 4.5 days later.

## Build and Test

```sh
npm run dev            # Start dev server (Turbopack)
npm run build          # Production build
npm run lint           # ESLint (covers extension/ too)
npx tsc --noEmit       # Type check (skips extension/)
npx prisma generate    # Regenerate Prisma client after schema changes
npx prisma migrate dev --name <name>  # Create + apply migration
npm run ext:build      # Build the browser extension into extension/dist/
npm run ext:watch      # Rebuild the extension's scripts on change
npm run ext:typecheck  # Type check the extension (extension/tsconfig.json)
```

Use Node 24 (`nvm use` reads `.nvmrc`) for both the app and the extension. sharp, which stores avatars and renders the extension's icons, needs Node 20.9 or later.

Extension builds link to `http://localhost:3000` by default. For a release build, set `TRAVELINK_URL` to travel-ink's https origin: `TRAVELINK_URL=https://<travel-ink domain> npm run ext:build`. To try a build, load `extension/dist/` unpacked (see `docs/development.md`).

## Conventions

### Auth Pattern
```typescript
// Every API route starts with this:
let session
try {
  session = await requireSession()
} catch {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
}
```
Admin routes use `requireAdmin()` the same way, returning 403 when the error is a `ForbiddenError` and 401 otherwise.

Import `requireSession` from `@/lib/auth`, never import `authOptions` from the route handler (circular dep risk) — use `@/lib/auth-options`.

Client components get the signed-in user's ID from `useCurrentUserId()` (`src/hooks/`), which also covers the dev auth bypass. Key per-user browser state by it.

### Prisma
- All models use `@@map("snake_case_table")` and `@map("snake_case_column")`
- String enums over Prisma enums (easier to extend without migrations)
- Always use the singleton from `@/lib/db`, never instantiate `PrismaClient` directly
- Never `include: { avatar: true }` or select `avatar.data` on artist queries: that loads the photo bytes. Use `ARTIST_DTO_INCLUDE` (only the avatar's `version`); only the avatar route reads `data`

### UI
- Dark theme with a purple accent. Use the `brand-*` color tokens (set in `src/app/globals.css`, currently Tailwind's purple) rather than raw palette classes, so the accent can be changed in one place
- Purple is darker than amber at the same step, so accent text and icons use `brand-400` (hover `brand-300`) to stay readable on cards. Filled accent buttons: `bg-brand-600 text-white hover:bg-brand-700`
- Brand: "TRAVEL-" in muted gray (hyphen included) + "INK" in `brand-400`. Source text is "travel-" + "ink", uppercased by CSS
- Write the name as "travel-ink" in copy, titles and docs, lowercase even at the start of a sentence. The hyphen keeps it from reading as "Trave-link". Slugs and keys (repo, package, database, URLs, storage keys) stay `travelink`
- shadcn/ui components in `src/components/ui/` — add via `npx shadcn@latest add <component>`, never create manually
- Card styling: `border-border/50 shadow-2xl shadow-black/25`
- Glassmorphic surfaces: `bg-background/80 backdrop-blur-xl backdrop-saturate-150`
- Primary badges: brand-tinted (`border-brand-500/30 bg-brand-500/10 text-brand-200`)
- Guest spots use the `guest-*` tokens (amber), e.g. badges `border-guest-500/20 bg-guest-500/10 text-guest-400`. The map layers in `artist-map.tsx` keep hex copies of both tokens
- Warnings use raw `amber-*`, not `guest-*`
- Icons from `lucide-react`

### Error Handling
- Service libs (`src/lib/`) throw errors — they don't catch and return. Custom error classes (e.g., `RateLimitError`, `ScraperAuthError`) for actionable errors.
- API routes catch at the boundary and return appropriate HTTP status codes.
- Client pages show inline error banners using `bg-destructive/10` with `AlertCircle` icon.

### Environment Variables
- `NEXT_PUBLIC_*` — Client-accessible (only Mapbox token)
- Everything else is server-only (Instagram tokens, Anthropic key or federation IDs, DB URL, NextAuth secret)
- See `.env.example` for the full list
- Exception: `TRAVELINK_URL` is for the extension build only. `extension/build.mjs` reads it from the shell, not `.env`, and bakes it into the (public) extension bundle

### Access and Cost Control
- Registration is invite-only (admin emails can register without one). New sign-up paths must go through `registerUser` in `@/lib/access`
- Call `reserveUsage(kind, userId)` before every metered external call (e.g. Business Discovery). Handle `BudgetExceededError` like a rate limit: pause, don't mark failed. Limits are in `DAILY_LIMITS`

### Git
- Never add `Co-authored-by` trailers (or any AI attribution) to commit messages, PR/MR titles, or PR/MR descriptions
- If you are working on a non-main branch, always commit and push unless told otherwise, and always open a PR
- Open PRs only as the repo owner (`george-j-thomas`), never from another GitHub account

## Things to Avoid

- Do not hand-edit files in `src/components/ui/` — they are managed by shadcn
- Do not import `authOptions` from `src/app/api/auth/[...nextauth]/route.ts` — use `@/lib/auth-options`
- Do not use Prisma enums — use string fields with conventions documented in comments
- Do not persist the Instagram session cookie anywhere — not the database, logs, localStorage or sessionStorage. `useInstagramCookie` (`src/hooks/`) holds it in tab memory for the signed-in travel-ink user only, and drops it on sign-out, session end, the sign-in pages, and tab reload/close. It's sent with each request that needs it, along with `ownerId` (the user it was connected under); routes call `assertCookieOwner` before using it and hold it only for that request
- Instagram cookie rejections return 403 with `code: "instagram_session"`, never 401 — clients treat 401 as a travel-ink logout
- Do not add in-memory background jobs — the app is deployed on Vercel (serverless); long work must be client-driven or step-based
- Do not wrap slow external API calls (Instagram, Claude, Mapbox) in Prisma transactions
- Do not make the browser extension call Instagram (APIs or scraping), read Instagram cookies or add artists by itself — it only reads the handle from the URL and opens the Add page, where the user confirms. Don't give it permissions a feature doesn't need (v0 needs none beyond its content script)
- Do not redirect after sign-in to a `callbackUrl` that hasn't been through `safeCallbackPath` — that's an open redirect
