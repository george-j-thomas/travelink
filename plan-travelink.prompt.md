# Plan: Travelink — Tattoo Artist Location Tracker

Build a Next.js web app where users add tattoo artists by Instagram handle, the app reads their bios via Instagram's Business Discovery API, extracts locations using Claude, and displays artists on a Mapbox map. V1 is manual entry + bio parsing + map view.

## Key Technical Constraints

- **No Following List API**: Instagram provides NO scope to access a user's following list. Manual entry for V1; Instagram data export import (a JSON file users can download from settings) is a V2 feature.
- **Bio Access**: Business Discovery API reads `biography` for Business/Creator accounts only. Most tattoo artists use these. Personal accounts get a manual location entry fallback.
- **Instagram OAuth** works for user identity but grants zero access to following lists.

## Architecture

Next.js (App Router, TS) · PostgreSQL + Prisma · NextAuth.js (Instagram OAuth + email/password) · Claude API for bio parsing · Mapbox GL for maps + geocoding · Tailwind + shadcn/ui

## Data Model

- **User** — id, email, password_hash?, instagram_id?, name
- **Artist** — id, instagram_handle (unique), display_name, bio, profile_pic_url, account_type, bio_last_fetched_at
- **UserArtist** (join table) — user_id, artist_id, notes
- **ArtistLocation** — artist_id, location_name, city, country, lat, lng, is_primary, is_guest_spot, start_date?, end_date?, source (bio|manual)

Artists are **shared** across users — if two users follow the same handle, bio/location data is fetched once.

## Steps

### Phase 1: Scaffolding
1. Init Next.js + Tailwind + TypeScript, set up Prisma schema with the data model above
2. Install deps: `next-auth`, `@anthropic-ai/sdk`, `react-map-gl`, `mapbox-gl`, shadcn/ui
3. Configure env vars (Meta App creds, Anthropic key, Mapbox token, DB URL, NextAuth secret)

### Phase 2: Authentication
4. NextAuth with Instagram OAuth provider (`instagram_business_basic` scope) + credentials provider (email/password, bcrypt)
5. Auth pages: `/login`, `/register` with both Instagram button + email/password form
6. Middleware protecting app routes

### Phase 3: Artist Management (Core)
7. **Add Artist** (`/artists/add`): Handle input → validate → check DB → call Business Discovery API (`GET /{user-id}?fields=business_discovery.fields(biography,username,name,profile_picture_url)&business_discovery=@{handle}`) → store artist + raw bio. If personal account/404 → create with `account_type: unknown`, prompt manual location
8. **Bio parsing service** (`src/lib/bio-parser.ts`): Send bio to Claude with structured prompt → extract JSON array of `{location_name, city, country, is_guest_spot, start_date, end_date}`. Handles emoji flags (🇯🇵→Japan), abbreviations (NYC), multiple locations, shop handle mentions. Returns `null` on uncertainty rather than guessing
9. **Geocoding** (`src/lib/geocoding.ts`): Parsed location names → Mapbox Geocoding API → lat/lng → store in `ArtistLocation`
10. **Artist list** (`/artists`): Cards showing profile pic, handle, location(s), last updated. Search/filter by location

### Phase 4: Map View
11. Full-screen Mapbox map (`/map`) with clustered pins, popups (artist name, handle, location, guest spot dates), sidebar listing artists in viewport
12. Filters: all / current city / guest spots only / by country
13. Optional "artists near me" geolocation button

### Phase 5: Manual Location & Editing
14. Manual location form with Mapbox geocoding autocomplete for artists whose bios couldn't be parsed
15. Edit/override parsed locations (marked `source: manual` to avoid overwrite on refresh)

### Phase 6: Refresh (Stretch)
16. Per-artist "refresh bio" button: re-fetch → re-parse → show diff before applying
17. Background cron job for periodic bio refresh (cache 24h+, respect rate limits)

## Key Files

- `prisma/schema.prisma` — Data model
- `src/lib/instagram.ts` — Business Discovery API client
- `src/lib/bio-parser.ts` — Claude-based bio parsing
- `src/lib/geocoding.ts` — Mapbox geocoding
- `src/app/api/artists/route.ts` — Artist CRUD
- `src/app/(app)/map/page.tsx` — Map view
- `src/app/(app)/artists/page.tsx` — Artist list
- `src/app/api/auth/[...nextauth]/route.ts` — Auth config

## Verification

1. Register + login via email and Instagram OAuth
2. Add a known tattoo artist handle; verify bio fetched from API
3. Test bio parsing with varied inputs: single city, emoji flags, multiple cities, guest spots with dates, shop handle mentions
4. Verify geocoded pins render correctly on map with clustering and popups
5. Test manual location entry for personal/ambiguous accounts
6. Test refresh flow detects bio/location changes

## Decisions

- Artists are shared; bio data cached per-artist, not per-user
- Instagram Login = identity only, not data access
- LLM bio parsing is cost-effective (~50 tokens per bio)
- V1 **excludes**: following list import, notifications, mobile, social features, artist discovery

## Further Considerations

1. **Meta App Review**: Business Discovery API requires Advanced Access + app review for production use. Start the review process early (needs privacy policy, business verification). Dev mode works with test accounts immediately.
2. **Rate limits**: 200 × user_count requests/hour. Fine at small scale; implement caching (24h min) and queuing for growth.
3. **V2: Data Export Import**: Instagram's downloadable data export includes `following.json` with all followed handles. This enables the original "import following list → filter to artists" workflow without any API access.
