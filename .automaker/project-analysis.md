Based on my comprehensive analysis, here's a detailed summary of the SiteLink project:

---

# SiteLink Project Analysis

## 1. Project Structure and Architecture

### Overview

SiteLink is a **construction project management mobile application** built as a **monorepo** with a **local-first, offline-first architecture** powered by LiveStore (v0.4.0-dev.22).

### Repository Structure

```
sitelink/
├── apps/
│   ├── backend/              # Cloudflare Workers backend
│   ├── mobile/               # Expo/React Native mobile app
│   ├── pmtiles-spike/        # Map tiles exploration
│   └── mbutil_zyx/           # Utility tools
├── packages/
│   └── domain/               # Shared domain logic (events, tables, schema)
├── docs/                     # Comprehensive documentation
├── scripts/                  # Build and automation scripts
└── .beads/                   # Beads task management database
```

### Architecture Pattern

- **Client-side**: Expo mobile app with local SQLite database
- **Sync layer**: LiveStore with WebSocket-based bidirectional sync
- **Backend**: Cloudflare Workers with Durable Objects for sync coordination
- **Database**: D1 (SQLite) for backend, expo-sqlite for mobile
- **State management**: Event sourcing with materializers pattern

**Data Flow Example:**

```
User Action → Commit Event → Local Materializer → Update Local DB →
Reactive UI Update → Background Sync → Backend Broadcast →
All Clients Update
```

---

## 2. Main Technologies and Frameworks

### Core Stack

- **Runtime**: Bun (JavaScript runtime & package manager)
- **Language**: TypeScript 5.9.2 (strict mode)
- **Version Control**: Git (active branch: `dev-livestore`)

### Frontend (Mobile)

- **React Native** 0.81.5 with **React** 19.1.0
- **Expo** ~54.0.31 - Development framework
- **Expo Router** ~6.0.19 - File-based routing
- **TailwindCSS** 4.1.17 with **Uniwind** - Styling
- **@rn-primitives** - Component library
- **React Native Reanimated** - Animations

### Backend

- **Cloudflare Workers** - Serverless edge compute
- **Wrangler** 4.54.0 - CLI and deployment
- **Cloudflare D1** - SQLite database
- **Cloudflare Durable Objects** - Stateful coordination

### Data & State

- **LiveStore** 0.4.0-dev.22 - Event-sourced sync framework
- **Effect** 3.19.14 - Functional effects system
- **Drizzle ORM** 0.45.1 - Type-safe database queries
- **Better Auth** 1.4.10 - Authentication with Expo integration

### Document Processing

- **OpenSeadragon** 5.0.1 - Deep-zoom image viewer for construction plans
- **mupdf-js** 2.0.1 - PDF parsing and rendering

### Development Tools

- **Prettier** 3.7.4 - Code formatting
- **Biome** 2.2.4 - Fast linter/formatter
- **oxlint** 1.36.0 - Additional linting
- **Effect Language Service** - LSP integration

---

## 3. Key Components and Their Responsibilities

### Domain Package (`packages/domain/`)

**Shared business logic between mobile and backend**

- **`events.ts` (373 lines)**: Defines 40+ event types using versioned namespace (`v1.*`)
  - Examples: `UserCreated`, `ProjectCreated`, `PhotoCaptured`, `MarkerAdded`
  - All events use `Events.synced()` for automatic synchronization

- **`tables.ts` (199 lines)**: SQLite table schemas for 10 entities
  - Tables: users, organizations, projects, plans, sheets, markers, photos, voiceNotes
  - Includes indexes for query optimization

- **`materializers.ts` (307 lines)**: Maps events to database operations
  - Handles event processing (INSERT/UPDATE/DELETE)
  - Example: `PhotoCaptured` event → insert into photos table

- **`schema.ts`**: Unified schema combining events, tables, and materializers

### Backend App (`apps/backend/`)

**Cloudflare Workers serverless backend**

**Key Modules:**

1. **Authentication** (`src/auth/auth.ts` - 81 lines)
   - Better Auth configuration with D1 adapter
   - Email/password + OAuth support
   - Database hooks for emitting LiveStore events on user creation

2. **Sync Worker** (`src/sync/worker.ts` - 109 lines)
   - WebSocketServer Durable Object for sync coordination
   - JWT token validation via D1 queries
   - Handles onPush/onPull events

