# Testing Setup

## Overview

This backend uses Vitest with the Cloudflare Workers pool (`@cloudflare/vitest-pool-workers`) to test Workers code with access to Cloudflare bindings like R2, D1, Queues, and Durable Objects.

## Configuration

### Files

- **vitest.config.ts** - Main Vitest configuration
- **vitest.wrangler.json** - Test-specific Wrangler configuration (isolated from production)
- **vitest.setup.ts** - Test setup file (runs before all tests)

### Key Settings

- **Vitest Version**: 3.2.4 (compatible with @cloudflare/vitest-pool-workers 0.12.1)
- **Pool**: `@cloudflare/vitest-pool-workers` (Cloudflare Workers environment)
- **Compatibility**: nodejs_compat + nodejs_compat_v2
- **Globals**: Enabled (`describe`, `it`, `expect` available without imports)

## Available Bindings

Tests have access to the following Cloudflare bindings via `env` from `cloudflare:test`:

- **R2_BUCKET** - R2 object storage
- **DB** - D1 database
- **IMAGE_GENERATION_QUEUE** - Queue for image generation tasks
- **METADATA_EXTRACTION_QUEUE** - Queue for metadata extraction
- **CALLOUT_DETECTION_QUEUE** - Queue for callout detection
- **TILE_GENERATION_QUEUE** - Queue for tile generation
- **SYNC_BACKEND_DO** - Sync backend Durable Object
- **LIVESTORE_CLIENT_DO** - LiveStore client Durable Object
- **PLAN_COORDINATOR_DO** - Plan coordinator Durable Object

## Running Tests

```bash
# Run all tests
bun run test

# Run specific test file
bun run test src/__tests__/setup-validation.test.ts

# Run tests in watch mode
bun run test:watch

# Run tests with UI
bun run test:ui

# Generate coverage report
bun run test:coverage
```

## Writing Tests

### Basic Test Structure

```typescript
import { describe, it, expect } from "vitest";
import { env } from "cloudflare:test";

describe("My Feature", () => {
  it("should work correctly", async () => {
    // Access Cloudflare bindings
    await env.R2_BUCKET.put("test-key", "test-value");
    const result = await env.R2_BUCKET.get("test-key");

    expect(await result?.text()).toBe("test-value");
  });
});
```

### Testing with Queues

```typescript
import { env } from "cloudflare:test";

it("can send messages to queue", async () => {
  await env.IMAGE_GENERATION_QUEUE.send({
    planId: "test-plan",
    sheetNumber: 1,
  });
});
```

### Testing with Durable Objects

```typescript
import { env } from "cloudflare:test";

it("can interact with Durable Objects", async () => {
  const id = env.PLAN_COORDINATOR_DO.idFromName("test-plan");
  const stub = env.PLAN_COORDINATOR_DO.get(id);

  // Call methods on the DO
  const response = await stub.fetch("/api/state");
  expect(response.status).toBe(200);
});
```

## Known Issues

### OpenTelemetry Module Resolution

The Cloudflare Workers runtime has limited Node.js compatibility. Some dependencies (like `@opentelemetry/resources`) try to import modules like `node:os` which aren't available even with `nodejs_compat_v2`.

**Workaround**: Tests using dependencies with these imports may fail. Consider mocking or excluding such dependencies.

### Container Bindings

The `containers` field in `wrangler.json` is not currently supported in the test environment. Container-based tests should be run separately using integration testing approaches.

## Best Practices

1. **Isolation**: Each test should be independent and clean up after itself
2. **Async/Await**: Use async/await for all Cloudflare binding operations
3. **Cleanup**: Delete test data from R2/D1 after tests complete
4. **Naming**: Use descriptive test names that explain what is being tested
5. **Grouping**: Use `describe` blocks to group related tests
6. **Fast Tests**: Keep individual tests fast (<5s) for quick feedback loops

## Test Coverage

View coverage reports after running `bun run test:coverage`:

- **Text Report**: Console output
- **HTML Report**: `coverage/index.html`
- **JSON Report**: `coverage/coverage-final.json`

## Debugging

To debug tests:

1. Add `debugger` statements in your test code
2. Run tests with Node inspector enabled
3. Use VS Code's built-in debugging tools with Vitest

## Continuous Integration

Tests run in CI using the same configuration. Ensure all tests pass before merging.
