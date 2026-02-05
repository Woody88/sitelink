Use 'bd' for task tracking

## Product Documentation

**SiteLink PRDs and product specs are in `docs/sitelink/`**

Start with [docs/sitelink/README.md](./docs/sitelink/README.md) for the documentation index:
- `01-vision.md` - Market thesis, competitive positioning, value proposition
- `02-users.md` - User personas, workflows, jobs-to-be-done
- `03-product.md` - Feature specifications, screens, flows
- `04-architecture.md` - Technical architecture, processing pipeline, offline model
- `05-ai-features.md` - Plan Assistant, extraction pipeline, query system

For implementation tracking, see beads tickets referenced in the README.

## Required Documentation References

Agents MUST use these documentation sources when working with the following technologies:

- **LiveStore**: https://next.livestore.dev/#docs-for-llms (we use the preview/latest version - NOT the stable docs)
- **Expo**: https://docs.expo.dev/llms.txt

Fetch these docs before implementing LiveStore queries, mutations, or Expo-specific features.

## Skills

### expo-development
Modern Expo SDK patterns for React Native. Auto-triggers when working with:
- File operations with `expo-file-system` (use File class, not legacy functions)
- Video playback with `expo-video` (NOT deprecated expo-av)
- Audio playback/recording with `expo-audio` (NOT deprecated expo-av)
- Image/video picking with `expo-image-picker`
- Background tasks with `expo-background-task`
- Blob operations with `expo-blob`

**Enforces deprecation warnings for expo-av and legacy FileSystem APIs.**

See `.claude/skills/expo-development/` for patterns and examples.

### mobile-testing
Automated mobile UI testing with Maestro. Use when:
- Testing fixes end-to-end before claiming something is fixed
- Verifying user flows work correctly
- Creating new test flows for features

**Key capabilities**:
- Running existing flows from `apps/mobile/maestro/`
- Creating new flows using app-specific patterns (Expo Go, dev menu handling)
- Finding element selectors via screenshots and view hierarchy inspection
- Troubleshooting common Maestro issues with this codebase

See `.claude/skills/mobile-testing/` for flow templates, patterns, and troubleshooting.

## LiveStore Materializers - CRITICAL

**LiveStore materializers MUST be pure functions** - they must produce the same output for the same input every time.

### ❌ NEVER do this in materializers:

```typescript
// BAD - Uses Date.now() which returns different values each time
"v1.ProjectCreated": (event) =>
  tables.projects.insert({
    id: event.id,
    name: event.name,
    createdAt: Date.now(),  // ❌ Impure! Will cause MaterializerHashMismatchError
    updatedAt: Date.now(),  // ❌ Impure! Will cause MaterializerHashMismatchError
  })
```

### ✅ DO this instead:

```typescript
// GOOD - Include timestamps in the event schema
// In events.ts:
projectCreated: Events.synced({
  name: 'v1.ProjectCreated',
  schema: Schema.Struct({
    id: Schema.String,
    name: Schema.String,
    createdAt: Schema.Number,  // ✓ Timestamp in event
  }),
})

// In materializers.ts:
"v1.ProjectCreated": (event) =>
  tables.projects.insert({
    id: event.id,
    name: event.name,
    createdAt: event.createdAt,  // ✓ Pure! Uses event data
    updatedAt: event.createdAt,  // ✓ Pure! Uses event data
  })

// When committing events:
await store.commit(
  events.projectCreated({
    id: projectId,
    name: "My Project",
    createdAt: Date.now(),  // ✓ Generate timestamp when creating event
  })
)
```

**Why this matters**: LiveStore hashes materializer results to detect changes. Using `Date.now()` or other impure functions causes `MaterializerHashMismatchError` because the same event produces different database operations each time the materializer runs.

**Other forbidden impure operations in materializers**:

- `Math.random()`
- `crypto.randomUUID()` or `nanoid()`
- Reading from external state/globals
- API calls or I/O operations
- Anything that returns different values for the same input

## Code Style

- Comments only at the top of functions if complex logic requires explanation
- No inline comments unless absolutely necessary
- No excessive JSDoc or documentation comments in code
- Let the code be self-documenting through clear naming

## UUID Generation

**CRITICAL for Mobile/Expo**: MUST use `nanoid` from `@livestore/livestore` for generating unique IDs.

```typescript
import { nanoid } from "@livestore/livestore"

const id = nanoid() // Correct ✓
```

**DO NOT** use `crypto.randomUUID()` in mobile/Expo apps - it doesn't work in React Native/Expo environments.

```typescript
const id = crypto.randomUUID() // Wrong ✗ - breaks on Expo
```

## After Implementation

MUST run these commands after any code changes:

```sh
bun tsc
bun lint
```

Fix any type errors or lint issues before considering the task complete.

