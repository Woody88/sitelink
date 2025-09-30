
# Sitelink Project Guidelines

## Project Architecture

This is a **monorepo** using **composable module architecture** inspired by PaulJPhilp's Effect-TS patterns.

### Core Architectural Principles

1. **Composable Modules**: Each business domain is a self-contained module with clear dependencies
2. **Layer Composition**: Use Effect-TS layers for dependency injection and service composition
3. **Separation of Concerns**: Core infrastructure separate from business features
4. **Type Safety**: Full type safety across all layers and boundaries
5. **Hybrid Architecture**: Cloudflare Workers for API + Containers for processing

### Monorepo Structure

```
packages/
├── backend/                 # Cloudflare Worker (Effect-TS HTTP API)
│   └── src/
│       ├── core/           # Infrastructure services
│       ├── features/       # Business domain modules
│       └── api.ts          # Main API composition
│
├── processing/             # Containerized PDF processing service
├── mobile/                 # React Native app
└── web/                    # Web dashboard (future)
```

### Module Composition Rules

1. **Core Layer**: Infrastructure services (Database, Storage, Config)
2. **Feature Modules**: Business domains (Organizations, Projects, Plans, Files)
3. **App Layer**: Composes features with core using `Layer.provide()`
4. **No Cross-Dependencies**: Features only depend on core, never on each other

### Package-Specific Guidelines

Each package has its own `CLAUDE.md` with specific architectural rules:

- **`packages/backend/CLAUDE.md`**: Effect-TS patterns, folder structure, Cloudflare Workers setup
- **`packages/mobile/CLAUDE.md`**: React Native patterns, API integration
- **`packages/processing/CLAUDE.md`**: Container architecture, Sharp processing

---

## Development Standards

Default to using Bun instead of Node.js.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun test` instead of `jest` or `vitest` (except backend package - see `packages/backend/CLAUDE.md`)
- Use `bun build <file.html|file.ts|file.css>` instead of `webpack` or `esbuild`
- Use `bun install` instead of `npm install` or `yarn install` or `pnpm install`
- Use `bun run <script>` instead of `npm run <script>` or `yarn run <script>` or `pnpm run <script>`
- Bun automatically loads .env, so don't use dotenv.

## APIs

- `Bun.serve()` supports WebSockets, HTTPS, and routes. Don't use `express`.
- `bun:sqlite` for SQLite. Don't use `better-sqlite3`.
- `Bun.redis` for Redis. Don't use `ioredis`.
- `Bun.sql` for Postgres. Don't use `pg` or `postgres.js`.
- `WebSocket` is built-in. Don't use `ws`.
- Prefer `Bun.file` over `node:fs`'s readFile/writeFile
- Bun.$`ls` instead of execa.

## Testing

Use `bun test` to run tests.

```ts#index.test.ts
import { test, expect } from "bun:test";

test("hello world", () => {
  expect(1).toBe(1);
});
```

## Frontend

Use HTML imports with `Bun.serve()`. Don't use `vite`. HTML imports fully support React, CSS, Tailwind.

Server:

```ts#index.ts
import index from "./index.html"

Bun.serve({
  routes: {
    "/": index,
    "/api/users/:id": {
      GET: (req) => {
        return new Response(JSON.stringify({ id: req.params.id }));
      },
    },
  },
  // optional websocket support
  websocket: {
    open: (ws) => {
      ws.send("Hello, world!");
    },
    message: (ws, message) => {
      ws.send(message);
    },
    close: (ws) => {
      // handle close
    }
  },
  development: {
    hmr: true,
    console: true,
  }
})
```

HTML files can import .tsx, .jsx or .js files directly and Bun's bundler will transpile & bundle automatically. `<link>` tags can point to stylesheets and Bun's CSS bundler will bundle.

```html#index.html
<html>
  <body>
    <h1>Hello, world!</h1>
    <script type="module" src="./frontend.tsx"></script>
  </body>
</html>
```

With the following `frontend.tsx`:

```tsx#frontend.tsx
import React from "react";

// import .css files directly and it works
import './index.css';

import { createRoot } from "react-dom/client";

const root = createRoot(document.body);

export default function Frontend() {
  return <h1>Hello, world!</h1>;
}

root.render(<Frontend />);
```

Then, run index.ts

```sh
bun --hot ./index.ts
```

For more information, read the Bun API docs in `node_modules/bun-types/docs/**.md`.
