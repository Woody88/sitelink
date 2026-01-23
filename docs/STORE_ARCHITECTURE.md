# Sitelink Store Architecture

## Multi-Tenancy Model

Sitelink uses a **per-organization store** model for data isolation and access control.

### Key Principles

1. **One Store Per Organization**: Each organization has its own isolated event log and state
2. **Multi-Organization Ownership**: Users can own/belong to multiple organizations (RBAC handles permissions)
3. **Automatic Sync**: LiveStore automatically syncs from seqNum 0 when first connecting to a new organization
4. **Client-Side Materialization**: All state queries happen locally; backend only stores events

## Store ID Structure

Each organization has its own LiveStore instance:

```
storeId: `org-${organizationId}`

Examples:
- org-redheadsteel-abc123
- org-acmecorp-def456
```

## Automatic Sync from seqNum 0

### How LiveStore Automatic Sync Works

When a user first opens a store for an organization they've just joined, **LiveStore automatically syncs all historical events from the beginning (seqNum 0)**. No manual triggering is required.

#### The Automatic Sync Process

```typescript
// 1. User creates/opens store for the first time
const store = useStore(
  storeOptions({
    storeId: "org-redheadsteel-abc123", // ← New organization for this user
    schema,
    adapter: makePersistedAdapter({
      sync: { backend: makeWsSync({ url: SYNC_URL }) },
    }),
    syncPayload: { authToken: sessionToken },
  }),
)

// 2. LiveStore automatically:
//    - Opens local SQLite databases (eventlog + state)
//    - Checks latest local event: none found (first time)
//    - Sets cursor = undefined
//    - Sends Pull request to backend with cursor: undefined

// 3. Backend receives Pull request:
const statement =
  cursor === undefined
    ? `SELECT * FROM eventlog_3_org_redheadsteel_abc123 ORDER BY seqNum ASC`
    : `SELECT * FROM eventlog_3_org_redheadsteel_abc123 WHERE seqNum > ? ORDER BY seqNum ASC`

// 4. Backend streams ALL events starting from seqNum 0

// 5. Client materializers automatically process each event:
//    - projectCreated → inserts into projects table
//    - photoCaptured → inserts into photos table
//    - markerCreated → inserts into markers table
//    ... thousands of events processed automatically

// 6. User sees fully materialized state
```

### Initial Sync Options

LiveStore provides two modes for handling initial sync:

#### Option 1: Skip (Default - Background Sync)

```typescript
const store = useStore(
  storeOptions({
    storeId: `org-${organizationId}`,
    schema,
    adapter: makePersistedAdapter({
      sync: {
        backend,
        // Default: { _tag: 'Skip' }
        // Sync happens in background
      },
    }),
  }),
)
```

**Behavior:**

- ✅ App starts immediately, no waiting
- ✅ Sync runs automatically in background
- ✅ UI updates reactively as events arrive
- ✅ Good for quick app startup
- ❌ User sees empty/loading state initially
- ❌ Data appears progressively

**Best for:**

- Subsequent logins (data already mostly synced)
- Organizations with few events
- Apps where progressive loading is acceptable

#### Option 2: Blocking (Wait for Initial Sync)

```typescript
import { Duration } from "effect"

const store = useStore(
  storeOptions({
    storeId: `org-${organizationId}`,
    schema,
    adapter: makePersistedAdapter({
      sync: {
        backend,
        initialSyncOptions: {
          _tag: "Blocking",
          timeout: Duration.seconds(60), // Wait up to 60s
        },
      },
    }),
  }),
)
```

**Behavior:**

- ✅ Waits for initial sync to complete
- ✅ User sees fully synced data immediately
- ✅ No empty states or progressive loading
- ✅ Better UX for first-time organization access
- ❌ App shows loading screen during sync
- ❌ Can timeout on slow connections
- ⚠️ Suspends React component until sync completes

**Best for:**

- First-time organization access
- Critical data that must be complete
- Organizations with moderate event counts
- Onboarding flows

### Recommended Pattern: Smart Initial Sync

Detect whether this is the user's first time accessing an organization and choose the appropriate sync mode:

```typescript
// apps/mobile/hooks/use-organization-store.ts
export function useOrganizationStore(organizationId: string) {
  const { data: session } = authClient.useSession()
  const [isFirstSync, setIsFirstSync] = useState<boolean | null>(null)

  // Check if we have local data for this organization
  useEffect(() => {
    async function checkLocalData() {
      try {
        const storeId = `org-${organizationId}`
        // Check if local databases exist and have data
        const dbPath = `SQLite/${storeId}/livestore-eventlog@3.db`
        const exists = await FileSystem.getInfoAsync(dbPath)
        setIsFirstSync(!exists.exists)
      } catch {
        setIsFirstSync(true) // Assume first sync on error
      }
    }
    checkLocalData()
  }, [organizationId])

  // Wait until we know if this is first sync
  if (isFirstSync === null) {
    return null // Still checking
  }

  // Create store with appropriate sync mode
  return useStore(
    storeOptions({
      storeId: `org-${organizationId}`,
      schema,
      adapter: makePersistedAdapter({
        sync: {
          backend: makeWsSync({ url: SYNC_URL }),
          // First time: block and show "Setting up..." screen
          // Subsequent: skip and sync in background
          initialSyncOptions: isFirstSync
            ? { _tag: "Blocking", timeout: Duration.seconds(45) }
            : { _tag: "Skip" },
        },
      }),
      syncPayload: { authToken: session.token },
    }),
  )
}
```

### Sync Progress Indication

For background syncs, show progress to the user:

```typescript
// Monitor sync status
const syncStatus = store.useQuery(
  queryDb(tables.__livestore_sync_status)
)

// Show progress UI
{syncStatus.syncing && (
  <View>
    <Text>Syncing {organizationName}...</Text>
    <ProgressBar
      progress={syncStatus.eventsProcessed / syncStatus.totalEvents}
    />
    <Text>{syncStatus.eventsProcessed} / {syncStatus.totalEvents} events</Text>
  </View>
)}
```

### Multi-Organization Sync Behavior

When a user belongs to multiple organizations:

```typescript
const organizations = [
  { id: "redheadsteel-abc", name: "RedHeadSteel" },
  { id: "acmecorp-def", name: "AcmeCorp" },
  { id: "smithinc-ghi", name: "Smith Inc" },
]

// Each store syncs independently and automatically
organizations.forEach((org) => {
  const store = useStore(
    storeOptions({
      storeId: `org-${org.id}`,
      schema,
      adapter: makePersistedAdapter({ sync: { backend } }),
    }),
  )
  // Automatic sync starts for each organization
  // Each pulls from seqNum 0 on first connection
  // Subsequent connections only pull new events
})
```

**Key Points:**

- ✅ Stores sync **independently** - no blocking between orgs
- ✅ Can work in one org while another syncs in background
- ✅ Each org's cursor tracked separately
- ✅ User can own unlimited organizations (RBAC concern only)

## New Member Onboarding Flow

When a new member joins "RedHeadSteel":

### 1. Backend: Member Added

```typescript
// Organization owner invites member
POST /api/organizations/{orgId}/members
{
  "email": "newmember@example.com",
  "role": "member"
}

// Backend commits event to RedHeadSteel's store
await liveStoreClient.commit(
  events.memberAdded({
    organizationId: 'redheadsteel-abc123',
    userId: 'newuser-xyz',
    email: 'newmember@example.com',
    role: 'member',
    invitedBy: currentUser.id
  })
)

// Also adds to D1 for authorization
INSERT INTO organization_members (organization_id, user_id, role)
VALUES ('redheadsteel-abc123', 'newuser-xyz', 'member')
```

### 2. Mobile: Fetch User's Organizations

On app launch, fetch user's organizations:

```typescript
GET /api/user/organizations
Authorization: Bearer {sessionToken}

Response:
[
  {
    "id": "redheadsteel-abc123",
    "name": "RedHeadSteel",
    "role": "member",
    "joinedAt": "2026-01-08T10:30:00Z"
  }
]
```

### 3. Mobile: Create Stores for Each Organization

```typescript
// apps/mobile/context/organization-stores-context.tsx
export function OrganizationStoresProvider({ children }) {
  const { data: session } = authClient.useSession()
  const [organizations, setOrganizations] = useState([])
  const storeRegistry = getStoreRegistry()

  useEffect(() => {
    if (!session?.token) return

    // Fetch user's organizations
    fetch(`${API_URL}/api/user/organizations`, {
      headers: { Authorization: `Bearer ${session.token}` }
    })
      .then(r => r.json())
      .then(orgs => {
        setOrganizations(orgs)

        // Create/load stores for each organization
        orgs.forEach(org => {
          const storeId = `org-${org.id}`
          storeRegistry.get(storeOptions({
            storeId,
            schema,
            adapter: makePersistedAdapter({
              sync: { backend: makeWsSync({ url: SYNC_URL }) }
            }),
            syncPayload: { authToken: session.token }
          }))
        })
      })
  }, [session])

  return (
    <OrganizationsContext.Provider value={organizations}>
      {children}
    </OrganizationsContext.Provider>
  )
}
```