## Bun

Default to using Bun instead of Node.js.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun build <file.html|file.ts|file.css>` instead of `webpack` or `esbuild`
- Use `bun install` instead of `npm install` or `yarn install` or `pnpm install`
- Use `bun run <script>` instead of `npm run <script>` or `yarn run <script>` or `pnpm run <script>`
- Use `bunx <package> <command>` instead of `npx <package> <command>`
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
import { createRoot } from "react-dom/client";

// import .css files directly and it works
import './index.css';

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

For more information, read the Bun API docs in `node_modules/bun-types/docs/**.mdx`.

## Verification - CRITICAL

**NEVER claim something is fixed without verifying it end-to-end using Maestro.**

Before saying a fix is complete:
1. Reset the environment if needed (`bun wrangler:state:reset` for backend, `bash delete_db.sh` for emulator)
2. Start the app fresh (`bun dev:network` for backend, `bun run android` for mobile)
3. Use Maestro to test the actual user flow
4. Take screenshots to see what's actually happening
5. Only then confirm the fix works

**Commands for fresh testing:**
```bash
# Reset databases
bun wrangler:state:reset  # Backend database
bash delete_db.sh         # Emulator database

# Push test files to emulator
bash push_plan.sh         # Push sample-plan.pdf to emulator

# Start services
bun dev:network           # Backend server
bun run android           # Mobile app
```

## Domain Knowledge - Sitelink

### Sheet Naming Convention
Sheets are identified by their **sheet number** in format like "A1", "A3", "B2" - NOT by their database ID or generic names like "Sheet 2" or "Sheet n".

- ✅ Correct: "A1", "A3", "B2" (sheet number format)
- ❌ Wrong: "Sheet 2", "Sheet n", or UUID-like IDs

### Plan Markers
When viewing a plan (PDF), markers should load and display on the image. Always verify markers are visible after uploading or viewing a plan.

## PMTiles Tile Generation - CRITICAL

The tile generation pipeline has specific coordinate system requirements. Getting these wrong causes images to appear upside down, rotated, or cropped.

### Pipeline Overview
```
PDF → pyvips render → PNG → pyvips dzsave (layout='google') → MBTiles → pmtiles convert → PMTiles → OpenSeadragon
```

### Key Rules

#### 1. pyvips dzsave layout='google' creates z/y/x structure (NOT z/x/y!)
```python
# dzsave creates: tiles_dir/z/y/x.webp
# - Directory under z = Y coordinate
# - Filename = X coordinate

# ✅ CORRECT - Read Y from directory, X from filename:
for y_dir in os.listdir(z_path):
    y_google = int(y_dir)
    for x_file in os.listdir(y_path):
        x = int(x_file.replace('.webp', ''))

# ❌ WRONG - This swaps X and Y:
for x_dir in os.listdir(z_path):  # This is actually Y!
    for y_file in os.listdir(x_path):  # This is actually X!
```
Reference: https://github.com/libvips/libvips/issues/67

#### 2. MBTiles uses TMS coordinates (y=0 at BOTTOM)
```python
# Google/XYZ format: y=0 at TOP (what dzsave produces)
# TMS format: y=0 at BOTTOM (what MBTiles expects)

# ✅ CORRECT - Flip Y when storing to MBTiles:
def flip_y(zoom, y):
    return (2**zoom - 1) - y

y_tms = flip_y(z, y_google)
cursor.execute("INSERT INTO tiles ... VALUES (z, x, y_tms, data)")

# ❌ WRONG - Storing without flip:
cursor.execute("INSERT INTO tiles ... VALUES (z, x, y_google, data)")  # Wrong!
```

#### 3. OpenSeadragon tileSize must be 256 (hardcoded)
```typescript
// ❌ WRONG - tileType doesn't indicate tile size:
const tileSize = header.tileType === 1 ? 256 : 512;  // WebP is type 4, gives 512!

// ✅ CORRECT - Our tiles are always 256px from dzsave:
const tileSize = 256;
```

#### 4. OpenSeadragon dimensions should be tile-boundary aligned
```typescript
// ✅ CORRECT - Round up to tile boundaries:
const tilesX = Math.ceil(imageWidth / tileSize);
const tilesY = Math.ceil(imageHeight / tileSize);
const width = tilesX * tileSize;
const height = tilesY * tileSize;

// ❌ WRONG - Using raw dimensions may miss edge tiles:
const width = imageWidth;
const height = imageHeight;
```

### Debugging Tile Issues

If images appear wrong:
1. **Upside down** → Y-flip is missing or applied twice
2. **Rotated 90°** → X and Y coordinates are swapped
3. **Right/bottom cut off** → tileSize is wrong (probably 512 instead of 256)
4. **Too much whitespace** → Using 2^maxZoom instead of actual tile count
