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
  - `artist-pipeline.ts` — Orchestrator: Instagram fetch → Claude bio parse → Mapbox geocode → DB write
  - `instagram.ts` — Business Discovery API client (server-side app token)
  - `instagram-scraper.ts` — Cookie-based internal web API client (following list + profiles); sends the user's own browser User-Agent
  - `bio-parser.ts` — Claude tool_use for structured location extraction
  - `geocoding.ts` — Mapbox forward geocoding
  - `import-runner.ts` — Step-based bulk import: the browser calls `POST /api/import/[id]/next` in a loop, waiting the returned `nextDelayMs`. No background work (serverless-safe); scrape pacing lives here
  - `import-parser.ts` — Instagram data export JSON parser
  - `auth-options.ts` — NextAuth config (imported by route handler AND server helpers)
  - `db.ts` — Prisma client singleton

- `src/app/api/` — Route handlers. All follow the same pattern:
  - Auth via `requireSession()` in try/catch → 401
  - `NextRequest`/`NextResponse` from `next/server`
  - Error shape: `{ error: string }` with appropriate HTTP status
  - Next.js 15 params: `params: Promise<{ id: string }>`

- `src/components/` — React components. `ui/` is shadcn-managed (do not hand-edit). Custom components sit alongside.

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
Import `requireSession` from `@/lib/auth`, never import `authOptions` from the route handler (circular dep risk) — use `@/lib/auth-options`.

### Prisma
- All models use `@@map("snake_case_table")` and `@map("snake_case_column")`
- String enums over Prisma enums (easier to extend without migrations)
- Always use the singleton from `@/lib/db`, never instantiate `PrismaClient` directly

### UI
- Dark theme with amber (`amber-500`) accent color
- Brand: "TRAVEL" in muted gray + "INK" in amber-500
- shadcn/ui components in `src/components/ui/` — add via `npx shadcn@latest add <component>`, never create manually
- Card styling: `border-border/50 shadow-2xl shadow-black/25`
- Glassmorphic surfaces: `bg-background/80 backdrop-blur-xl backdrop-saturate-150`
- Primary badges: amber-tinted (`border-amber-500/30 bg-amber-500/10 text-amber-200`)
- Guest spot badges: purple-tinted
- Icons from `lucide-react`

### Error Handling
- Service libs (`src/lib/`) throw errors — they don't catch and return. Custom error classes (e.g., `RateLimitError`, `ScraperAuthError`) for actionable errors.
- API routes catch at the boundary and return appropriate HTTP status codes.
- Client pages show inline error banners using `bg-destructive/10` with `AlertCircle` icon.

### Environment Variables
- `NEXT_PUBLIC_*` — Client-accessible (only Mapbox token)
- Everything else is server-only (Instagram tokens, Anthropic key, DB URL, NextAuth secret)
- See `.env.example` for the full list

## Things to Avoid

- Do not hand-edit files in `src/components/ui/` — they are managed by shadcn
- Do not import `authOptions` from `src/app/api/auth/[...nextauth]/route.ts` — use `@/lib/auth-options`
- Do not use Prisma enums — use string fields with conventions documented in comments
- Do not store Instagram session cookies in the database — the browser sends the cookie with each request; the server holds it only for that request
- Do not add in-memory background jobs — the app is deployed on Vercel (serverless); long work must be client-driven or step-based
- Do not wrap slow external API calls (Instagram, Claude, Mapbox) in Prisma transactions
