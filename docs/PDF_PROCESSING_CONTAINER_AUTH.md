# PDF Processing Container Authentication Architecture

**Date**: 2025-01-07
**Status**: Approved - Ready for Implementation
**Decision**: Use better-auth API Key Plugin with System User

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Why better-auth API Keys](#why-better-auth-api-keys)
3. [System User vs Uploading User](#system-user-vs-uploading-user)
4. [Implementation Guide](#implementation-guide)
5. [API Key Configuration](#api-key-configuration)
6. [Security Considerations](#security-considerations)
7. [Testing Strategy](#testing-strategy)

---

## Architecture Overview

### The Challenge

A Cloudflare Container processes PDF files and needs to report progress back to the Durable Object. The container must authenticate these progress updates without exposing public endpoints or managing permanent API keys.

### The Solution

Use **better-auth API Key Plugin** with a **system user** to generate short-lived (30-minute) API keys that the container uses to authenticate progress updates.

### Communication Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│          Container → Worker → DO with better-auth API Key            │
└─────────────────────────────────────────────────────────────────────┘

1. User uploads PDF (authenticated via better-auth session)
   ↓
2. Worker extracts userId from session
   ↓
3. Worker creates plan in D1:
   {
     id: "plan-123",
     uploadedBy: userId,
     processingStatus: "pending"
   }
   ↓
4. Worker generates API key for SYSTEM USER (30min TTL):
   apiKey = await auth.api.createApiKey({
     userId: SYSTEM_USERS.PDF_PROCESSOR,
     name: `pdf-processing-${planId}`,
     expiresIn: 30 * 60,
     metadata: { uploadedBy: userId, planId }
   })
   ↓
5. Worker calls DO to start processing
   ↓
6. DO starts container, passes API key as parameter
   ↓
7. Container processes pages:
   for each page:
     ├─ Generate tiles with vips
     ├─ Upload to R2
     └─ POST /api/processing/progress
        Header: Authorization: Bearer <api-key>
   ↓
8. Worker validates API key via better-auth
   ↓
9. Worker forwards to DO
   ↓
10. DO updates D1 (single source of truth) + broadcasts WebSocket
```

---

## Why better-auth API Keys

### Advantages Over Manual Token Management

| Feature | Manual Tokens | better-auth API Keys |
|---------|--------------|---------------------|
| **Storage** | Must implement yourself | ✅ Stored in D1 automatically |
| **Expiration** | Manual tracking + cleanup | ✅ Automatic expiration checking |
| **Validation** | Custom middleware | ✅ Built-in validation |
| **Rate Limiting** | Must implement | ✅ Built-in rate limiting |
| **Request Quota** | Manual tracking | ✅ Built-in request counting |
| **Revocation** | Manual deletion | ✅ Built-in revocation API |
| **Audit Trail** | Custom logging | ✅ Metadata + user tracking |

### Key Features Used

1. **Automatic Expiration**: Keys expire after 30 minutes
2. **Rate Limiting**: Max 10 requests per 10 seconds (prevents runaway containers)
3. **Request Quota**: Max 100 total requests (prevents infinite loops)
4. **Metadata**: Track planId, uploadedBy, timestamps for debugging
5. **Revocation**: Clean up keys when processing completes

---

## System User vs Uploading User

### Decision: Use System User ✅

**Why?** The container is performing a **system operation** (tile generation), not a user action.

### Comparison

| Aspect | Uploading User's ID | System User ID |
|--------|-------------------|----------------|
| **Audit Trail** | ✅ Direct user link | ✅ User tracked in metadata |
| **User Deletion** | ❌ Breaks processing | ✅ Independent of user lifecycle |
| **Permission Changes** | ❌ May invalidate key | ✅ Stable permissions |
| **Conceptual Model** | ❌ Container impersonates user | ✅ Container is system service |
| **Security Clarity** | ❌ Mixed concerns | ✅ Clear service-to-service auth |

### Example Scenario: User Deletion

```typescript
// Scenario: User uploads PDF, then gets removed from organization

// Option 1: User's API Key
// ❌ Processing fails mid-job (user's API key revoked)
// ❌ Half-processed tiles in R2, incomplete progress in DB
// ❌ Organization loses the processing work

// Option 2: System User API Key ✅
// ✅ Processing completes successfully
// ✅ Organization still gets the processed tiles
// ✅ User removal doesn't break system operations
```

### Authorization Model

The API key validates **the container's right to report progress**, not the user's right to access data:

- **User authorization**: "Can this user upload PDFs to this project?" → Checked at upload time
- **Container authorization**: "Can this container report progress for this plan?" → Checked during processing

By the time the container is processing, the user authorization check has already passed.

---

## Implementation Guide

### Step 1: Create System User (One-Time Setup)

```typescript
// packages/backend/src/core/auth/system-users.ts

/**
 * System users for service-to-service operations
 * These are not real users, but service accounts
 */
export const SYSTEM_USERS = {
  PDF_PROCESSOR: "system-pdf-processor",
  // Future: Add other system users as needed
  // EMAIL_SENDER: "system-email-sender",
  // WEBHOOK_HANDLER: "system-webhook-handler",
} as const

/**
 * Initialize system users in database
 * Run this once during deployment or in a migration
 */
export async function initializeSystemUsers(db: DrizzleD1Database) {
  for (const [name, id] of Object.entries(SYSTEM_USERS)) {
    await db.insert(users).values({
      id,
      email: `${id}@internal.sitelink.app`,
      name: name.replace(/_/g, " ").toLowerCase(),
      emailVerified: true,
      role: "system",
      createdAt: new Date()
    }).onConflictDoNothing() // Only insert if doesn't exist
  }

  console.info("System users initialized")
}
```

### Step 2: Setup better-auth with API Key Plugin

```typescript
// packages/backend/src/core/auth/index.ts

import { betterAuth } from "better-auth"
import { apiKey } from "better-auth/plugins"

export const auth = betterAuth({
  database: {
    // Your D1 database connection
  },
  plugins: [
    apiKey({
      // API keys expire after specified time
      // Will be overridden per-key in createApiKey()
    })
  ]
})
```

### Step 3: Worker Creates API Key on Upload

```typescript
// packages/backend/src/features/plans/http.ts

import { HttpApiEndpoint } from "@effect/platform"
import { Effect, Schema } from "effect"
import { SYSTEM_USERS } from "../../core/auth/system-users"

export const uploadPlan = HttpApiEndpoint.post("uploadPlan", "/api/plans/:projectId/upload")
  .setPath(Schema.Struct({
    projectId: Schema.String
  }))
  .addSuccess(Schema.Struct({
    planId: Schema.String,
    processingJobId: Schema.String
  }))

export const uploadPlanHandler = Effect.gen(function* () {
  const { projectId } = yield* HttpApiRequest.schemaPath
  const request = yield* HttpApiRequest.HttpApiRequest

  // 1. Get authenticated user from session
  const session = yield* getSessionFromRequest(request)
  if (!session) {
    return yield* Effect.fail({ error: "Unauthorized" })
  }

  const uploadingUserId = session.user.id
  const orgId = session.user.organizationId

  // 2. Upload PDF to R2, create plan in D1
  const planId = crypto.randomUUID()
  const pdfPath = `organizations/${orgId}/projects/${projectId}/plans/${planId}/source.pdf`

  yield* uploadPdfToR2(request.body, pdfPath)

  yield* db.insert(plans).values({
    id: planId,
    projectId,
    name: "Floor Plan A",
    uploadedBy: uploadingUserId, // Track uploader
    processingStatus: "pending",
    pdfPath,
    createdAt: new Date()
  })

  // 3. Generate API key for system user ✅
  const auth = yield* BetterAuthService

  const apiKeyData = yield* auth.api.createApiKey({
    body: {
      userId: SYSTEM_USERS.PDF_PROCESSOR, // ✅ System user, not real user
      name: `pdf-processing-${planId}`,
      expiresIn: 30 * 60, // 30 minutes (1800 seconds)

      // Track real user in metadata ✅
      metadata: {
        type: "pdf-processing",
        planId,
        projectId,
        organizationId: orgId,
        uploadedBy: uploadingUserId, // ✅ Audit trail
        uploadedByEmail: session.user.email,
        createdAt: new Date().toISOString()
      },

      // Rate limiting: Prevent runaway containers
      rateLimitEnabled: true,
      rateLimitMax: 10, // Max 10 requests per 10 seconds
      rateLimitTimeWindow: 10 * 1000, // 10 second window
      // → Allows 1 update per second (plenty fast)

      // Request quota: Max 100 total requests per key
      remaining: 100,
      refillAmount: 0, // No refill (one-time use)
      // → Prevents infinite loops if container goes rogue

      // Prefix: Easy to identify in logs
      prefix: "pdf_proc"
      // → Key looks like: "pdf_proc_abc123def456..."
    }
  })

  // 4. Start processing via DO with API key
  const doStub = yield* getDurableObjectStub(planId)
  yield* doStub.startProcessing({
    planId,
    pdfPath,
    organizationId: orgId,
    projectId,
    apiKey: apiKeyData.key // ✅ Pass generated key
  })

  return { planId, processingJobId: planId }
})
```

### Step 4: DO Starts Container with API Key

```typescript
// packages/backend/src/core/pdf-manager/index.ts

export class SitelinkPdfProcessor extends DurableObject<Env> {

  async startProcessing(request: ProcessingRequest) {
    const { planId, pdfPath, organizationId, projectId, apiKey } = request

    // 1. Update D1: Mark as "processing"
    await this.updateDatabase(planId, {
      processingStatus: "processing",
      processedPages: 0,
      processingStartedAt: new Date(),
      updatedAt: new Date()
    })

    // 2. Start container with API key injected
    const port = this.ctx.container.getTcpPort(8080)
    await port.fetch("http://container/process", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        planId,
        pdfPath,
        organizationId,
        projectId,
        apiKey, // ✅ Pass API key to container
        progressCallbackUrl: `https://api.${this.env.DOMAIN}/api/processing/progress`
      })
    })

    console.info(`Started processing ${planId} with 30min API key`)
  }

  /**
   * Update progress from container
   * NO DO STORAGE - just update D1 and broadcast ✅
   */
  async updateProgressFromContainer(
    planId: string,
    completedPages: number,
    totalPages: number
  ): Promise<void> {
    const isComplete = completedPages === totalPages
    const progressPercent = Math.round((completedPages / totalPages) * 100)

    // 1. Update D1 database (single source of truth) ✅
    await this.updateDatabase(planId, {
      processingStatus: isComplete ? "complete" : "processing",
      processedPages: completedPages,
      totalPages,
      updatedAt: new Date(),
      ...(isComplete && { processingCompletedAt: new Date() })
    })

    // 2. Broadcast to WebSocket clients ✅
    this.broadcast(planId, {
      planId,
      completedPages,
      totalPages,
      progress: progressPercent,
      status: isComplete ? "complete" : "processing"
    })

    console.info(`Progress: ${planId} - ${completedPages}/${totalPages}`)
  }

  private async updateDatabase(planId: string, updates: Partial<Plan>) {
    const db = drizzle(this.env.DB)
    await db.update(plans)
      .set(updates)
      .where(eq(plans.id, planId))
  }

  private broadcast(planId: string, message: any) {
    const websockets = this.ctx.getWebSockets()
    for (const ws of websockets) {
      if (ws.tags?.includes(planId)) {
        ws.send(JSON.stringify(message))
      }
    }
  }
}
```

### Step 5: Container Sends Progress with API Key

```typescript
// In Container: tile-processor-server.ts

import { serve } from "bun"

serve({
  port: 8080,

  async fetch(request) {
    const url = new URL(request.url)

    if (url.pathname === "/process" && request.method === "POST") {
      const { planId, pdfPath, apiKey, progressCallbackUrl } = await request.json()

      // Process in background
      processInBackground(planId, pdfPath, apiKey, progressCallbackUrl)

      return Response.json({ started: true })
    }
  }
})

async function processInBackground(
  planId: string,
  pdfPath: string,
  apiKey: string,
  callbackUrl: string
) {
  const totalPages = await getPageCount(pdfPath)

  for (let page = 1; page <= totalPages; page++) {
    // Generate tiles
    await generateTiles(page)

    // Upload to R2
    await uploadToR2(page)

    // Send progress with API key authentication ✅
    await sendProgress(callbackUrl, apiKey, {
      planId,
      completedPages: page,
      totalPages
    })
  }
}

async function sendProgress(
  callbackUrl: string,
  apiKey: string,
  progress: { planId: string; completedPages: number; totalPages: number }
) {
  const response = await fetch(callbackUrl, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`, // ✅ better-auth API key
      "Content-Type": "application/json"
    },
    body: JSON.stringify(progress)
  })

  if (!response.ok) {
    throw new Error(`Failed to send progress: ${response.status}`)
  }

  return response.json()
}
```

### Step 6: Worker Validates API Key

```typescript
// packages/backend/src/features/processing/http.ts

import { HttpApiEndpoint } from "@effect/platform"
import { Effect, Schema } from "effect"

const ProgressUpdateSchema = Schema.Struct({
  planId: Schema.String,
  completedPages: Schema.Number,
  totalPages: Schema.Number
})

export const progressUpdate = HttpApiEndpoint.post("progressUpdate", "/api/processing/progress")
  .addSuccess(Schema.Struct({ success: Schema.Literal(true) }))
  .addError(Schema.Struct({ error: Schema.String }), { status: 401 })
  .annotate(HttpApiEndpoint.Name, "Update Processing Progress")

export const progressUpdateHandler = Effect.gen(function* () {
  const request = yield* HttpApiRequest.HttpApiRequest

  // 1. Extract API key from Authorization header
  const authHeader = request.headers.get("authorization")
  if (!authHeader?.startsWith("Bearer ")) {
    return yield* Effect.fail({ error: "Missing or invalid Authorization header" })
  }

  const apiKey = authHeader.slice(7) // Remove "Bearer "

  // 2. Validate API key with better-auth ✅
  const auth = yield* BetterAuthService
  const validation = yield* auth.validateApiKey(apiKey)

  // better-auth automatically checks:
  // ✅ Key exists in database
  // ✅ Key hasn't expired (< 30 minutes old)
  // ✅ Key hasn't been revoked
  // ✅ Rate limit not exceeded (< 10 requests per 10 seconds)
  // ✅ Remaining count > 0 (< 100 total requests used)

  if (!validation.valid) {
    return yield* Effect.fail({ error: "Invalid or expired API key" })
  }

  // 3. Extract key metadata and verify
  const keyInfo = yield* auth.api.getApiKeyInfo(apiKey)

  if (keyInfo.metadata?.type !== "pdf-processing") {
    return yield* Effect.fail({ error: "Invalid API key type" })
  }

  // 4. Parse request body
  const body = yield* HttpApiRequest.schemaBodyJson(ProgressUpdateSchema)

  // Optional: Verify planId matches API key
  if (keyInfo.metadata?.planId !== body.planId) {
    return yield* Effect.fail({ error: "API key not authorized for this plan" })
  }

  // 5. Forward to DO
  const doStub = yield* getDurableObjectStub(body.planId)
  yield* doStub.updateProgressFromContainer(
    body.planId,
    body.completedPages,
    body.totalPages
  )

  return { success: true as const }
})
```

---

## API Key Configuration

### Recommended Settings

```typescript
const apiKeyData = await auth.api.createApiKey({
  body: {
    userId: SYSTEM_USERS.PDF_PROCESSOR,
    name: `pdf-processing-${planId}`,

    // Expiry: 30 minutes (plenty of buffer)
    expiresIn: 30 * 60, // 1800 seconds

    // Rate limiting: Prevent runaway containers
    rateLimitEnabled: true,
    rateLimitMax: 10, // Max 10 requests per 10 seconds
    rateLimitTimeWindow: 10 * 1000, // 10 second window
    // → Allows 1 update per second (plenty fast for page processing)

    // Request quota: Max 100 total requests per key
    remaining: 100,
    refillAmount: 0, // No refill (one-time use)
    // → Prevents infinite loops if container goes rogue

    // Metadata: For debugging and audit trail
    metadata: {
      type: "pdf-processing",
      planId,
      projectId,
      organizationId,
      uploadedBy: userId,
      uploadedByEmail: userEmail,
      createdAt: new Date().toISOString()
    },

    // Prefix: Easy to identify in logs
    prefix: "pdf_proc"
    // → Key looks like: "pdf_proc_abc123def456..."
  }
})
```

### Timing Analysis

```typescript
┌─────────────────────────────────────────────────────────────────────┐
│                        Timing Analysis                               │
└─────────────────────────────────────────────────────────────────────┘

PDF Processing Time Estimates:
├─ 3-page PDF (typical):     ~30 seconds
├─ 10-page PDF:              ~2 minutes
├─ 50-page PDF (max):        ~8-10 minutes
└─ Network/R2 upload delays: +20-30%

Total time with buffer:      ~13 minutes maximum

API Key Lifetime: 30 minutes

Buffer: 30min - 13min = 17 minutes ✅ (2.3x safety margin)
```

### Container Execution Limits

From Cloudflare docs:
- ✅ **Containers can run indefinitely** (not limited like Workers' 30s-5min)
- ✅ **15-minute grace period** on SIGTERM before SIGKILL
- ✅ **Designed for long-running jobs**

**Conclusion:** 30-minute API key expiry is more than sufficient.

---

## Security Considerations

### 1. **API Key Scope**

Each API key is scoped to:
- ✅ Single plan (validated via metadata)
- ✅ Single processing job
- ✅ System user (not real user)
- ✅ 30-minute lifetime
- ✅ 100 request maximum

### 2. **Rate Limiting**

Prevents runaway containers:
- 10 requests per 10 seconds = max 1/second
- Protects against infinite loops or bugs causing spam

### 3. **Request Quota**

100 total requests per key:
- 50-page PDF × 2 safety margin = 100 requests
- Prevents infinite retry loops

### 4. **Metadata Validation**

Worker validates:
- API key type is "pdf-processing"
- API key planId matches request planId
- Prevents key reuse for wrong plans

### 5. **Automatic Expiration**

better-auth automatically:
- Checks expiration on every validation
- Returns "expired" error after 30 minutes
- No manual cleanup needed (though revocation on completion is recommended)

### 6. **Audit Trail**

Track in metadata:
- Who uploaded the file (uploadedBy, uploadedByEmail)
- When key was created (createdAt)
- What plan is being processed (planId, projectId, organizationId)

### 7. **System User Isolation**

System user has limited permissions:
- Can only update processing progress
- Cannot access user data
- Cannot perform other operations

---

## Testing Strategy

### Unit Tests (Bun Test)

```typescript
// packages/backend/tests/unit/bun/auth-api-keys.test.ts

import { describe, test, expect, mock } from "bun:test"

describe("PDF Processing API Key Generation", () => {
  test("creates API key with correct parameters", async () => {
    const mockAuth = {
      api: {
        createApiKey: mock((config) => Promise.resolve({
          key: "pdf_proc_test123",
          id: "key-id-123"
        }))
      }
    }

    await createProcessingApiKey(mockAuth, {
      planId: "plan-1",
      uploadingUserId: "user-1",
      uploadingUserEmail: "user@example.com"
    })

    expect(mockAuth.api.createApiKey).toHaveBeenCalledWith({
      body: expect.objectContaining({
        userId: SYSTEM_USERS.PDF_PROCESSOR,
        expiresIn: 1800,
        rateLimitEnabled: true,
        metadata: expect.objectContaining({
          type: "pdf-processing",
          planId: "plan-1",
          uploadedBy: "user-1"
        })
      })
    })
  })
})
```

### Integration Tests (Vitest + Cloudflare)

```typescript
// packages/backend/tests/integration/processing-auth.test.ts

import { describe, it, expect } from "vitest"
import { env, createExecutionContext } from "cloudflare:test"

describe("Processing Progress Authentication", () => {
  it("should reject requests without API key", async () => {
    const response = await env.WORKER.fetch(
      new Request("http://localhost/api/processing/progress", {
        method: "POST",
        body: JSON.stringify({
          planId: "plan-1",
          completedPages: 1,
          totalPages: 3
        })
      })
    )

    expect(response.status).toBe(401)
  })

  it("should accept valid API key", async () => {
    // Create API key
    const apiKey = await env.AUTH.api.createApiKey({
      body: {
        userId: SYSTEM_USERS.PDF_PROCESSOR,
        expiresIn: 1800,
        metadata: { type: "pdf-processing", planId: "plan-1" }
      }
    })

    // Send progress update
    const response = await env.WORKER.fetch(
      new Request("http://localhost/api/processing/progress", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey.key}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          planId: "plan-1",
          completedPages: 1,
          totalPages: 3
        })
      })
    )

    expect(response.status).toBe(200)
  })

  it("should reject expired API key", async () => {
    // Create expired key (expiry in past)
    const apiKey = await env.AUTH.api.createApiKey({
      body: {
        userId: SYSTEM_USERS.PDF_PROCESSOR,
        expiresIn: -1, // Already expired
        metadata: { type: "pdf-processing", planId: "plan-1" }
      }
    })

    const response = await env.WORKER.fetch(
      new Request("http://localhost/api/processing/progress", {
        method: "POST",
        headers: { "Authorization": `Bearer ${apiKey.key}` },
        body: JSON.stringify({
          planId: "plan-1",
          completedPages: 1,
          totalPages: 3
        })
      })
    )

    expect(response.status).toBe(401)
  })

  it("should enforce rate limiting", async () => {
    const apiKey = await env.AUTH.api.createApiKey({
      body: {
        userId: SYSTEM_USERS.PDF_PROCESSOR,
        expiresIn: 1800,
        rateLimitEnabled: true,
        rateLimitMax: 2, // Max 2 requests
        rateLimitTimeWindow: 10000,
        metadata: { type: "pdf-processing", planId: "plan-1" }
      }
    })

    // Make 2 requests (should succeed)
    for (let i = 0; i < 2; i++) {
      const response = await makeProgressRequest(apiKey.key)
      expect(response.status).toBe(200)
    }

    // 3rd request should be rate limited
    const response = await makeProgressRequest(apiKey.key)
    expect(response.status).toBe(429) // Too Many Requests
  })
})
```

### Manual Testing

```bash
# 1. Create system user (one-time)
bun run db:seed:system-users

# 2. Upload PDF (creates API key)
curl -X POST http://localhost:8787/api/plans/proj-1/upload \
  -H "Cookie: auth_session=..." \
  -F "file=@sample.pdf"

# Response: { planId: "plan-123", processingJobId: "job-456" }

# 3. Simulate container progress update
curl -X POST http://localhost:8787/api/processing/progress \
  -H "Authorization: Bearer pdf_proc_abc123..." \
  -H "Content-Type: application/json" \
  -d '{
    "planId": "plan-123",
    "completedPages": 1,
    "totalPages": 3
  }'

# 4. Verify progress in D1
bun run db:query "SELECT * FROM plans WHERE id = 'plan-123'"

# 5. Test rate limiting (send 11 requests quickly)
for i in {1..11}; do
  curl -X POST http://localhost:8787/api/processing/progress \
    -H "Authorization: Bearer pdf_proc_abc123..." \
    -d '{"planId":"plan-123","completedPages":1,"totalPages":3}'
done
# 11th request should return 429 Too Many Requests
```

---

## Database Schema

### D1 Schema (Single Source of Truth)

```typescript
// packages/backend/src/core/database/schemas/index.ts

export const plans = D.sqliteTable("plans", {
  id: D.text().primaryKey(),
  projectId: D.text("project_id").notNull(),
  name: D.text().notNull(),

  // User who uploaded
  uploadedBy: D.text("uploaded_by")
    .notNull()
    .references(() => users.id),

  // Processing status (single source of truth) ✅
  processingStatus: D.text("processing_status")
    .$type<"pending" | "processing" | "complete" | "failed">()
    .default("pending"),

  processedPages: D.integer("processed_pages").default(0),
  totalPages: D.integer("total_pages"),

  // Paths
  pdfPath: D.text("pdf_path"),
  tilesPath: D.text("tiles_path"),

  // Timestamps
  createdAt: D.integer("created_at", { mode: "timestamp_ms" })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: D.integer("updated_at", { mode: "timestamp_ms" })
    .$defaultFn(() => new Date())
    .notNull(),
  processingStartedAt: D.integer("processing_started_at", { mode: "timestamp_ms" }),
  processingCompletedAt: D.integer("processing_completed_at", { mode: "timestamp_ms" })
})

// System users table
export const users = D.sqliteTable("users", {
  id: D.text().primaryKey(),
  email: D.text().notNull().unique(),
  name: D.text(),
  role: D.text().$type<"user" | "admin" | "system">().default("user"),
  emailVerified: D.integer("email_verified", { mode: "boolean" }).default(false),
  createdAt: D.integer("created_at", { mode: "timestamp_ms" })
    .$defaultFn(() => new Date())
    .notNull()
})

// better-auth creates these tables automatically ✅
// - api_keys
// - sessions
// - accounts
```

---

## Monitoring and Observability

### Key Metrics to Track

```typescript
// In Worker: Track API key usage
await logMetric("apikey.created", 1, {
  type: "pdf-processing",
  planId,
  userId: SYSTEM_USERS.PDF_PROCESSOR
})

await logMetric("apikey.validated", 1, {
  planId,
  valid: validation.valid
})

await logMetric("apikey.rate_limited", 1, {
  planId
})

await logMetric("apikey.expired", 1, {
  planId,
  ageMinutes: keyAgeInMinutes
})
```

### Alerts

Set up alerts for:
- ❗ **High rate limiting**: >10% of requests rate limited
- ❗ **Expired keys during processing**: Keys expiring before job completes
- ❗ **Invalid key attempts**: Potential security issue
- ❗ **Quota exceeded**: Container made >100 requests

### Debugging Queries

```sql
-- Find all active processing API keys
SELECT
  ak.*,
  u.email as system_user_email
FROM api_keys ak
JOIN users u ON ak.user_id = u.id
WHERE u.role = 'system'
  AND ak.expires_at > CURRENT_TIMESTAMP
  AND json_extract(ak.metadata, '$.type') = 'pdf-processing'

-- Find keys that expired during processing
SELECT
  ak.*,
  p.processing_status,
  p.processed_pages,
  p.total_pages
FROM api_keys ak
JOIN plans p ON json_extract(ak.metadata, '$.planId') = p.id
WHERE ak.expires_at < CURRENT_TIMESTAMP
  AND p.processing_status = 'processing'

-- Find rate-limited requests
SELECT
  date_trunc('hour', created_at) as hour,
  COUNT(*) as rate_limited_count
FROM api_key_usage_logs
WHERE error_type = 'rate_limited'
GROUP BY hour
ORDER BY hour DESC
```

---

## Optional: API Key Revocation on Completion

While better-auth automatically expires keys after 30 minutes, you can also explicitly revoke them when processing completes as a security best practice:

```typescript
// In DO: After processing completes
async updateProgressFromContainer(planId, completedPages, totalPages) {
  const isComplete = completedPages === totalPages

  // Update D1 + broadcast
  await this.updateDatabase(planId, { ... })
  this.broadcast(planId, { ... })

  // Revoke API key when done ✅
  if (isComplete) {
    await this.revokeProcessingApiKey(planId)
  }
}

private async revokeProcessingApiKey(planId: string) {
  // Get plan to find uploaded by user
  const db = drizzle(this.env.DB)
  const plan = await db.query.plans.findFirst({
    where: eq(plans.id, planId)
  })

  if (!plan) return

  // Query API keys for this plan
  const auth = this.env.AUTH
  const keys = await auth.api.listApiKeys({
    userId: SYSTEM_USERS.PDF_PROCESSOR
    // Note: Filter by metadata not directly supported in listApiKeys
    // May need to query D1 directly or iterate
  })

  // Find and revoke keys matching this planId
  for (const key of keys) {
    if (key.metadata?.planId === planId) {
      await auth.api.revokeApiKey({ keyId: key.id })
      console.info(`Revoked API key for completed job: ${planId}`)
    }
  }
}
```

**Note:** This is optional because keys auto-expire after 30 minutes anyway. Only implement if you need immediate revocation for security compliance.

---

## Summary

**Architecture:**
- ✅ better-auth API Key Plugin manages keys in D1
- ✅ System user (`system-pdf-processor`) owns all processing keys
- ✅ Uploading user tracked in metadata for audit trail
- ✅ 30-minute expiry with 2.3x safety margin
- ✅ Rate limiting (10 req/10s) prevents runaway containers
- ✅ Request quota (100 total) prevents infinite loops
- ✅ D1 is single source of truth (no DO storage duplication)

**Security:**
- ✅ API keys scoped to single plan
- ✅ System user has limited permissions
- ✅ Metadata validation prevents key reuse
- ✅ Automatic expiration and validation
- ✅ Audit trail preserved

**Benefits:**
- ✅ No permanent API keys to manage
- ✅ No manual token generation/storage
- ✅ Built-in rate limiting and quotas
- ✅ Decoupled from user lifecycle
- ✅ Clear service-to-service authentication model

---

**Last Updated**: 2025-01-07
**Status**: Ready for Implementation
