# SiteLink - Gemini Instructions

## Task Tracking

This project uses **bd** (beads) for issue tracking. See `AGENTS.md` for full workflow.

```bash
bd ready              # Find available work
bd new "Task title"   # Create new issue
bd show <id>          # View issue details
bd update <id> --status in_progress  # Claim work
bd close <id>         # Complete work
bd sync               # Sync with git (before pushing)
```

**Important:** Always run `bd sync && git push` before ending a session.

---

## Project Overview

- **Product:** Construction plan viewer with automated callout detection
- **Stack:** Cloudflare Workers + Effect-TS + D1 + Expo (React Native)
- **Monorepo:** Yes (packages/)

See `CLAUDE.md` and `.claude/CLAUDE.md` for full project guidelines and architecture details.

## Key Directories

- `packages/backend/` - Cloudflare Worker API (Effect-TS)
- `packages/mobile/` - Expo React Native app
- `packages/callout-processor/` - CV/OCR marker detection
- `docs/` - Planning and design documents

## Development

- Use `bun` instead of `npm/node`
- Backend tests: `cd packages/backend && bun run vitest`
- Mobile: `cd packages/mobile && bun run start`
