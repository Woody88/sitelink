# Projects Module - Implementation Guide

**Complexity:** ⭐ Easy (Database-only CRUD)
**Estimated Time:** 3-4 hours
**Status:** Ready to implement

---

## Table of Contents
1. [Overview](#overview)
2. [Database Schema](#database-schema)
3. [File Structure](#file-structure)
4. [Step-by-Step Tasks](#step-by-step-tasks)
5. [Code Examples](#code-examples)
6. [Testing](#testing)
7. [Acceptance Criteria](#acceptance-criteria)

---

## Overview

The Projects Module manages construction projects within organizations. It's the simplest feature module, making it perfect for establishing the feature module pattern before tackling more complex modules.

### Key Characteristics
- **Pure CRUD**: Simple create, read, update, delete operations
- **Database-only**: No R2 storage, no external APIs
- **Simple access control**: User must belong to project's organization
- **No cross-dependencies**: Only depends on core services

### What This Module DOES
✅ Create projects for an organization
✅ Get project details
✅ List all projects for an organization
✅ Update project (name, description)
✅ Delete project (cascade to plans/files handled by database)
✅ Verify user has access to project

### What This Module DOES NOT DO
❌ Manage organization access (delegates to Organization module)
❌ Upload files (delegates to Files module)
❌ Process PDFs (delegates to Plans module)
❌ Handle payments (delegates to Payments module)

---

## Database Schema

The `projects` table should already exist in your database. Here's the expected schema:

```sql
CREATE TABLE projects (
  id TEXT PRIMARY KEY DEFAULT (uuid()),
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),

  -- Indexes
  INDEX idx_projects_organization (organization_id)
);
```

**Key Points:**
- `organization_id`: Foreign key to organizations table
- `ON DELETE CASCADE`: When organization is deleted, projects are automatically deleted
- `created_at/updated_at`: Timestamps in Unix epoch format (D1 default)
- Simple structure: Just name, description, and organization reference

**Drizzle Schema (should exist in your schema file):**
```typescript
export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
})
```

---

## File Structure

Create the following structure under `packages/backend/src/features/projects/`:

```
src/features/projects/
├── service.ts        # ProjectService - Business logic
├── http.ts           # ProjectAPI - HTTP endpoints
└── index.ts          # Module composition
```

### File Responsibilities

**`service.ts`** - Business Logic
- Implements `ProjectService` using Effect.Service pattern
- Contains all CRUD operations
- Handles access control checks
- Validates organization isn't soft-deleted
- Returns Effect types for composability

**`http.ts`** - HTTP Layer
- Defines HTTP API using Effect's HttpApiGroup
- Maps HTTP endpoints to service methods
- Extracts session/user context from requests
- Handles HTTP-specific validation
- Returns proper HTTP responses

**`index.ts`** - Module Composition
- Exports `ProjectModule` layer
- Composes service + HTTP layers
- Declares dependencies on core services

---

## Step-by-Step Tasks

### Task 1: Create ProjectService (service.ts)

**Estimated Time:** 90 minutes

#### Sub-tasks:
1. ✅ Import dependencies (Effect, Schema, Drizzle)
2. ✅ Define custom error types
3. ✅ Define ProjectService class
4. ✅ Implement `create` method
5. ✅ Implement `get` method
6. ✅ Implement `list` method
7. ✅ Implement `update` method
8. ✅ Implement `delete` method
9. ✅ Implement `verifyAccess` method

#### Error Types to Define:
```typescript
// Project not found
export class ProjectNotFoundError extends Schema.TaggedError<ProjectNotFoundError>()(
  "ProjectNotFoundError",
  { projectId: Schema.String }
) {}

// Access denied (user not in organization)
export class ProjectAccessDeniedError extends Schema.TaggedError<ProjectAccessDeniedError>()(
  "ProjectAccessDeniedError",
  { projectId: Schema.String, userId: Schema.String }
) {}

// Organization is soft-deleted
export class OrganizationDeletedError extends Schema.TaggedError<OrganizationDeletedError>()(
  "OrganizationDeletedError",
  { organizationId: Schema.String }
) {}
```

#### Service Structure:
```typescript
export class ProjectService extends Effect.Service<ProjectService>()(
  "ProjectService",
  {
    dependencies: [Drizzle.Default],
    effect: Effect.gen(function* () {
      const db = yield* Drizzle

      const create = Effect.fn("Project.create")(function* (params: {
        organizationId: string
        userId: string
        name: string
        description?: string
      }) {
        // 1. Check organization exists and isn't deleted
        // 2. Check user belongs to organization
        // 3. Insert project
        // 4. Return projectId
      })

      const get = Effect.fn("Project.get")(function* (projectId: string) {
        // 1. Query project by ID
        // 2. Return project or throw ProjectNotFoundError
      })

      const list = Effect.fn("Project.list")(function* (params: {
        organizationId: string
        userId: string
      }) {
        // 1. Check user belongs to organization
        // 2. Query all projects for organization
        // 3. Return projects array
      })

      const update = Effect.fn("Project.update")(function* (params: {
        projectId: string
        userId: string
        data: { name?: string; description?: string }
      }) {
        // 1. Verify access
        // 2. Update project
      })

      const deleteProject = Effect.fn("Project.delete")(function* (params: {
        projectId: string
        userId: string
      }) {
        // 1. Verify access
        // 2. Delete project (cascade handled by DB)
      })

      const verifyAccess = Effect.fn("Project.verifyAccess")(function* (params: {
        projectId: string
        userId: string
      }) {
        // 1. Get project's organizationId
        // 2. Check user is member of that organization
        // 3. Return boolean
      })

      return {
        create,
        get,
        list,
        update,
        delete: deleteProject,
        verifyAccess,
      } as const
    })
  }
) {}
```

---

### Task 2: Create ProjectAPI (http.ts)

**Estimated Time:** 60 minutes

#### Sub-tasks:
1. ✅ Define HTTP API group
2. ✅ Add `POST /projects` endpoint
3. ✅ Add `GET /projects/:id` endpoint
4. ✅ Add `GET /organizations/:orgId/projects` endpoint
5. ✅ Add `PATCH /projects/:id` endpoint
6. ✅ Add `DELETE /projects/:id` endpoint
7. ✅ Create HTTP handler layer

#### API Endpoints:

```typescript
import { HttpApiEndpoint, HttpApiGroup } from "@effect/platform"
import { Schema } from "effect"

// Request/Response schemas
const CreateProjectRequest = Schema.Struct({
  name: Schema.String,
  description: Schema.optional(Schema.String),
})

const ProjectResponse = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  description: Schema.NullOr(Schema.String),
  organizationId: Schema.String,
  createdAt: Schema.Date,
  updatedAt: Schema.Date,
})

const ProjectListResponse = Schema.Struct({
  projects: Schema.Array(ProjectResponse),
})

// Define reusable params
const projectIdParam = HttpApiSchema.param("id", Schema.String)
const orgIdParam = HttpApiSchema.param("orgId", Schema.String)

// Define API Group
export const ProjectAPI = HttpApiGroup.make("projects")
  .add(
    HttpApiEndpoint.post("createProject")`/`
      .setPayload(CreateProjectRequest)
      .addSuccess(Schema.Struct({ projectId: Schema.String }))
      .addError(OrganizationDeletedError)
  )
  .add(
    HttpApiEndpoint.get("getProject")`/${projectIdParam}`
      .addSuccess(ProjectResponse)
      .addError(ProjectNotFoundError)
      .addError(ProjectAccessDeniedError)
  )
  .add(
    HttpApiEndpoint.get("listProjects")`/organizations/${orgIdParam}/projects`
      .addSuccess(ProjectListResponse)
  )
  .add(
    HttpApiEndpoint.patch("updateProject")`/${projectIdParam}`
      .setPayload(Schema.Struct({
        name: Schema.optional(Schema.String),
        description: Schema.optional(Schema.String),
      }))
      .addSuccess(Schema.Struct({ success: Schema.Literal(true) }))
      .addError(ProjectAccessDeniedError)
  )
  .add(
    HttpApiEndpoint.delete("deleteProject")`/${projectIdParam}`
      .addSuccess(Schema.Struct({ success: Schema.Literal(true) }))
      .addError(ProjectAccessDeniedError)
  )
  .prefix("/projects")
```

#### HTTP Handler Layer:
```typescript
export const ProjectHttpLive = HttpApiBuilder.group(
  Api,
  "projects",
  (handlers) =>
    Effect.gen(function* () {
      const projects = yield* ProjectService

      return handlers
        .handle("createProject", ({ payload, context }) =>
          Effect.gen(function* () {
            const session = context.session // From middleware
            const { projectId } = yield* projects.create({
              organizationId: session.organizationId,
              userId: session.userId,
              name: payload.name,
              description: payload.description,
            })
            return { projectId }
          })
        )
        .handle("getProject", ({ path }) =>
          projects.get(path.id)
        )
        .handle("listProjects", ({ path, context }) =>
          Effect.gen(function* () {
            const session = context.session
            const projectList = yield* projects.list({
              organizationId: path.orgId,
              userId: session.userId,
            })
            return { projects: projectList }
          })
        )
        .handle("updateProject", ({ path, payload, context }) =>
          Effect.gen(function* () {
            const session = context.session
            yield* projects.update({
              projectId: path.id,
              userId: session.userId,
              data: payload,
            })
            return { success: true as const }
          })
        )
        .handle("deleteProject", ({ path, context }) =>
          Effect.gen(function* () {
            const session = context.session
            yield* projects.delete({
              projectId: path.id,
              userId: session.userId,
            })
            return { success: true as const }
          })
        )
    })
).pipe(Layer.provide(ProjectService.Default))
```

---

### Task 3: Module Composition (index.ts)

**Estimated Time:** 15 minutes

#### What to do:
1. ✅ Export ProjectService
2. ✅ Export ProjectAPI
3. ✅ Export ProjectModule (composed layer)

#### Code:
```typescript
import { Layer } from "effect"
import { ProjectHttpLive } from "./http"
import { ProjectService } from "./service"

// Export service for other modules to use
export { ProjectService } from "./service"

// Export API for main API composition
export { ProjectAPI } from "./http"

// Export module layer (HTTP + Service composed)
export const ProjectModule = ProjectHttpLive.pipe(
  Layer.provide(ProjectService.Default)
)
```

---

### Task 4: Integration with Main API

**Estimated Time:** 15 minutes

#### What to do:
Update `packages/backend/src/api.ts` to include ProjectModule:

```typescript
import { HttpApiBuilder } from "@effect/platform"
import { HealthAPI } from "./features/health"
import { ProjectAPI } from "./features/projects"

export const Api = HttpApiBuilder.api("SiteLinkApi")
  .add(HealthAPI)
  .add(ProjectAPI) // ← ADD THIS
```

Update `packages/backend/src/index.ts` to provide ProjectModule:

```typescript
import { Layer } from "effect"
import { HealthModule } from "./features/health"
import { ProjectModule } from "./features/projects"

export const FeatureModules = Layer.mergeAll(
  HealthModule,
  ProjectModule, // ← ADD THIS
)

const SiteLinkApiLive = Api.pipe(
  Layer.provide(FeatureModules),
  Layer.provide(CoreLayer)
)
```

---

## Code Examples

### Example: Checking Organization Access

```typescript
// Helper function to check if user belongs to organization
const checkOrganizationAccess = Effect.fn("checkOrganizationAccess")(
  function* (userId: string, organizationId: string) {
    const membership = yield* db.use((db) =>
      db
        .select()
        .from(members)
        .where(
          and(
            eq(members.userId, userId),
            eq(members.organizationId, organizationId)
          )
        )
        .get()
    )

    if (!membership) {
      return yield* new ProjectAccessDeniedError({
        projectId: "unknown",
        userId,
      })
    }

    return membership
  }
)
```

### Example: Checking Organization Not Deleted

```typescript
const checkOrganizationNotDeleted = Effect.fn("checkOrganizationNotDeleted")(
  function* (organizationId: string) {
    const org = yield* db.use((db) =>
      db
        .select()
        .from(organizations)
        .where(eq(organizations.id, organizationId))
        .get()
    )

    if (!org) {
      return yield* new OrganizationDeletedError({ organizationId })
    }

    if (org.deletedAt) {
      return yield* new OrganizationDeletedError({ organizationId })
    }

    return org
  }
)
```

### Example: Creating a Project

```typescript
const create = Effect.fn("Project.create")(function* (params: {
  organizationId: string
  userId: string
  name: string
  description?: string
}) {
  // 1. Verify organization exists and isn't deleted
  yield* checkOrganizationNotDeleted(params.organizationId)

  // 2. Verify user belongs to organization
  yield* checkOrganizationAccess(params.userId, params.organizationId)

  // 3. Generate project ID
  const projectId = crypto.randomUUID()

  // 4. Insert project
  yield* db.use((db) =>
    db.insert(projects).values({
      id: projectId,
      organizationId: params.organizationId,
      name: params.name,
      description: params.description ?? null,
    })
  )

  return { projectId }
})
```

---

## Testing

### Unit Tests (Recommended but Optional)

Since this is a thin wrapper, you can defer testing to integration tests in feature modules.

### Integration Tests (Required)

Create `packages/backend/test/projects.test.ts`:

```typescript
import { describe, expect, it } from "vitest"
import { createExecutionContext, env, waitOnExecutionContext } from "cloudflare:test"
import worker from "../src/index"

describe("Projects API", () => {
  // Setup: Create test organization and user
  let sessionToken: string
  let organizationId: string

  it("should create a project", async () => {
    const request = new Request("http://example.com/projects", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${sessionToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Test Construction Site",
        description: "123 Main St",
      }),
    })

    const ctx = createExecutionContext()
    const response = await worker.fetch(request, env, ctx)
    await waitOnExecutionContext(ctx)

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.projectId).toBeDefined()
  })

  it("should get a project", async () => {
    // Test GET /projects/:id
  })

  it("should list projects for organization", async () => {
    // Test GET /organizations/:orgId/projects
  })

  it("should update a project", async () => {
    // Test PATCH /projects/:id
  })

  it("should delete a project", async () => {
    // Test DELETE /projects/:id
  })

  it("should deny access to project from different organization", async () => {
    // Test access control
  })
})
```

---

## Acceptance Criteria

### Functionality
✅ Users can create projects for their organization
✅ Users can view project details
✅ Users can list all projects in their organization
✅ Users can update project name/description
✅ Users can delete projects
✅ Access is denied to users outside the organization
✅ Operations are blocked if organization is soft-deleted

### Code Quality
✅ Follows Effect-TS service pattern
✅ Uses Effect.fn for all service methods
✅ Proper error handling with custom error types
✅ Type-safe HTTP API definitions
✅ All endpoints documented with JSDoc

### Integration
✅ ProjectModule integrated into main API
✅ ProjectAPI added to SiteLinkApi composition
✅ Service available to other modules via CoreLayer

### Testing
✅ At least 3 integration tests covering CRUD operations
✅ Access control test (deny cross-organization access)

---

## Common Pitfalls to Avoid

### 1. ❌ Don't Query Organizations Table Directly
**Wrong:**
```typescript
const org = yield* db.query.organizations.findFirst({
  where: eq(organizations.id, organizationId)
})
```

**Right:**
```typescript
const org = yield* db.use((db) =>
  db.select()
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .get()
)
```

### 2. ❌ Don't Forget Access Control
Every mutation (create, update, delete) MUST verify:
1. User belongs to organization
2. Organization isn't soft-deleted

### 3. ❌ Don't Use DatabaseService Pattern
The DatabaseService has a `use` method. ProjectService doesn't - it directly yields `Drizzle`:

**Wrong:**
```typescript
dependencies: [DatabaseService.Default]
const database = yield* DatabaseService
yield* database.use((db) => ...)
```

**Right:**
```typescript
dependencies: [Drizzle.Default]
const db = yield* Drizzle
yield* db.use((db) => ...)
```

### 4. ❌ Don't Hardcode UUIDs
**Wrong:**
```typescript
const projectId = "abc-123"
```

**Right:**
```typescript
const projectId = crypto.randomUUID()
```

### 5. ❌ Don't Forget to Export from index.ts
Both the service AND the API must be exported for other modules to use them.

---

## Reference Implementation

Look at existing modules for patterns:

### For Service Pattern:
- `src/features/health/service.ts`
- `src/core/organization/service.ts`

### For HTTP Layer:
- `src/features/health/http.ts`

### For Module Composition:
- `src/features/health/index.ts`

---

## Next Steps After Completion

Once the Projects Module is complete:

1. ✅ Test all endpoints with Wrangler dev server
2. ✅ Verify access control works
3. ✅ Run integration tests
4. ✅ Commit changes
5. ➡️ **Move to Plans Module** (next in complexity)

---

## Questions or Blockers?

### If you get stuck:
1. Check existing modules (Health, Organization) for patterns
2. Review Effect-TS docs in `.effect/` directory
3. Check database schema in Drizzle migrations
4. Review CLAUDE.md for Effect patterns

### Common Questions:

**Q: How do I get the current user's session?**
A: Session middleware should add `context.session` with `{ userId, organizationId }`

**Q: How do I check if organization is deleted?**
A: Query `organizations` table and check `deletedAt IS NULL`

**Q: Where is the database schema?**
A: Should be in `drizzle/` migrations directory or search for `sqliteTable("projects")`

**Q: How do I run tests?**
A: `bun run vitest` (Cloudflare Workers use Vitest, not bun test)

---

## Good Luck! 🚀

This is the easiest module - perfect for learning the pattern. Take your time, follow the examples, and you'll have it working in a few hours!
