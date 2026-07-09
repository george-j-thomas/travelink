# Travelink

Track your favorite tattoo artists and their locations around the world.

## Setup

### Prerequisites

- Node.js 18+
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

Copy the example env file and fill in your API keys:

```sh
cp .env.example .env.local
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
