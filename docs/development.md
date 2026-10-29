# Development

How to run travel-ink locally, connect the services it uses, deploy it, and build the browser extension. For what the
app does, see the [README](../README.md).

## Running locally

### Prerequisites

- Node.js 20.9+ (sharp needs it; 24 recommended to match Vercel; run `nvm use` to pick up `.nvmrc`)
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
- `ANTHROPIC_API_KEY` — from [console.anthropic.com](https://console.anthropic.com), or no key at all with
  [workload identity federation](#claude-without-an-api-key-workload-identity-federation)
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

## Claude without an API key (workload identity federation)

API keys expire and have to be replaced by hand. With workload identity federation, travel-ink proves who it is
with the OIDC token Vercel gives each function, and the Anthropic SDK trades it for a short-lived access token,
renewing it as needed. There's no key to store or rotate. Federation is used when `ANTHROPIC_FEDERATION_RULE_ID`
is set; otherwise `ANTHROPIC_API_KEY` is.

1. In Vercel, set the project's Settings → Security → **Secure backend access with OIDC federation** to Team. Below,
   `<team>` is the team slug (as in `vercel.com/<team>`) and `<project>` the project name.
2. In the Claude Console, open [Workload identity](https://platform.claude.com/settings/workload-identity-federation)
   and select **Connect workload** → **Custom OIDC** (needs the admin or owner role). Fill in:
   - **Issuer URL:** `https://oidc.vercel.com/<team>`, with discovery for the keys
   - **Maximum token lifetime:** `12` hours. Vercel's tokens last 2 hours in functions and 12 locally, and the
     1-hour default rejects them
   - **Subject:** `owner:<team>:project:<project>:environment:*` (any environment; end it with `production`
     instead of `*` for production only)
   - **Audience:** `https://vercel.com/<team>`. It's the `aud` value Vercel writes into its tokens, not a URL that
     gets called
   - **Scope:** `workspace:developer`, the default (the access a workspace API key has)
   - **Service account:** create one, with any name (e.g. `travelink-parser`)
3. The wizard ends with a curl example. Copy its four IDs into Vercel (Production) and `.env`:
   `federation_rule_id` → `ANTHROPIC_FEDERATION_RULE_ID`, `organization_id` → `ANTHROPIC_ORGANIZATION_ID`,
   `service_account_id` → `ANTHROPIC_SERVICE_ACCOUNT_ID` and `workspace_id` → `ANTHROPIC_WORKSPACE_ID`. They're
   IDs, not secrets.
4. Deploy and refresh an artist's bio to check it works. Then remove `ANTHROPIC_API_KEY` from Vercel and `.env`
   and delete the key in the Console.

Locally, `npm run dev` gets its token with your Vercel CLI login, so run `vercel login` and `vercel link` once. The
token is cached for 12 hours and renewed when it expires. A failed exchange only says "Authentication failed"; the
reason is in the Console's Workload identity page, under authentication history. "Failed to reach token endpoint"
means the request never got there: some networks block `api.anthropic.com`, and Claude can't be reached from them
with or without a key.

## Deploying to Vercel

1. **Import the repo** at [vercel.com/new](https://vercel.com/new) (framework: Next.js — `vercel.json` sets the build command).
2. **Add a database**: in the project, go to **Storage → Create → Neon (Postgres)** and connect it to all environments.
   This sets `DATABASE_URL` (pooled) and `DATABASE_URL_UNPOOLED` (used for migrations) automatically.
3. **Set environment variables** (Settings → Environment Variables):
   - `NEXTAUTH_SECRET` — `openssl rand -base64 32`
   - `NEXTAUTH_URL` — your production URL, e.g. `https://travelink.vercel.app`
   - `ANTHROPIC_API_KEY`, or the federation IDs (see
     [Claude without an API key](#claude-without-an-api-key-workload-identity-federation))
   - `NEXT_PUBLIC_MAPBOX_TOKEN` — don't add URL restrictions; server-side geocoding uses it too
   - `INSTAGRAM_APP_ACCESS_TOKEN` / `INSTAGRAM_APP_USER_ID` — to fetch bios (see above)
   - Optional: `INSTAGRAM_CLIENT_ID` / `INSTAGRAM_CLIENT_SECRET` (Instagram login)
   - Do **not** set `DEV_AUTH_BYPASS` (it is ignored in production builds anyway)
4. **Deploy.** Each build runs `prisma migrate deploy` before `next build`.

Note: cookie requests (following list, search) on Vercel come from data-center IPs, which Instagram treats more
suspiciously than a home connection. They are kept to a minimum: one paginated list read per import.

## Browser extension

`extension/` is a browser extension for Chrome, Brave and Edge. On an Instagram profile it shows an **Add @handle**
button that opens travel-ink's Add page with the handle filled in. [extension/README.md](../extension/README.md)
explains how it works and how to zip it for the Chrome Web Store.

### Building and loading it

Use Node 24, like the app (`nvm use`). The build renders the icons with sharp, which needs Node 20.9 or later. The
root `npm install` installs everything it uses; the extension has no `package.json` of its own. Run these from the
repo root:

```sh
npm run ext:build       # build into extension/dist/
npm run ext:watch       # rebuild the scripts on change
npm run ext:typecheck   # type check (the root tsconfig.json excludes extension/)
```

To load it:

1. Run `npm run ext:build`.
2. Open `chrome://extensions` (Brave: `brave://extensions`, Edge: `edge://extensions`) and turn on **Developer mode**.
3. Click **Load unpacked** and pick `extension/dist/`, not `extension/`.
4. Start the dev server (`npm run dev`), open an Instagram profile and click the button. It opens
   `http://localhost:3000/artists/add?handle=<handle>` in a new tab. If you're signed out, you sign in first and come
   back to it.

After a rebuild, click the extension's reload button on the extensions page, then reload the Instagram tab.
`ext:watch` only rebuilds the scripts, so restart it after editing `manifest.json` or `icons/icon.svg`.

### `TRAVELINK_URL`

The button links to the travel-ink origin in `TRAVELINK_URL`, which is fixed at build time. It defaults to
`http://localhost:3000`, so a default build only works with the local dev server. If that runs on another port, set
it, e.g. `TRAVELINK_URL=http://localhost:3001 npm run ext:build`.

For a release build, set it to your production URL, the same origin as `NEXTAUTH_URL`:

```sh
TRAVELINK_URL=https://<travel-ink domain> npm run ext:build
```

It must be a bare origin (no path) and use https, unless the host is `localhost` or `127.0.0.1`. Otherwise the build
fails. It's read from the shell, not from `.env`.
