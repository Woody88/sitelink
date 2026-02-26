# Sitelink Backend

Cloudflare Worker with LiveStore sync and Better Auth.

## Setup

```bash
bun install
bun run cf-typegen
bun run db:migrate:local
bun run dev
```

## Scripts

| Command                 | Description                     |
| ----------------------- | ------------------------------- |
| `dev`                   | Start local dev server          |
| `deploy`                | Deploy to Cloudflare            |
| `cf-typegen`            | Generate TypeScript types       |
| `db:generate`           | Generate Better Auth migrations |
| `db:migrate:local`      | Apply migrations locally        |
| `db:migrate:remote`     | Apply migrations to production  |
| `db:query:local "SQL"`  | Query local D1                  |
| `db:query:remote "SQL"` | Query remote D1                 |
| `db:tables:local`       | List local tables               |
| `db:tables:remote`      | List remote tables              |

## Architecture

- **Better Auth** - Authentication (`/api/auth/*`)
- **LiveStore Sync** - Real-time sync via WebSocket (`/websocket`)
- **Cloudflare D1** - SQLite database
- **Durable Objects** - WebSocket connection management

## Key Files

- `src/index.ts` - Main worker entry
- `src/auth/auth.ts` - Better Auth runtime config
- `auth.config.ts` - Better Auth CLI config (for migrations)
- `src/sync/` - LiveStore sync handlers
- `migrations/` - D1 database migrations