3. **LiveStore Client DO** (`src/sync/livestore-client.ts`)
   - Server-side LiveStore instance
   - Enables backend to programmatically emit events
   - HTTP RPC interface for event commits

4. **Main Entry** (`src/index.ts`)
   - Routes `/api/auth/*` to Better Auth
   - Routes sync requests to LiveStore worker
   - Integrates LiveStoreClientDO

**Configuration:**

- Durable Objects: `SYNC_BACKEND_DO`, `LIVESTORE_CLIENT_DO`
- D1 binding: `sitelink-db`
- SQL migrations for both DOs

### Mobile App (`apps/mobile/`)

**Expo/React Native mobile application**

**Structure:**

- File-based routing with Expo Router
- 44 UI components in `components/`
- 15 custom hooks in `hooks/`

**Key Screens:**

- Authentication: `app/(auth)/login.tsx`, `app/(auth)/signup.tsx`
- Projects: `app/projects.tsx`
- Project Details: `app/project/[id]/` (activity, members, camera, media, plans, settings)

**Critical Hooks:**

1. **`use-projects.ts` (72 lines)**: Fetches all projects with computed stats
2. **`use-plan-upload.ts`**: Handles PDF plan uploads
3. **`use-markers.ts`**: Manages construction plan markers
4. **`use-photos-timeline.ts`**: Fetches photos grouped by date

**Context Providers:**

- **`project-context.tsx` (30 lines)**: Manages active project ID

**Library Utilities:**

1. **`store-config.ts` (50 lines)**: Configures LiveStore StoreRegistry
   - Singleton pattern for registry management
   - Factory function for creating store options with session token

2. **`auth.ts`**: Better Auth client configuration
3. **`biometric.ts`**: Face ID / Fingerprint authentication

**Component Organization:**

```
components/
├── ui/           # 44 files - Reusable UI primitives
├── plans/        # Plan viewer (OpenSeadragon integration)
├── camera/       # Camera capture UI
├── project/      # Project-specific components
├── pdf/          # PDF rendering
├── activity/     # Activity feed
└── workspace/    # Workspace management
```

---

## 4. Build and Test Commands

### Root Level

```bash
bun run dev:all              # Start backend and mobile concurrently
bun run typecheck            # TypeScript type checking
bun run format               # Format with Prettier
bun run check-format         # Check formatting
bun run prepare              # Patch Effect language service
```

### Backend (`apps/backend/`)

```bash
# Development
bun run dev                  # Start Wrangler dev server (localhost)
bun run dev:network          # Start with network access (0.0.0.0)
bun run deploy               # Deploy to Cloudflare

# Database Operations
bun run db:create            # Create D1 database
bun run db:generate          # Generate Better Auth migrations
bun run db:migrate:local     # Apply migrations locally
bun run db:migrate:remote    # Apply migrations to production
bun run db:reset:local       # Delete local database
bun run db:query:local       # Execute SQL command locally
bun run db:query:remote      # Execute SQL command remotely
bun run db:tables:local      # List tables
bun run db:delete-test-user  # Delete test user

# Monitoring & Maintenance
bun run logs                 # Tail Cloudflare logs
bun run lint                 # Run oxlint
bun run cf-typegen           # Generate Cloudflare Worker types
```

### Mobile (`apps/mobile/`)

```bash
# Development
bun run dev                  # Start Expo dev server
bun run android              # Run on Android emulator
bun run ios                  # Run on iOS simulator
bun run web                  # Run in web browser

# Maintenance
bun run clean                # Remove .expo and node_modules
bun run lint                 # Run Expo ESLint
```

### Testing

**Note:** No test suite currently implemented. Testing done via:

- Manual testing through Expo and Wrangler dev servers
- TypeScript type checking (`bun tsc`)
- Linting (`bun lint`)

---

## 5. Existing Conventions and Patterns

### Code Style

**Prettier Configuration:**

- Print width: 100 characters
- Tab width: 2 spaces
- No semicolons
- Double quotes
- Trailing commas: all
- Arrow parens: always

**EditorConfig:**

- 2-space indentation
- LF line endings
- UTF-8 charset
- Trim trailing whitespace
- Insert final newline

**Linting:**

- oxlint with 110 rules (warnings only)
- Strict TypeScript mode enabled

### Naming Conventions

**Files:**

