# Travelink

Track your favorite tattoo artists and their locations around the world.

## Setup

### Prerequisites

- Node.js 20+ (24 recommended to match Vercel; run `nvm use` to pick up `.nvmrc`)
- Docker (for PostgreSQL)

### 1. Install dependencies

```sh
npm install
```

### 2. Start the database

```sh
docker compose up -d
```

### 3. Set up environment variables

Copy the example env file and fill in your API keys (use `.env`, not `.env.local` — the Prisma CLI only reads `.env`):

```sh
cp .env.example .env
```

Required keys:
- `ANTHROPIC_API_KEY` — from [console.anthropic.com](https://console.anthropic.com)
- `NEXT_PUBLIC_MAPBOX_TOKEN` — from [account.mapbox.com](https://account.mapbox.com)
- `NEXTAUTH_SECRET` — generate with `openssl rand -base64 32`
- `ADMIN_EMAILS` — your email (comma-separate several). Admins can register without an invite and see the
  **Admin** page

Optional (needed to fetch bios): `INSTAGRAM_APP_ACCESS_TOKEN`, `INSTAGRAM_APP_USER_ID` — see
[Fetching bios](#fetching-bios-instagram-business-discovery).

Optional: `HIKERAPI_ACCESS_KEY` — see [Search and personal accounts](#search-and-personal-accounts-hikerapi).

### 4. Run database migrations

```sh
npx prisma migrate dev
```

### 5. Start the dev server

```sh
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Usage

1. Create an account with email/password. Travelink is invite-only: an admin creates a single-use invite link on
   the **Admin** page (avatar menu → Admin) and sends it to you. The link opens a short intro page; **Get started**
   takes you to sign-up with the invite filled in. Admins (`ADMIN_EMAILS`) don't need one
2. Go to **Import Artists** and either:
   - Paste your Instagram session cookie to load your following list
   - Or upload your Instagram data export (`following.json`)
3. Tick the artists and click **Add to my artists** — they're saved immediately. Your list and ticks are kept
   in this browser, so you can leave and come back, and add in several batches
4. Or use **Add Artist** to search Instagram as you type and add one artist (search uses HikerAPI if it's set up,
   otherwise your session cookie)
5. Bios are fetched in the background while you have any Travelink page open, then placed on the **Map**

The session cookie is remembered in your browser only (never stored on the server) and is used only to
read your following list, and to search when HikerAPI isn't set up. Bios come from the official Business Discovery
API, with HikerAPI as a fallback. If a source is rate limited
the queue pauses and resumes by itself. Nothing is lost.

Only public **Business/Creator** accounts expose their bio through Business Discovery. Without HikerAPI, personal accounts show
"No public bio" — add their location by hand on the artist page.

To cap costs, bio lookups have daily limits (global and per user, reset at midnight UTC). When a limit is hit the
queue pauses until the reset. Admins can see today's usage, manage invites, and disable users on the **Admin** page.

## Search and personal accounts (HikerAPI)

[HikerAPI](https://hikerapi.com) is a paid, prepaid-balance Instagram data API. When `HIKERAPI_ACCESS_KEY` is set:

- **Add Artist** search works for everyone without an Instagram cookie, with profile pictures
- Artists that Business Discovery can't see (personal accounts) get their bio from HikerAPI instead of
  "No public bio". If Business Discovery isn't set up, HikerAPI is used for every bio

Each search or profile lookup costs about $0.001 and counts against the daily limits. Top up a small balance and
leave auto top-up off, so the balance is the hard cap. If the key is wrong or the balance runs out, search falls
back to the cookie and personal accounts show "No public bio" again.

## Fetching bios (Instagram Business Discovery)

Business Discovery is free. It allows roughly 200 calls per hour, and requires:

1. Switch your Instagram account to **Professional** (Creator or Business) and link it to a **Facebook Page**
   (Instagram → Settings → Account type and tools; the Page can be an empty one you create).
2. Create an app at [developers.facebook.com](https://developers.facebook.com/apps) (use case **Other**, type
   **Business**). Development mode is fine, because only you log in to it.
3. In the [Graph API Explorer](https://developers.facebook.com/tools/explorer), choose your app. Under
   **Permissions**, add `instagram_basic`, `instagram_manage_insights`, `pages_show_list`, `pages_read_engagement`,
   `business_management` and `ads_read`, then click **Generate Access Token** and keep your Page selected.
   Business Discovery fails with "(#10) Application does not have permission" if `instagram_manage_insights`
   (or `ads_read`, for Pages owned by a business portfolio) is missing.
4. In the Explorer, run `me/accounts?fields=name,instagram_business_account{id,username}` (no leading space).
   Note the Page `id` and `instagram_business_account.id`.
5. Swap the short-lived token for a Page token that never expires. First exchange it for a long-lived user token
   with the app secret (App settings → Basic):
   `GET https://graph.facebook.com/v25.0/oauth/access_token?grant_type=fb_exchange_token&client_id=APP_ID&client_secret=APP_SECRET&fb_exchange_token=SHORT_TOKEN`
   Then query `PAGE_ID?fields=access_token` with that long-lived token. The returned Page token shows
   "Expires: Never" in the [Access Token Debugger](https://developers.facebook.com/tools/debug/accesstoken/).
6. Check it with `IG_USER_ID?fields=business_discovery.username(bluebottle){username,biography}`.
7. Set `INSTAGRAM_APP_ACCESS_TOKEN` (the Page token) and `INSTAGRAM_APP_USER_ID` (the
   `instagram_business_account.id`) in `.env.local` / Vercel, then redeploy. If the token ever stops working
   (password change, app removed, permissions revoked), the Artists page says so. Repeat steps 3 and 5.

## Deploying to Vercel

1. **Import the repo** at [vercel.com/new](https://vercel.com/new) (framework: Next.js — `vercel.json` sets the build command).
2. **Add a database**: in the project, go to **Storage → Create → Neon (Postgres)** and connect it to all environments.
   This sets `DATABASE_URL` (pooled) and `DATABASE_URL_UNPOOLED` (used for migrations) automatically.
3. **Set environment variables** (Settings → Environment Variables):
   - `NEXTAUTH_SECRET` — `openssl rand -base64 32`
   - `NEXTAUTH_URL` — your production URL, e.g. `https://travelink.vercel.app`
   - `ANTHROPIC_API_KEY`
   - `NEXT_PUBLIC_MAPBOX_TOKEN` — don't add URL restrictions; server-side geocoding uses it too
   - `INSTAGRAM_APP_ACCESS_TOKEN` / `INSTAGRAM_APP_USER_ID` — to fetch bios (see above)
   - Optional: `INSTAGRAM_CLIENT_ID` / `INSTAGRAM_CLIENT_SECRET` (Instagram login)
   - Do **not** set `DEV_AUTH_BYPASS` (it is ignored in production builds anyway)
4. **Deploy.** Each build runs `prisma migrate deploy` before `next build`.

Note: cookie requests (following list, search) on Vercel come from data-center IPs, which Instagram treats more
suspiciously than a home connection. They are kept to a minimum: one paginated list read per import.
