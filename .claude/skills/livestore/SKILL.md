---
name: livestore
description: LiveStore 0.4.0 event-sourced state management for the SiteLink project. Use this skill whenever working with LiveStore schema (events, tables, materializers), store setup, reactive queries, sync configuration, or server-side event commits. Also use when adding new domain entities, modifying the data model, debugging MaterializerHashMismatchError, or writing code that reads/writes to the LiveStore-backed SQLite database. Trigger on any mention of events.ts, tables.ts, materializers.ts, schema.ts, queryDb, useStore, useQuery, store.commit, StoreRegistry, makeWsSync, or makePersistedAdapter.
---

# LiveStore Skill — SiteLink Project

LiveStore is an event-sourced state management framework. Events are the source of truth; tables are derived projections rebuilt by replaying events through materializers. This gives you offline-first sync, conflict resolution, and a full audit trail for free.

**Version**: 0.4.0-dev.22 (the "next" release)
**Official docs**: https://next.livestore.dev (most pages are 404 — this skill is the authoritative reference)
**Context7 library**: `livestore` — use `resolve-library-id` then `query-docs` for any API you're unsure about

## Architecture Overview

```
Events (immutable facts)
  → Materializers (pure functions: event → SQL mutations)
    → SQLite Tables (derived state, queryable)
```

Three layers, four files:

| File               | Purpose                                     | Location               |
| ------------------ | ------------------------------------------- | ---------------------- |
| `events.ts`        | Event definitions (what happened)           | `packages/domain/src/` |
| `tables.ts`        | Table schemas (current state shape)         | `packages/domain/src/` |
| `materializers.ts` | Event→SQL mapping (how events become state) | `packages/domain/src/` |
| `schema.ts`        | Wires events + state together               | `packages/domain/src/` |

## Adding a New Domain Entity

This is the most common task. Follow this exact sequence — skipping a step causes runtime errors.

### Step 1: Define the event(s) in `events.ts`

```typescript
import { Events, Schema } from "@livestore/livestore"

// Event naming: camelCase key, "v1.PascalCase" name
widgetCreated: Events.synced({
  name: "v1.WidgetCreated",
  schema: Schema.Struct({
    id: Schema.String,
    projectId: Schema.String,
    name: Schema.String,
    description: Schema.optional(Schema.String),  // optional fields
    createdAt: Schema.Number,                       // timestamps are NUMBERS (epoch ms)
  }),
}),
```

**Rules:**

- `Events.synced()` for data that syncs across clients. `Events.local()` for UI-only state.
- Event name format: `"v1.PascalCaseName"` — the `v1.` prefix is for schema versioning
- Key name format: `camelCase` matching the event name without version prefix
- Timestamps: always `Schema.Number` (epoch milliseconds). Date objects don't survive JSON serialization.
- Optional fields: use `Schema.optional(Schema.Type)` in events, NOT `Schema.nullable()`
- Arrays: `Schema.Array(Schema.Struct({ ... }))` for embedded collections
- Records/Maps: `Schema.Record({ key: Schema.String, value: Schema.String })`

### Step 2: Define the table in `tables.ts`

```typescript
import { State } from "@livestore/livestore"

widgets: State.SQLite.table({
  name: "widgets",              // SQL table name: snake_case
  columns: {
    id: State.SQLite.text({ primaryKey: true }),
    projectId: State.SQLite.text(),
    name: State.SQLite.text(),
    description: State.SQLite.text({ nullable: true }),  // nullable columns
    status: State.SQLite.text({ default: "active" }),     // defaults
    count: State.SQLite.integer(),
    ratio: State.SQLite.real(),                           // for floating point
    isActive: State.SQLite.boolean({ default: false }),
    createdAt: State.SQLite.integer(),
  },
  indexes: [
    { name: "widgets_projectId", columns: ["projectId"] },
    { name: "widgets_status", columns: ["status"] },
  ],
}),
```

**Column types:**

- `text()` → SQLite TEXT (strings, IDs, JSON strings)
- `integer()` → SQLite INTEGER (numbers, timestamps, counts)
- `real()` → SQLite REAL (floating point — coordinates, confidence scores)
- `boolean()` → SQLite INTEGER 0/1

**Index naming**: `tableName_columnName` for single column, `tableName_col1_col2` for compound.

### Step 3: Write the materializer in `materializers.ts`

```typescript
import { State } from "@livestore/livestore"
import { events } from "./events"
import { tables } from "./tables"

export const materializers = State.SQLite.materializers(events, {
  // Key is the event NAME string, not the key
  "v1.WidgetCreated": (event) =>
    tables.widgets.insert({
      id: event.id,
      projectId: event.projectId,
      name: event.name,
      description: event.description ?? null,  // optional → null for nullable columns
      status: "active",                         // derived/default values
      count: 0,
      ratio: 0.0,
      isActive: false,
      createdAt: event.createdAt,
    }),
```

**Critical rules for materializers:**

1. **Every nullable column must get an explicit value** — if the event doesn't provide it, set `null`. Missing columns cause SQLite errors.

2. **Optional event fields**: use `event.field ?? null` to coerce undefined to null.

3. **Return types**: A materializer can return:
   - A single operation: `tables.x.insert({...})`
   - An array of operations: `[tables.x.insert({...}), tables.y.update({...})]`
   - A mapped array: `event.items.map(item => tables.x.insert({...}))`

4. **Spreading arrays** into a multi-operation return:

   ```typescript
   "v1.BatchEvent": (event) => [
     tables.parent.update({...}).where({...}),
     ...event.children.map(child => tables.child.insert({...})),
   ],
   ```

