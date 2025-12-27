# Backend Tests

## Test Structure

```
tests/
├── unit/
│   └── bun/                    # Bun unit tests (fast, no Docker)
│       ├── queue-sheet-marker-detection.test.ts  # NEW: Per-sheet marker detection
│       ├── queue-marker-detection.test.ts        # LEGACY: Tile-based (skipped)
│       ├── queue-metadata-extraction.test.ts     # Metadata extraction (skipped - needs mock fix)
│       └── ...
├── integration/                # Integration tests (require Docker)
│   ├── queue-callout-processor.test.ts  # Callout processor container tests
│   └── ...
├── helpers/
│   ├── index.ts               # Test utilities
│   ├── fixtures.ts            # Sample PDF loading (sample-plan.pdf)
│   └── ...
└── fixtures/
    └── sample-plan.pdf        # Test PDF file
```

## Running Tests

### Unit Tests (No Docker Required)

```bash
cd /home/woodson/Code/projects/sitelink/packages/backend

# Run ALL bun unit tests
bun test tests/unit/bun/

# Run specific test file
bun test tests/unit/bun/queue-sheet-marker-detection.test.ts
```

**Expected Output**: 72 pass, 11 skip, 0 fail

### Integration Tests (Requires Docker)

#### Prerequisites

1. Docker must be running
2. callout-processor container must be built and running on port 8001

#### Step-by-Step

```bash
# 1. Build the callout-processor container (first time only)
cd /home/woodson/Code/projects/sitelink/packages/callout-processor
docker build -t callout-processor:test .

# 2. Start the container
docker run -d --name callout-processor-test -p 8001:8000 \
  -e OPENROUTER_API_KEY="your-openrouter-api-key" \
  callout-processor:test

# 3. Verify container is ready
curl http://localhost:8001/health
# Expected: {"status":"ready","service":"callout-processor"}

# 4. Run integration tests
cd /home/woodson/Code/projects/sitelink/packages/backend
bun run vitest run tests/integration/queue-callout-processor.test.ts

# 5. Cleanup
docker stop callout-processor-test && docker rm callout-processor-test
```

#### Quick One-Liner

```bash
# Build, start, test, cleanup (all in one)
cd /home/woodson/Code/projects/sitelink/packages/callout-processor && \
docker build -t callout-processor:test . && \
docker run -d --name callout-processor-test -p 8001:8000 \
  -e OPENROUTER_API_KEY="your-api-key" \
  callout-processor:test && \
sleep 5 && \
cd /home/woodson/Code/projects/sitelink/packages/backend && \
bun run vitest run tests/integration/queue-callout-processor.test.ts ; \
docker stop callout-processor-test ; docker rm callout-processor-test
```

### Vitest Tests (Cloudflare Workers)

```bash
cd /home/woodson/Code/projects/sitelink/packages/backend

# Run all vitest tests
bun run vitest run

# Run specific integration test
bun run vitest run tests/integration/queue-callout-processor.test.ts
```

## Test Timeouts

Some tests involve LLM API calls and take longer:

| Test Type | Timeout | Notes |
|-----------|---------|-------|
| Health check | 5s | Fast |
| Metadata extraction | 2 min | LLM call |
| Marker detection | 10 min | 574 shapes × LLM call |
| Error handling | 5s | Fast |

## Environment Variables

For integration tests with callout-processor:

```bash
OPENROUTER_API_KEY=sk-or-v1-...  # Required for LLM-based detection
```

## Container Ports

| Container | Internal Port | External Port |
|-----------|---------------|---------------|
| callout-processor | 8000 | 8001 |
| plan-ocr-service | 8000 | 8000 |

## Troubleshooting

### Container not responding

```bash
# Check if container is running
docker ps

# Check container logs
docker logs callout-processor-test

# Restart container
docker restart callout-processor-test
```

### Tests timing out

- Marker detection tests can take 10+ minutes for PDFs with many shapes
- Each shape requires an LLM API call
- Use a simpler test PDF or increase timeout

### Mock errors in unit tests

Some legacy tests are skipped due to incomplete mocks:
- `queue-marker-detection.test.ts` - Legacy tile-based approach
- `queue-metadata-extraction.test.ts` - Needs Drizzle mock updates

These are intentionally skipped and don't affect the new implementation.
