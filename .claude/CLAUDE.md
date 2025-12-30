# SiteLink Project Context

## Task Tracking

Use **bd** (beads) for task tracking. See `AGENTS.md` for full workflow.

```bash
bd ready              # Find available work
bd new "Task title"   # Create new issue
bd close <id>         # Complete work
bd sync && git push   # Always before ending session
```

---

## Quick Facts
- **Product:** Construction plan viewer with automated callout detection
- **Stack:** Cloudflare Workers + Effect-TS HttpApiBuilder + D1 + Expo
- **Location:** /home/woodson/Code/projects/sitelink
- **Monorepo:** Yes (packages/)
- **Framework:** Effect-TS (NOT Hono!)

## Current State
- **Backend:** 80% complete (auth, plans upload, org/project APIs, queues)
- **Callout Detection:** 80% accurate (circles + triangles BOTH implemented)
- **Mobile App:** Started (packages/mobile exists)
- **Testing:** Manual (needs automation)

## Technology Stack

### Backend
- **Platform:** Cloudflare Workers
- **Framework:** Effect-TS HttpApiBuilder + HttpServer (NOT Hono!)
- **Language:** TypeScript with Effect-TS
- **Database:** D1 (SQLite) via @effect/sql-d1
- **ORM:** Drizzle ORM via @effect/sql-drizzle
- **Storage:** R2
- **Auth:** better-auth (@polar-sh/better-auth)
- **Queues:** Cloudflare Queues (4-queue system)

### Mobile (In Progress)
- **Framework:** Expo (REQUIRED for OpenSeadragon)
- **Language:** React Native + TypeScript
- **Navigation:** Expo Router (file-based)
- **Data:** React Query + AsyncStorage
- **Camera:** Expo Camera

### Computer Vision (Existing)
- **Detection:** Hough Circle Transform + Contour Analysis
- **OCR:** PaddleOCR v2.7
- **Shapes:** Circles AND triangles (both implemented)
- **Format:** Dual-part (detail number / sheet number)
- **Accuracy:** ~80% confidence
- **Goal:** Improve to 90%+ (considering YOLO)

## Documentation References

**Always refer to official documentation:**
- Effect-TS: https://effect.website/llms.txt
- Cloudflare: https://developers.cloudflare.com/llms.txt
- Expo: https://docs.expo.dev/llms.txt

## Architecture

### Package Structure
```
packages/
├── backend/            # Cloudflare Workers (Effect-TS HttpApiBuilder)
├── callout-processor/  # Marker detection (Hough + Contour)
├── mobile/             # Expo app (in progress)
├── drizzle-effect/     # Database utilities
├── demo-frontend/      # Demo UI
└── plan-ocr-service/   # OCR service
```

### Queue Processing Pipeline
```
Queue 1: R2 Upload Notification → PDF Processing
Queue 2: PDF → Tiles (TileJob)
Queue 3: Tiles → Metadata (MetadataExtractionJob)
Queue 4: Metadata → Marker Detection (MarkerDetectionJob)
```

**Queue Types** (from src/core/queues/types.ts):
- R2Notification: Trigger for PDF processing
- TileJob: Sheet tile generation
- MetadataExtractionJob: Extract sheet metadata
- MarkerDetectionJob: Detect callouts (circles + triangles)
- SheetMarkerDetectionJob: Per-sheet marker detection

### Callout Detection (Current: Circles + Triangles)
- **Circles:** Hough Circle Transform
- **Triangles:** Contour analysis + vertex validation
- **Dual-part format:** "5/A7" = Detail 5 on Sheet A7
- **Standards:** US/Canada architectural conventions
- **Location:** packages/callout-processor/

## Agentic Team

### Orchestrator
- **sitelink-orchestrator** - Main coordinator, delegates tasks

### Specialists
- **marker-detection-engineer** - CV/OCR optimization, YOLO evaluation
- **api-developer** - Backend endpoints, Effect-TS HttpApiBuilder
- **database-engineer** - D1 schema, Drizzle migrations, queries
- **mobile-architect** - Expo/React Native, OpenSeadragon, camera
- **test-orchestrator** - Testing strategy, automation, coverage
- **cloudflare-specialist** - Workers, Queues, R2, deployment

### Skills (Auto-Invoked)
- **marker-detection-patterns** - Marker detection (circles + triangles)
- **effect-ts-patterns** - Effect-TS HttpApiBuilder, services, errors
- **expo-patterns** - Mobile development, UX workflow, offline-first

## Development Priorities

1. ✅ **Agentic team setup** (COMPLETE!)
2. 🎯 **Evaluate YOLO** for 80% → 90%+ accuracy improvement
3. 🎯 **Testing automation** (Vitest + Playwright + Maestro)
4. 🎯 **Complete media API** (photo/video upload)
5. 🎯 **Mobile app features** (plan viewer, marker navigation)

## Code Style

### TypeScript
- Strict mode enabled
- Functional patterns preferred
- Effect.gen over pipe chains

### Effect-TS Patterns
- Use HttpApiBuilder (NOT Hono!)
- Define endpoints with HttpApiEndpoint
- Implement handlers with HttpApiBuilder.handle
- Use Schema.TaggedError for errors
- Services with Context.Tag and Layer

### Commits
- Conventional commits (feat:, fix:, docs:, etc.)

### Testing
- Target: 80%+ coverage
- Unit tests: Vitest
- Integration: Vitest with test DB
- E2E: Playwright (web) + Maestro (mobile)

## Critical Instructions

**ALWAYS start tasks with orchestrator:**
```
"Use sitelink-orchestrator to plan [task]"
```

**Never skip the orchestrator.** This ensures:
- Proper task delegation
- Focused specialist work
- Clean main context
- Coordinated integration

## Important Technical Details

### Effect-TS API Framework
- Use HttpApiBuilder (NOT Hono!)
- Define endpoints: HttpApiEndpoint.get/post/put/delete
- Create API groups: HttpApiGroup.make()
- Implement handlers: HttpApiBuilder.handle()
- Server runtime: HttpServer.serve()

### Database
- D1 (SQLite on Cloudflare)
- ORM: Drizzle with @effect/sql-drizzle
- Migrations: drizzle-kit
- Access: Via DatabaseService Effect service

### Authentication
- Framework: better-auth (@polar-sh/better-auth)
- Integration: Effect-TS middleware
- Session management: Cookie-based

### Queues
- 4 separate queues (see types.ts for interfaces)
- Consumer pattern: Effect-TS programs
- Error handling: Retry with exponential backoff
- DLQ for failed jobs

## Current Focus: YOLO Evaluation

**Task:** Evaluate YOLOv8 for improving callout detection from 80% to 90%+

**Approach:**
1. Dataset creation (500+ annotated tiles)
2. Train YOLOv8n/YOLOv8m models
3. Integration with existing Queue 4
4. Benchmark vs current Hough+Contour
5. Deploy if accuracy > 90%

**Specialists involved:**
- marker-detection-engineer (training, optimization)
- cloudflare-specialist (deployment strategy)
- test-orchestrator (accuracy benchmarks)
- database-engineer (schema for YOLO metadata)

## Remember

- **We use Effect-TS HttpApiBuilder, NOT Hono!**
- Triangles are ALREADY implemented (not a new feature!)
- OpenSeadragon requires Expo (React DOM dependency)
- Effect-TS uses Effect.gen (not pipe chains)
- All markers follow US/Canada architectural standards
- Construction site UX: large buttons, high contrast, offline-first
- Always refer to llms.txt documentation for latest patterns
