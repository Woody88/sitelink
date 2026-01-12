# Backend Tests

Integration and unit tests for the backend processing pipeline.

## Test Files

### plan-coordinator.test.ts
Integration tests for the PlanCoordinator Durable Object that orchestrates the PDF processing pipeline.

Test coverage includes:
- **Initialization**: State creation, pre/post-init validation
- **Image Generation Stage**: Sheet tracking, duplicate prevention, stage transitions
- **Metadata Extraction Stage**: Valid/invalid sheet handling, progress tracking
- **Callout Detection Stage**: Valid sheet filtering, completion detection
- **Tile Generation Stage**: PMTiles completion, final state transitions
- **Progress Tracking**: Accurate counts across all stages, validSheets array
- **Error Handling**: Failure marking, progress preservation
- **Timeout Handling**: Alarm-based failure detection, state preservation
- **Full Pipeline Flows**: All-valid, mixed-valid, zero-valid sheet scenarios

Uses fetch-based HTTP API for DO testing with proper TypeScript types.

### r2-upload.test.ts
Tests R2 bucket upload functionality:
- Upload PDF to R2 with correct metadata
- Verify file exists and content matches
- Test uploadPdfAndTriggerPipeline triggers IMAGE_GENERATION_QUEUE
- Handle multiple uploads and overwrites
- Parse R2 event notification paths

### queue-processing.test.ts
Tests queue consumer handlers:
- IMAGE_GENERATION_QUEUE message processing
- METADATA_EXTRACTION_QUEUE batch processing
- CALLOUT_DETECTION_QUEUE with valid sheets
- TILE_GENERATION_QUEUE and PMTiles upload
- Error handling and retry logic
- Message format validation

### livestore-events.test.ts
Tests LiveStore event commitment during pipeline processing:
- Event schema validation for sheetMetadataExtracted
- Event schema validation for sheetCalloutsDetected
- Event schema validation for sheetTilesGenerated
- Timestamp purity (no Date.now() in materializers)
- LiveStore client integration and error handling
- R2 upload before event commitment
- Coordinator DO integration

## Running Tests

```sh
cd apps/backend

bun test
bun test --watch
bun test --ui
bun test --coverage
```

## Test Environment

Tests use Cloudflare Workers Vitest pool (`@cloudflare/vitest-pool-workers`) with:
- R2 bucket (miniflare)
- Queue producers (miniflare)
- Durable Objects (miniflare)

Configuration: `vitest.config.ts`

## Key Patterns

### R2 Upload Tests
```typescript
import { env } from 'cloudflare:test'
import { uploadPdfAndTriggerPipeline } from '../processing/r2-with-notifications'

const pdfData = new TextEncoder().encode("fake pdf content")
await uploadPdfAndTriggerPipeline(env, pdfPath, pdfData.buffer, {
  planId: "plan-123",
  projectId: "project-456",
  organizationId: "org-789",
  totalPages: 5,
})
```

### Queue Processing Tests
```typescript
import { handleImageGenerationQueue } from '../processing/queue-consumer'

const mockBatch: MessageBatch<ImageGenerationJob> = {
  queue: "sitelink-image-generation",
  messages: [mockMessage],
  ackAll: vi.fn(),
  retryAll: vi.fn(),
}

await handleImageGenerationQueue(mockBatch, env)
```

### Durable Object Testing Pattern
```typescript
import { env } from 'cloudflare:test'
import type { Env } from '../env'

// Get DO stub with proper types
const testEnv = env as unknown as Env
const id = testEnv.PLAN_COORDINATOR_DO.idFromName('test-plan-123')
const stub = testEnv.PLAN_COORDINATOR_DO.get(id)

// Call methods via HTTP fetch
const response = await stub.fetch('http://internal/initialize', {
  method: 'POST',
  body: JSON.stringify({
    planId: 'plan-123',
    projectId: 'project-456',
    organizationId: 'org-789',
    totalSheets: 3
  })
})

const result = await response.json()
```

The PlanCoordinator DO includes a `fetch()` handler that exposes all methods as HTTP endpoints for testing.

## Mocking Container Calls

Container interactions are mocked since we test the queue handlers, not the container itself:

```typescript
env.PDF_PROCESSOR_CONTAINER = {
  fetch: vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ sheets: [...] }), { status: 200 })
  )
} as any
```

## Test Coverage Areas

- ✅ PlanCoordinator DO state management and transitions
- ✅ Pipeline stage progression (image → metadata → callout → tiles → complete)
- ✅ Progress tracking and validation across all stages
- ✅ Error handling and timeout management
- ✅ R2 upload with metadata
- ✅ Queue message format validation
- ✅ Queue consumer processing logic
- ✅ Coordinator DO interactions
- ✅ LiveStore event emission and schema validation
- ✅ Timestamp purity in LiveStore events
- ✅ Error handling and retries
- ✅ Batch processing
- ✅ R2 path parsing
- ✅ Event commitment integration with LiveStore DO

## Notes

- Tests use miniflare for local Cloudflare Workers environment
- Container endpoints are mocked (not integration tested)
- Durable Object methods are mocked for testing queue handlers
- Each test cleans up R2 bucket in beforeEach

## LiveStore Event Testing (livestore-events.test.ts)

### Critical Patterns

**Timestamp Purity Validation**
Per CLAUDE.md, LiveStore materializers MUST be pure functions. Tests verify:
- Timestamps are in event schemas (extractedAt, detectedAt, generatedAt)
- No Date.now() calls in materializers
- Sequential events have increasing timestamps

**Event Schema Validation**
Tests verify all pipeline events match their domain schemas:
- sheetMetadataExtracted: sheetId, planId, sheetNumber, [sheetTitle], [discipline], extractedAt
- sheetCalloutsDetected: sheetId, planId, markers[], unmatchedCount, detectedAt
- sheetTilesGenerated: sheetId, planId, localPmtilesPath, [remotePmtilesPath], minZoom, maxZoom, generatedAt

**Mock Environment**
```typescript
mockEnv = {
  LIVESTORE_CLIENT_DO: { get, idFromName },  // Event commitment
  PLAN_COORDINATOR_DO: { get, idFromName },  // Stage tracking
  R2_BUCKET: { get, put },                   // Storage
  PDF_PROCESSOR_CONTAINER: { fetch },        // Processing
}
```

### Key Findings

1. **Timestamp Handling**: All timestamps correctly generated at event creation time ✅
2. **Event Structure**: All events match LiveStore schema definitions ✅
3. **Error Handling Gap**: LiveStore commit doesn't check response.ok (potential bug) ⚠️
4. **R2 Integration**: PMTiles files uploaded before event commitment ✅

### Related Files

- `packages/domain/src/events.ts` - Event definitions with Schema.Number timestamps
- `packages/domain/src/materializers.ts` - Pure materializer functions
- `apps/backend/src/processing/queue-consumer.ts` - Event commitment logic
- `apps/backend/src/sync/livestore-client.ts` - LiveStore client DO
