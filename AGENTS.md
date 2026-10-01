# Travelink — Project Guidelines

## Overview

Tattoo artist location tracker. Users import their Instagram following list, the app fetches artist bios via Instagram's Business Discovery API, extracts locations using Claude, and displays artists on a Mapbox map.

**Stack**: Next.js 15 (App Router, TypeScript) · Prisma 5 + PostgreSQL · NextAuth v4 · Claude API · Mapbox GL · Tailwind CSS v4 + shadcn/ui

## Architecture

### Route Groups
- `(auth)` — Login, register. Centered layout, no navbar.
- `(app)` — All authenticated routes. Navbar + content layout.

### Key Layers
- `src/lib/` — Service modules. Each is self-contained with its own types, error classes, and a single public API:
  - `artist-pipeline.ts` — Orchestrator. `trackArtists` saves selected handles immediately as `fetchStatus: "pending"` stubs (no external calls); `fetchArtistBio` claims one artist (DB claim with TTL), then Business Discovery → paid provider if BD has no profile → Claude bio parse → Mapbox geocode → DB write (records `fetchSource`)
  - `instagram.ts` — Official Business Discovery client (`graph.facebook.com`, server-side token). Maps Graph errors to `RateLimitError` / `BusinessDiscoveryConfigError`; personal accounts come back as `profile: null`
  - `instagram-provider.ts` — Paid provider (HikerAPI, `HIKERAPI_ACCESS_KEY`, prepaid balance): account search for the Add page typeahead, and profiles of accounts Business Discovery can't see (personal accounts). Optional: without the key, search falls back to the user's cookie. Maps errors to `ProviderConfigError` (bad key / empty balance) / `RateLimitError`
  - `instagram-scraper.ts` — Cookie-based internal web API client, used **only** for the user's following list, and for account search when the paid provider isn't configured or fails (profile fetches from Vercel IPs get rate-limited instantly). `InstagramSession` keeps a per-request cookie jar and follows redirects manually (Instagram sets cookies via self-redirects); sends the user's own browser User-Agent
  - `bio-parser.ts` — Claude (Sonnet) structured outputs (`output_config` JSON schema) for location extraction. Newer models reject forced `tool_choice`
  - `geocoding.ts` — Mapbox forward geocoding
  - `import-parser.ts` — Instagram data export JSON parser
  - `auth-options.ts` — NextAuth config (imported by route handler AND server helpers). Instagram OAuth only signs in already-linked accounts (no sign-up)
  - `auth.ts` — `requireSession()` (also rejects deleted/disabled users with a DB lookup, since JWTs live 30 days) and `requireAdmin()` (throws `ForbiddenError`)
  - `admin.ts` — Admins are the emails in `ADMIN_EMAILS` (comma-separated env var), not a DB role
  - `access.ts` — Invite-only registration (`registerUser` consumes a single-use invite atomically), invite create/revoke, user disable
  - `usage.ts` — Daily budgets for metered external calls (`reserveUsage(kind, userId)` atomically increments global + per-user counters, throws `BudgetExceededError`)
  - `db.ts` — Prisma client singleton

- `src/app/api/` — Route handlers. All follow the same pattern:
  - Auth via `requireSession()` in try/catch → 401
  - `NextRequest`/`NextResponse` from `next/server`
  - Error shape: `{ error: string }` with appropriate HTTP status
  - Next.js 15 params: `params: Promise<{ id: string }>`

- `src/components/` — React components. `ui/` is shadcn-managed (do not hand-edit). Custom components sit alongside.
  - `bio-queue.tsx` — `BioQueueProvider` (in the `(app)` layout) drains pending bios by calling `POST /api/artists/fetch-next` in a loop, waiting the returned `nextDelayMs`; rate-limit pauses persist in localStorage. All queue state lives in the DB, so navigation never loses work

### Import Flow
1. Get the following list (cookie scrape via `/api/import/scrape`, or data export via `/api/import/upload`) — returns accounts only, nothing is saved server-side. The import page keeps the list + selection as a per-user localStorage draft
2. `POST /api/artists/bulk` saves the selection as pending artists right away
3. The bio queue fetches bios in the background of any app page

### Data Flow
Artists are **shared** across users. `UserArtist` is the join table — deleting an artist from a user's list only removes the link, not the artist record.

## Build and Test

