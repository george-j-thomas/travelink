# Travelink

Track your favorite tattoo artists and their locations around the world.

## Setup

### Prerequisites

- Node.js 20+
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

1. Create an account with email/password
2. Go to **Import Artists** and either:
   - Upload your Instagram data export (`following.json`)
   - Paste your Instagram session cookie for instant import
3. Select which accounts to import
4. View your artists on the **Map**

Imports run from your browser tab — keep it open until the import finishes. Cookie imports are paced at
~20–30s per artist to protect your Instagram account.

## Deploying to Vercel

1. **Import the repo** at [vercel.com/new](https://vercel.com/new) (framework: Next.js — `vercel.json` sets the build command).
2. **Add a database**: in the project, go to **Storage → Create → Neon (Postgres)** and connect it to all environments.
   This sets `DATABASE_URL` (pooled) and `DATABASE_URL_UNPOOLED` (used for migrations) automatically.
3. **Set environment variables** (Settings → Environment Variables):
   - `NEXTAUTH_SECRET` — `openssl rand -base64 32`
   - `NEXTAUTH_URL` — your production URL, e.g. `https://travelink.vercel.app`
   - `ANTHROPIC_API_KEY`
   - `NEXT_PUBLIC_MAPBOX_TOKEN` — don't add URL restrictions; server-side geocoding uses it too
   - Optional: `INSTAGRAM_CLIENT_ID` / `INSTAGRAM_CLIENT_SECRET` (Instagram login), `INSTAGRAM_APP_ACCESS_TOKEN` / `INSTAGRAM_APP_USER_ID` (Business Discovery fallback)
   - Do **not** set `DEV_AUTH_BYPASS` (it is ignored in production builds anyway)
4. **Deploy.** Each build runs `prisma migrate deploy` before `next build`.

Note: cookie imports on Vercel send Instagram requests from Vercel's data-center IPs, which Instagram treats more
suspiciously than a home connection. For large imports, you can run the app locally against the production database
so requests come from your own IP — `DATABASE_URL=<neon url> DEV_AUTH_BYPASS= npm run dev`, then log in with your
real account (the bypass would otherwise import into a "Dev User" account in production).