- Components: `kebab-case.tsx` (e.g., `plan-viewer.tsx`)
- Hooks: `use-*.ts` (e.g., `use-projects.ts`)
- Context: `*-context.tsx` (e.g., `project-context.tsx`)

**Code:**

- React components: `PascalCase`
- Functions/variables: `camelCase`
- Constants: `UPPER_SNAKE_CASE`
- Event names: `v1.PascalCase` (e.g., `v1.UserCreated`)
- Table names: `snake_case` (e.g., `organization_members`)

### Architectural Patterns

#### 1. Event Sourcing

All state changes are represented as immutable events:

```typescript
// Commit event
store.commit(
  events.photoCaptured({
    id: nanoid(), // MUST use nanoid() on mobile
    projectId: "...",
    localPath: "...",
    capturedAt: new Date(),
    capturedBy: userId,
  }),
)

// Materializer processes → INSERT into photos table
// LiveStore syncs to backend → Broadcasts to all clients
```

#### 2. Local-First Data Access

- All reads from local SQLite (instant)
- Writes commit locally first (optimistic UI)
- Background sync handles propagation
- Works fully offline

#### 3. StoreRegistry Pattern (LiveStore 0.4.0)

```typescript
// Create singleton registry
const registry = new StoreRegistry({
  defaultOptions: {
    batchUpdates: unstable_batchedUpdates,
    unusedCacheTime: 60_000,
  },
})

// Components request stores
const { store } = useStore(storeOptions({ storeId, adapter, schema }))
```

#### 4. ID Generation

- **Mobile/Expo**: `nanoid()` from `@livestore/livestore` (REQUIRED)
- **Backend**: Can use `crypto.randomUUID()`
- **Critical**: Never use `crypto.randomUUID()` in React Native (doesn't work)

### Code Style Guidelines

**Comments:**

- Only at top of functions if complex logic requires explanation
- No inline comments unless absolutely necessary
- No excessive JSDoc
- Let code be self-documenting

**Required Documentation:**

- LiveStore docs: https://next.livestore.dev/#docs-for-llms
- Expo docs: https://docs.expo.dev/llms.txt

**Post-Implementation Checks:**

```bash
bun tsc    # Must pass
bun lint   # Must pass
```

### LiveStore-Specific Patterns

**Event Definition:**

```typescript
export const events = {
  projectCreated: Events.synced({
    name: "v1.ProjectCreated",
    schema: Schema.Struct({
      id: Schema.String,
      name: Schema.String,
    }),
  }),
}
```

**Materializer:**

```typescript
'v1.ProjectCreated': (event) =>
  tables.projects.insert({
    id: event.id,
    name: event.name,
    createdAt: Date.now(),
  }),
```

**Query Pattern:**

```typescript
const projects = store.useQuery(
  queryDb(tables.projects.where({ organizationId }).orderBy("createdAt", "desc")),
)
```

---

## Additional Insights

### Key Documentation Files

1. **`docs/sitelink/concrete-flows.md` (595 lines)**: Detailed UI/UX flows
2. **`docs/LIVESTORE_0.4_MIGRATION.md` (767 lines)**: Migration guide
3. **`CLAUDE.md` (153 lines)**: Developer guidelines for AI agents
4. **`docs/STORE_ARCHITECTURE.md`**: Event sourcing architecture
5. **`docs/sitelink/prd.md`**: Product requirements

### Recent Development Activity

- **Active Branch**: `dev-livestore`
- **Recent Work**: LiveStore 0.4.0 migration completed
- **Recent Commits**:
  - Fix store options in hooks
  - Add nanoid requirement documentation
  - Auto-create organization for first project
  - Implement LiveStore queries and mutations

### Technology Decisions Explained

- **Bun**: Faster development, built-in TypeScript support
- **LiveStore**: Built for local-first, event sourcing out of the box
- **Cloudflare**: Global edge deployment, generous free tier
- **Expo**: Modern React Native development experience
- **Better Auth**: TypeScript-first, works with D1/SQLite

---

## Summary

SiteLink is a **construction project management mobile application** with a sophisticated **event-sourced, local-first architecture**. The project is in **active development** with a well-structured monorepo, comprehensive documentation, and modern tech stack. Key strengths include offline-first reliability, real-time collaboration, and strong separation of concerns. The codebase follows best practices with strict TypeScript, comprehensive linting, and clear architectural patterns documented for both human developers and AI agents.
