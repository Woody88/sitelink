
# Backend Package Guidelines

## Cloudflare Workers + Effect-TS Architecture

This backend is a **Cloudflare Worker** using **Effect-TS HTTP API** with **D1 database**.

## Folder Structure

Follow this exact structure for all backend code:

```
packages/backend/src/
├── core/                    # Core infrastructure services
│   ├── database.ts          # DrizzleD1Client service
│   ├── api.ts              # Base HttpApi definition
│   └── index.ts            # CoreLayer composition
│
├── features/               # Business feature modules
│   ├── health/
│   │   ├── service.ts      # HealthService (business logic)
│   │   ├── http.ts         # HTTP endpoints (HealthAPI)
│   │   └── index.ts        # HealthModule (layer composition)
│   │
│   └── [feature]/          # Organizations, Projects, Plans, Files
│       ├── service.ts      # Business logic
│       ├── http.ts         # HTTP API endpoints
│       └── index.ts        # Module layer composition
│
├── db/
│   └── schema.ts           # Drizzle schema definitions
│
├── api.ts                  # Main SiteLinkApi composition
└── index.ts               # Cloudflare Worker entry point
```

## Architecture Rules

### 1. Core Layer (Infrastructure)
- **Purpose**: Provides foundational services (Database, Config, etc.)
- **Dependencies**: Cloudflare environment bindings only
- **Exports**: Service layers that other modules depend on

### 2. Feature Modules (Business Logic)
- **Structure**: Each feature has `service.ts`, `http.ts`, and `index.ts`
- **Dependencies**: Core layer services only (no cross-feature dependencies)
- **Composition**: Use `Layer.provideMerge()` to satisfy internal dependencies
- **Exports**: Single module layer + HTTP API definitions

### 3. Layer Composition Rules
- **Services**: Declare dependencies by yielding other services in `Effect.gen`
- **Modules**: Use `Layer.provideMerge()` to satisfy feature-internal dependencies
- **App Level**: Use `Layer.provide()` to inject core infrastructure into features

## Effect-TS Patterns

### Service Definition
```typescript
export class MyService extends Effect.Service<MyService>()("MyService", {
  effect: Effect.gen(function* () {
    const database = yield* DrizzleD1Client  // Declares dependency

    return {
      myMethod: () => Effect.succeed("result")
    }
  })
}) {}
```

### Module Composition
```typescript
// In features/myfeature/index.ts
export const MyModule = MyHttpLive.pipe(
  Layer.provideMerge(MyService.Default)  // Satisfy HTTP layer's service dependency
)
```

### HTTP API Definition
```typescript
// In features/myfeature/http.ts
export const MyAPI = HttpApiGroup.make("My").pipe(
  HttpApiGroup.addEndpoint(/* endpoints */)
)
```

## Testing

**Use Vitest** (not bun test) for Cloudflare Workers testing:

```bash
bun run vitest
```

Test structure:
```typescript
import { describe, expect, it } from "vitest"
import { createExecutionContext, env, waitOnExecutionContext } from "cloudflare:test"
import worker from "../src/index"

describe("My Feature", () => {
  it("should work", async () => {
    const request = new Request("http://example.com/api/my-endpoint")
    const ctx = createExecutionContext()
    const response = await worker.fetch(request, env, ctx)
    await waitOnExecutionContext(ctx)

    expect(response.status).toBe(200)
  })
})
```

## Development Commands

- **Development**: `bun run dev` (uses Wrangler)
- **Testing**: `bun run vitest`
- **Database**: `bun run db:local:studio`
- **Migrations**: `bun run db:gen:migration`

## Key Dependencies

- **Effect-TS**: `effect`, `@effect/platform`
- **Database**: `drizzle-orm`, `@libsql/client`
- **Testing**: `vitest`, `@cloudflare/vitest-pool-workers`
- **Cloudflare**: `wrangler`, `@cloudflare/workers-types`
