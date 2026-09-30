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
   the **Admin** page (avatar menu → Admin) and sends it to you. Admins (`ADMIN_EMAILS`) don't need one
2. Go to **Import Artists** and either:
   - Paste your Instagram session cookie to load your following list
   - Or upload your Instagram data export (`following.json`)
3. Tick the artists and click **Add to my artists** — they're saved immediately. Your list and ticks are kept
   in this browser, so you can leave and come back, and add in several batches
4. Or use **Add Artist** to search Instagram as you type (needs the session cookie) and add one artist
5. Bios are fetched in the background while you have any Travelink page open, then placed on the **Map**

The session cookie is remembered in your browser only (never stored on the server) and is used only to
read your following list and to search. Bios come from the official Business Discovery API. If it's rate limited
the queue pauses and resumes by itself. Nothing is lost.

Only public **Business/Creator** accounts expose their bio through the API. Personal accounts show
"No public bio" — add their location by hand on the artist page.

To cap costs, bio lookups have daily limits (global and per user, reset at midnight UTC). When a limit is hit the
queue pauses until the reset. Admins can see today's usage, manage invites, and disable users on the **Admin** page.

## Fetching bios (Instagram Business Discovery)

Business Discovery is free. It allows roughly 200 calls per hour, and requires:

1. Switch your Instagram account to **Professional** (Creator or Business) and link it to a **Facebook Page**
   (Instagram → Settings → Account type and tools; the Page can be an empty one you create).
2. Create an app at [developers.facebook.com](https://developers.facebook.com/apps) (type **Business**) and add the
   **Instagram** product with *API setup with Facebook login*.
3. In the [Graph API Explorer](https://developers.facebook.com/tools/explorer), choose your app and generate a
   user token with `instagram_basic`, `pages_show_list`, `business_management`, `pages_read_engagement`.
4. Exchange it for a long-lived (60-day) token:
   `GET https://graph.facebook.com/v25.0/oauth/access_token?grant_type=fb_exchange_token&client_id=APP_ID&client_secret=APP_SECRET&fb_exchange_token=SHORT_TOKEN`
5. Find your Instagram professional account ID:
   `GET https://graph.facebook.com/v25.0/me/accounts?fields=instagram_business_account&access_token=LONG_TOKEN`
6. Set `INSTAGRAM_APP_ACCESS_TOKEN` (the long-lived token) and `INSTAGRAM_APP_USER_ID` (the
   `instagram_business_account.id`) in `.env` / Vercel, then redeploy. When the token expires, the Artists page
   says so. Generate a new one and update the variable.

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