### 4. Mobile: Automatic Initial Sync

**⚠️ CRITICAL: Sync happens automatically - no manual triggering needed!**

When the store is created with `useStore()`, LiveStore automatically:

1. ✅ Opens local SQLite databases (eventlog + state)
2. ✅ Detects this is the first time (no local data)
3. ✅ Sets cursor = undefined
4. ✅ Connects to WebSocket: `wss://sync.sitelink.app?storeId=org-redheadsteel-abc123`
5. ✅ Sends Pull request with cursor: undefined
6. ✅ Backend validates user is a member (via validatePayload)
7. ✅ Backend streams ALL events from seqNum 0
8. ✅ Client materializers automatically process all events
9. ✅ Local state tables are built up incrementally
10. ✅ User sees complete organization data

**What gets synced automatically:**

- All historical projects since organization creation
- All photos ever captured
- All markers ever created
- All plans ever uploaded
- All voice notes recorded
- Potentially thousands or millions of events

**Sync Mode Choice:**

```typescript
// Option A: Background sync (default)
// - App starts immediately
// - Shows loading states while syncing
// - Data appears progressively
const store = useStore(
  storeOptions({
    storeId: "org-redheadsteel-abc123",
    // No initialSyncOptions needed - defaults to background
  }),
)

// Option B: Blocking sync (recommended for first-time)
// - Waits for sync to complete
// - Shows "Setting up RedHeadSteel..." screen
// - User sees complete data when ready
const store = useStore(
  storeOptions({
    storeId: "org-redheadsteel-abc123",
    adapter: makePersistedAdapter({
      sync: {
        backend,
        initialSyncOptions: {
          _tag: "Blocking",
          timeout: Duration.seconds(60),
        },
      },
    }),
  }),
)
```

See the **"Automatic Sync from seqNum 0"** section above for detailed configuration options and best practices.

### 5. Backend: Authorization Check

In `apps/backend/src/sync/worker.ts`:

```typescript
async function validatePayload(payload, context, env) {
  const { authToken } = payload
  const { storeId } = context // e.g., "org-redheadsteel-abc123"

  // Validate session
  const session = await env.DB.prepare(
    `
    SELECT s.*, u.id as user_id
    FROM session s
    JOIN user u ON s.user_id = u.id
    WHERE s.token = ? AND s.expires_at > ?
  `,
  )
    .bind(authToken, Date.now())
    .first()

  if (!session) throw new Error("Invalid session")

  // Extract organization ID from storeId
  const orgId = storeId.replace("org-", "")

  // Verify user is a member of this organization
  const membership = await env.DB.prepare(
    `
    SELECT role FROM organization_members
    WHERE organization_id = ? AND user_id = ?
  `,
  )
    .bind(orgId, session.user_id)
    .first()

  if (!membership) {
    throw new Error(`User not authorized for organization ${orgId}`)
  }

  console.log(
    `[Sync] User ${session.user_id} authorized for org ${orgId} with role ${membership.role}`,
  )
}
```

## Store Lifecycle

### Active Organization Store

When user is viewing RedHeadSteel:

```typescript
// apps/mobile/app/organization/[id]/_layout.tsx
export function OrganizationLayout() {
  const { id: orgId } = useLocalSearchParams()
  const storeId = `org-${orgId}`

  // Get the organization's store
  const store = useStore(storeOptions({
    storeId,
    schema,
    adapter: makePersistedAdapter({ sync: { ... } })
  }))

  // Query organization data
  const projects = store.useQuery(
    queryDb(tables.projects.where({ organizationId: orgId }))
  )

  return <ProjectsList projects={projects} />
}
```

### Store Caching

StoreRegistry keeps stores cached for 60 seconds after last use:

```typescript
// Store is retained in memory while in use
// After user navigates away, store stays cached for 60s
// If user returns within 60s, same store instance is reused
// After 60s of no use, store is disposed and will reload on next access
```

## Performance Considerations

### Large Event Logs

For long-running organizations with many events:

**Option 1: Event Log Compaction**

- Backend periodically creates state snapshots
- New users download: snapshot + recent events
- Reduces initial sync time