```sh
npm run dev          # Start dev server (Turbopack)
npm run build        # Production build
npm run lint         # ESLint
npx tsc --noEmit     # Type check
npx prisma generate  # Regenerate Prisma client after schema changes
npx prisma migrate dev --name <name>  # Create + apply migration
```

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

### Prisma
- All models use `@@map("snake_case_table")` and `@map("snake_case_column")`
- String enums over Prisma enums (easier to extend without migrations)
- Always use the singleton from `@/lib/db`, never instantiate `PrismaClient` directly

### UI
- Style: **Wipeout / Designers Republic techno** — loud, sharp, square corners (`--radius: 0`), extended uppercase type, HUD microcopy, chevrons, hazard stripes, grids. No literal racing/car imagery
- Palette: **red, black and grey only — no yellow, no cyan**. Tokens in `globals.css`: `brand-200…900` (signal red, primary accent), `guest-300…600` (silver, guest spots), neutral black/grey surfaces. Use these, not raw Tailwind hues. Mapbox layers can't read CSS vars; `artist-map.tsx` mirrors them as hex
- Fonts: `font-display` = Saira stretched to 125% width (custom utility; headings, brand, buttons; uppercase, `font-black`), `font-heading` = Saira normal width (shadcn titles), `font-sans` = Chakra Petch, `font-mono` = Geist Mono (HUD readouts)
- Marks in `src/components/brand/marks.tsx`: `BrandMark` ("TRAVEL" grey + "INK" black on a sheared red block), `Chevrons`, `Crosshair`, `Barcode`, `CornerTicks`, `Readout` (mono microcopy). Decorative only
- Utilities: `wx-cut` (two corners cut, size via `--cut`), `wx-slant` (parallelogram, `--slant`), `wx-outline` (hollow type, `--stroke-c`), `wx-grid` (`--grid`), `wx-hazard` (`--stripe`), `wx-hairlines`, `wx-scanlines`, `animate-wx-{wipe,rise,marquee,marquee-reverse,blink,sweep}` (all disabled under reduced motion). `clip-path` hides box-shadow and focus outlines, so pair clipped shapes with an offset sibling layer and put focus rings on an unclipped parent
- shadcn/ui components in `src/components/ui/` — add via `npx shadcn@latest add <component>`, never create manually
- Card styling: `border-border/50 shadow-2xl shadow-black/25` (auth cards: `border border-border` on a red offset slab)
- Glassmorphic surfaces: `bg-background/80 backdrop-blur-xl backdrop-saturate-150`
- Primary badges: red-tinted (`border-brand-500/30 bg-brand-500/10 text-brand-200`)
- Guest spot badges: silver-tinted (`guest-*`); success states also use silver, not green
- Icons from `lucide-react`

### Error Handling
- Service libs (`src/lib/`) throw errors — they don't catch and return. Custom error classes (e.g., `RateLimitError`, `ScraperAuthError`) for actionable errors.
- API routes catch at the boundary and return appropriate HTTP status codes.
- Client pages show inline error banners using `bg-destructive/10` with `AlertCircle` icon.

### Environment Variables
- `NEXT_PUBLIC_*` — Client-accessible (only Mapbox token)
- Everything else is server-only (Instagram tokens, Anthropic key, DB URL, NextAuth secret)
- See `.env.example` for the full list

### Access and Cost Control
- Registration is invite-only (admin emails can register without one). New sign-up paths must go through `registerUser` in `@/lib/access`
- Call `reserveUsage(kind, userId)` before every metered external call (Business Discovery, paid scraping providers). Handle `BudgetExceededError` like a rate limit: pause, don't mark failed. Limits are in `DAILY_LIMITS`

### Git
- Never add `Co-authored-by` trailers (or any AI attribution) to commit messages, PR/MR titles, or PR/MR descriptions

## Things to Avoid

- Do not hand-edit files in `src/components/ui/` — they are managed by shadcn
- Do not import `authOptions` from `src/app/api/auth/[...nextauth]/route.ts` — use `@/lib/auth-options`
- Do not use Prisma enums — use string fields with conventions documented in comments
- Do not store Instagram session cookies in the database — the browser keeps it (localStorage, via `useInstagramCookie` in `src/hooks/`) and sends it with each request; the server holds it only for that request
- Instagram cookie rejections return 403 with `code: "instagram_session"`, never 401 — clients treat 401 as a Travelink logout
- Do not add in-memory background jobs — the app is deployed on Vercel (serverless); long work must be client-driven or step-based
- Do not wrap slow external API calls (Instagram, Claude, Mapbox) in Prisma transactions