5. **Update with conditional fields** (for partial updates):

   ```typescript
   "v1.WidgetUpdated": (event) =>
     tables.widgets.update({
       ...(event.name && { name: event.name }),
       ...(event.description !== undefined && { description: event.description }),
     }).where({ id: event.widgetId }),
   ```

6. **Delete with WHERE**:

   ```typescript
   tables.widgets.delete().where({ id: event.widgetId })
   ```

7. **Delete with NOT IN** (for cleanup):

   ```typescript
   tables.sheets.delete().where({
     planId: event.planId,
     id: { op: "NOT IN", value: event.validSheetIds },
   })
   ```

8. **Upsert with onConflict**:

   ```typescript
   tables.sheets.insert({...}).onConflict("id", "replace")
   ```

9. **Compound WHERE**:
   ```typescript
   tables.members.delete().where({
     organizationId: event.organizationId,
     userId: event.userId,
   })
   ```

### Step 4: Schema wiring (usually no changes needed)

`schema.ts` auto-discovers from the events and state objects:

```typescript
import { makeSchema, State } from "@livestore/livestore"
import { events } from "./events"
import { materializers } from "./materializers"
import { tables } from "./tables"

const state = State.SQLite.makeState({ tables, materializers })
export const schema = makeSchema({ events, state })
```

Only touch this file if you're adding a completely new state type (unlikely).

## Querying Data (React/Mobile)

### Store setup

Read `references/store-setup.md` for the full StoreRegistry and adapter patterns.

Quick reference:

```typescript
// In a hook or component
import { queryDb } from "@livestore/livestore"
import { tables } from "@sitelink/domain"

// Reactive query (re-renders on data change)
const projects = store.useQuery(queryDb(tables.projects.orderBy("updatedAt", "desc")))

// Filtered query
const sheets = store.useQuery(
  queryDb(tables.sheets.where({ projectId }).orderBy("sortOrder", "asc")),
)

// One-shot query (no subscription)
const existing = store.query(queryDb(tables.organizations.where({ id: orgId })))
```

**Key patterns:**

- `store.useQuery(queryDb(...))` — reactive, re-renders when data changes
- `store.query(queryDb(...))` — one-shot, returns current value
- `queryDb()` wraps all table queries — always required
- `.where({ col: value })` — equality filter
- `.orderBy("column", "asc" | "desc")` — sorting
- Chain: `tables.x.where({...}).orderBy("col", "desc")`

### Committing events

```typescript
import { events } from "@sitelink/domain"

// Function-call syntax (0.4.0 style)
store.commit(
  events.projectCreated({
    id: crypto.randomUUID(),
    organizationId: orgId,
    name: "My Project",
    createdBy: userId,
    createdAt: Date.now(),
  })
)

// Async commit (in services)
await store.commit(events.planUploaded({...}))
```

**Commit syntax is `events.eventName({...})`** — call the event as a function. NOT `events.eventName, {...}` (that was 0.3.1 style).

## Backend / Server-Side

Read `references/backend-patterns.md` for Durable Object sync and server-side client patterns.

Quick reference:

```typescript
// Sync worker (Cloudflare Worker entry point)
import { makeDurableObject, makeWorker } from "@livestore/sync-cf/cf-worker"

export class SyncBackendDO extends makeDurableObject({
  onPush: async (message, context) => {
    /* handle incoming events */
  },
  onPull: async (message, context) => {
    /* handle pull requests */
  },
}) {}

// Worker factory
export function createSyncWorker(env) {
  return makeWorker({
    syncBackendBinding: "SYNC_BACKEND_DO",
    validatePayload: (payload, context) => validateAuth(payload, context, env),
    enableCORS: true,
  })
}
```

## Common Gotchas

### MaterializerHashMismatchError

**Cause**: Schema changed but the local SQLite database still has events materialized with the old schema hash.
**Fix**: Clear the database. On mobile: Settings → Developer Tools → Clear Database & Restart. Or call `clearLiveStoreDatabase()`.
**Prevention**: Always clear DB after changing events, tables, or materializers during development.

### MaterializeError

**Cause**: Event data doesn't match what the materializer expects — missing fields, wrong types, nullable violations.
**Fix**: Check that every nullable column gets an explicit `null` in the materializer insert.

### Timestamps are Numbers, not Dates

Events sent via HTTP/JSON must use `Date.now()` (number), not `new Date()` (object). Date objects don't survive JSON serialization and arrive as strings, causing type mismatches.

### Event name vs event key

- Event **key** (in the events object): `projectCreated` (camelCase)
- Event **name** (in materializer keys): `"v1.ProjectCreated"` (version prefix + PascalCase)
- These must correspond but are NOT the same string.

### Import paths

- Domain types: `import { events, tables, schema } from "@sitelink/domain"`
- LiveStore core: `import { queryDb, Events, Schema, State, makeSchema } from "@livestore/livestore"`
- React hooks: `import { storeOptions, useStore, StoreRegistryProvider } from "@livestore/react"`
- Expo adapter: `import { makePersistedAdapter } from "@livestore/adapter-expo"`
- Sync client: `import { makeWsSync } from "@livestore/sync-cf/client"`
- Sync server: `import { makeDurableObject, makeWorker } from "@livestore/sync-cf/cf-worker"`
- CF adapter: `import { createStoreDoPromise } from "@livestore/adapter-cloudflare"`

## Reference Files

- `references/store-setup.md` — Full StoreRegistry, adapter, and provider setup patterns
- `references/backend-patterns.md` — Durable Object sync, server-side clients, auth validation
