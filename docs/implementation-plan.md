# Local Development Setup Plan - Effect-TS HTTP API + Clerk

## Overview

Setting up the Sitelink backend using a **hybrid architecture**:
- **Main Worker**: Effect-TS HTTP API with direct D1/R2 access
- **Processing Service**: Containerized Sharp-based PDF processing
- **Clerk SDK** for authentication
- **D1 Database** for data storage
- **R2 Storage** for file storage

## Architectural Decision: Hybrid Approach

**Main Worker (Effect-TS):**
- Handles all HTTP API endpoints, database operations, authentication
- Direct access to Cloudflare bindings (D1, R2, etc.)
- No containers = simpler database access and development

**Image Processing Service (Containerized):**
- Only handles PDF → image conversion and DZI tile generation
- Contains Sharp + native libraries in container
- Triggered by main worker via HTTP/queue
- Returns processed results to R2

## Code Architecture & Folder Structure

### Backend Structure (Effect-TS HTTP API)
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
│   └── [future modules]/   # Organizations, Projects, Plans, Files
│
├── db/
│   └── schema.ts           # Drizzle schema definitions
│
├── api.ts                  # Main SiteLinkApi composition
└── index.ts               # Cloudflare Worker entry point
```

### Architecture Rules
1. **Core Layer**: Infrastructure services (Database, Config, etc.)
2. **Feature Modules**: Self-contained business domains following PaulJPhilp's composable pattern
3. **HTTP API**: Uses `@effect/platform` HttpApiBuilder instead of RPC
4. **Layer Composition**: Each feature exports a module layer that declares dependencies
5. **Dependency Injection**: CloudflareEnv injected at worker boundary, flows through layers

---

## Phase 1: Foundation (1-2 days)

### 1.1 D1 Database Setup
- [x] Add D1 binding to `wrangler.jsonc`
- [x] Create SQL schema based on `database.mermaid`:
  - Organizations table
  - Projects table
  - Plans table
  - Files table
  - Media table
- [x] Set up local D1 database
- [x] Create migration system
- [x] Test local database operations

### 1.2 Main Worker Setup (Effect-TS HTTP API)
- [x] Remove container configuration from main worker
- [x] Set up Effect-TS HTTP API structure
- [x] Add health check HTTP endpoint
- [x] Configure proper error handling
- [x] Test basic HTTP API communication with D1 binding

### 1.3 Processing Service Setup (Containerized)
- [ ] Create separate processing service package
- [ ] Set up Docker container with Sharp dependencies
- [ ] Create HTTP endpoint for PDF processing
- [ ] Test container builds and runs locally

### 1.4 Basic Dependencies
- [ ] Add Clerk SDK to main worker (`@clerk/cloudflare-workers`)
- [x] Add Effect-TS HTTP API dependencies to main worker
- [ ] Add Sharp to processing service container
- [ ] Update wrangler.jsonc for hybrid architecture

---

## Phase 2: Authentication & Core API (2-3 days)

### 2.1 Clerk Authentication Integration
- [ ] Set up Clerk SDK in Effect middleware
- [ ] Implement JWT verification using `getAuth()`
- [ ] Create protected HTTP API route wrapper
- [ ] Add user context extraction
- [ ] Test authentication flow

### 2.2 Database Sync System
- [ ] Create HTTP webhook endpoints for Clerk
  - User creation/update webhook
  - Organization creation/update webhook
- [ ] Create HTTP webhook endpoints for Stripe
  - Subscription creation/update webhook
  - Payment status webhook
- [ ] Implement database sync logic using Effect + D1
- [ ] Add webhook signature verification
- [ ] Test webhook integration

### 2.3 R2 Storage Integration
- [ ] Add R2 binding to `wrangler.jsonc`
- [ ] Implement file storage operations in Effect
- [ ] Set up file organization structure:
  ```
  /orgs/{org_id}/
    /projects/{project_id}/
      /plans/{plan_id}/
        /original.pdf
        /tiles/
        /thumbnail.jpg
      /media/
        /photos/
        /videos/
  ```
- [ ] Test basic file upload/download to R2

### 2.4 Core HTTP API Endpoints
- [ ] Projects CRUD operations
- [ ] Plans CRUD operations
- [ ] Basic file metadata operations
- [ ] Organization/user queries
- [ ] Test all endpoints with authentication

---

## Phase 3: File Processing (3-4 days)

### 3.1 HTTP API File Upload System
- [ ] Implement file upload via Effect HTTP API
- [ ] Add file validation (PDF format, size limits)
- [ ] Implement progress tracking
- [ ] Add proper error handling for upload failures
- [ ] Test large file uploads

### 3.2 Processing Service Integration
- [ ] HTTP client in main worker to call processing service
- [ ] Queue system for processing jobs
- [ ] Processing status tracking in D1
- [ ] Error handling between main worker and processing service

### 3.3 PDF Processing Pipeline (In Processing Service)
- [ ] Sharp-based PDF → image conversion
- [ ] DZI (Deep Zoom Image) tile generation
- [ ] Tile pyramid structure creation
- [ ] Thumbnail image generation
- [ ] Direct R2 upload from processing service
- [ ] Test processing with various PDF sizes

### 3.3 Storage & Optimization
- [ ] Implement proper tile storage structure in R2
- [ ] Add background processing queues using Effect
- [ ] Implement retry logic for failed processing
- [ ] Add processing status tracking
- [ ] Optimize tile generation performance
- [ ] Test end-to-end file processing workflow

### 3.4 Error Handling & Monitoring
- [ ] Comprehensive error handling throughout pipeline
- [ ] Logging and monitoring setup
- [ ] Processing failure recovery
- [ ] Storage cleanup for failed uploads
- [ ] Performance monitoring

---

## Key Architectural Decisions

### Database Schema
- Using simplified schema from `database.mermaid`
- Local D1 database syncs user/org/subscription data from Clerk/Stripe
- No direct Clerk API calls from RPC endpoints

### API Design
- **Main Worker**: Effect-TS HTTP API for all business logic (type-safe)
- **HTTP Endpoints**: RESTful API endpoints using Effect Platform
- **Authentication**: Clerk SDK handles JWT verification automatically
- **File Uploads**: HTTP multipart upload with progress tracking

### Processing Strategy
- **Hybrid Architecture**: Main worker (no containers) + Processing service (containerized)
- **Main Worker**: Direct Cloudflare bindings access (D1, R2, etc.)
- **Processing Service**: Sharp + native libraries in container
- **Communication**: HTTP/queue between main worker and processing service
- **Storage**: R2 for all files, D1 for metadata only

### Development Workflow
- **Main Worker**: Standard Wrangler dev with D1/R2 bindings
- **Processing Service**: Separate container development
- Local D1 database for testing main worker
- Type-safe HTTP API client generation for mobile app
- Webhook testing with local tunneling

---

## Success Criteria

### Phase 1 Complete
- [x] Local D1 database operational
- [x] Basic HTTP API endpoints responding
- [ ] Container development environment working
- [x] Health checks passing

### Phase 2 Complete
- [ ] Authentication working with Clerk SDK
- [ ] User/org data syncing from webhooks
- [ ] R2 file storage operational
- [ ] Core CRUD operations functional

### Phase 3 Complete
- [ ] PDF upload via HTTP API working
- [ ] Sharp processing generating tiles
- [ ] Complete file processing pipeline
- [ ] Error handling and recovery working
- [ ] Ready for mobile app integration

---

## Next Steps After Implementation

1. **Mobile App Integration**: Use generated HTTP API client
2. **Production Deployment**: Deploy to Cloudflare Workers
3. **Monitoring Setup**: Production observability
4. **Performance Optimization**: Based on real usage patterns
5. **Feature Expansion**: Sheet linking, annotations, etc.