**Option 2: Lazy Project Loading**

- Use project-level stores: `project-${projectId}`
- Only sync when user opens that specific project
- Reduces initial data transfer

**Option 3: Pagination**

- Pull events in chunks
- Show progress indicator
- Allow app to be usable during sync

### Multi-Organization Users

Users in multiple organizations have multiple stores:

```typescript
User in 3 orgs:
- org-redheadsteel-abc123  (1,000 events)
- org-acmecorp-def456      (5,000 events)
- org-smithinc-ghi789      (500 events)

Total local storage:
- 3 event log databases
- 3 state databases
- ~6 MB total on disk
```

## Security Model

### Authorization Layers

1. **Sync Connection**: validatePayload checks membership
2. **Event Commit**: Backend validates user can create events for org
3. **Client-side**: Filter what user can see based on role

### Row-Level Security

Events include userId for audit:

```typescript
photoCaptured: {
  id: 'photo-123',
  projectId: 'proj-abc',
  capturedBy: 'user-xyz', // Who took the photo
  organizationId: 'redheadsteel-abc123'
}
```

## Migration Path

Current single-store setup needs refactoring:

### Phase 1: Backend Changes

1. Update `validatePayload` to extract orgId from storeId
2. Check organization membership in D1
3. Update Durable Object naming to use org-prefixed storeIds

### Phase 2: Mobile Changes

1. Create OrganizationStoresProvider context
2. Fetch user's organizations on login
3. Create store for each organization
4. Update UI to select active organization

### Phase 3: Data Migration

1. Migrate existing single store data to org-specific stores
2. Update env variables to remove global LIVESTORE_STORE_ID
3. Implement per-org store creation

## Future Enhancements

### Store Discovery

- Backend API: GET /api/user/organizations
- Returns list of orgs user can access
- Client creates stores dynamically

### Offline Support

- Stores sync independently
- User can work in one org while another syncs
- Background sync with retry logic

### Store Cleanup

- Remove stores for organizations user leaves
- Archive old organizations
- Implement data retention policies

## FAQ

### Can a user own multiple organizations?

**Yes, absolutely!** There is no technical limitation on the number of organizations a user can own or belong to.

**Examples:**

- Contractor managing multiple client organizations
- User with personal org + work org + side project org
- Admin managing multiple companies
- Freelancer with different teams

**How it works:**

```typescript
// User owns/belongs to 5 organizations
const userOrganizations = [
  { id: "org-1", name: "RedHeadSteel", role: "owner" },
  { id: "org-2", name: "AcmeCorp", role: "owner" },
  { id: "org-3", name: "Client Project A", role: "member" },
  { id: "org-4", name: "Personal", role: "owner" },
  { id: "org-5", name: "Side Hustle LLC", role: "owner" },
]

// Each gets its own store
// Each syncs independently
// Each has its own event log and state
// RBAC controls permissions within each
```

**This is purely an RBAC concern:**

- LiveStore doesn't care about ownership semantics
- Backend validates membership via `organization_members` table
- Each organization is just another isolated store
- User's role (owner/admin/member) is application-level logic

### Does sync from seqNum 0 happen automatically?

**Yes!** When you call `useStore()` for a new organization, LiveStore automatically:

1. Detects local databases don't exist
2. Sets cursor = undefined
3. Pulls ALL events from seqNum 0
4. Materializes complete state
5. No manual triggering needed

**What you control:**

- Whether to block UI during sync (`Blocking` vs `Skip`)
- Timeout duration for blocking mode
- Progress indication during background sync

**What LiveStore handles automatically:**

- Connecting to sync backend
- Pulling all historical events
- Processing events through materializers
- Building local state tables
- Tracking sync cursor for future syncs

### What happens on subsequent app launches?

After the initial sync from seqNum 0:

```typescript
// User opens app next day
const store = useStore(
  storeOptions({
    storeId: "org-redheadsteel-abc123",
    // Same storeId as before
  }),
)

// LiveStore automatically:
// 1. Opens existing local databases
// 2. Reads last synced event: seqNum 1523
// 3. Sets cursor = 1523
// 4. Pulls only NEW events since seqNum 1523
// 5. Materializes only the delta
// 6. Much faster than initial sync!
```

**Key Points:**

- ✅ Only new events are synced
- ✅ Cursor automatically tracked per organization
- ✅ Fast incremental updates
- ✅ Complete local state always available offline
