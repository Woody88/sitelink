# Remaining Work - What's Left to Implement

**Last Updated:** January 2025
**Status:** Post-Phase 1 (Database & Core Foundation Complete)

---

## Executive Summary

Most of the Auth and Organization functionality is **automatically provided** by Better Auth plugins. What remains is implementing the core business features (Projects, Files, Media) and integrating R2 storage for file handling.

---

## ✅ What's Already Done

### **Phase 1: Foundation ✓**
- ✅ Database schema with Better-Auth tables
- ✅ Core services: Database (Drizzle), Auth (Better-Auth), Email
- ✅ Basic HTTP API with Health endpoint
- ✅ Registration flow (creates organization + trial subscription)
- ✅ Organization soft delete with hooks

### **Automatically Provided by Better Auth ✓**
- ✅ Magic link authentication (`POST /sign-in/magic-link`, `GET /magic-link/verify`)
- ✅ OAuth flows (Google, Microsoft)
- ✅ Session management (`GET /session`, `POST /sign-out`)
- ✅ Organization CRUD (`POST /organization/create`, `PATCH /organization/update`)
- ✅ Member management (add, remove, update roles, list)
- ✅ Invitation system (create, list, accept, reject, cancel)
- ✅ Active organization switching (`POST /organization/set-active-organization`)

---

## 🔴 HIGH PRIORITY - Critical Path

### 1. **R2 Storage Service** ✅ (Core Infrastructure)
**Status:** ✅ COMPLETE
**Priority:** HIGH - Required for all file operations

**What Was Built:**
- ✅ `src/core/storage/index.ts` - StorageService following DatabaseService pattern
- ✅ Direct R2Bucket access via `storage.use((r2) => ...)` method
- ✅ Helper method `storage.batchDelete([keys])` for efficient batch operations
- ✅ Integrated into CoreLayer
- ✅ R2 binding wired up in worker entry point

**Implementation Details:**
- Minimal ~100 line wrapper (not a full abstraction layer)
- Uses global R2Bucket type from worker-configuration.d.ts
- Consistent Effect error handling with StorageError
- Testing deferred to feature modules (no unit tests for thin wrapper)

---

## 📋 Implementation Order: Easy → Complex

**Strategy:** Start simple, gradually increase complexity

### ⭐ **Phase 1: Projects Module** (Easiest - Start Here!)
**Complexity:** Database-only CRUD
**Why First:**
- Pure CRUD operations (no R2 storage)
- Learn feature module pattern
- Simple access control (org membership only)
- Dependencies: `DatabaseService`, `AuthService` only

### ⭐⭐ **Phase 2: Plans Module** (Medium)
**Complexity:** Database + relationships
**Why Second:**
- Introduces foreign key relationships to Projects
- Still database-only (defer PDF processing)
- Dependencies: `DatabaseService`, Projects

### ⭐⭐⭐ **Phase 3: Files Module** (Complex)
**Complexity:** Two-tier pattern (D1 + R2)
**Why Third:**
- First module using StorageService
- Learn two-tier pattern (D1 metadata + R2 storage)
- PDF upload/download without processing
- Dependencies: `DatabaseService`, `StorageService`, Plans

### ⭐⭐⭐⭐ **Phase 4: Media Module** (Most Complex)
**Complexity:** Storage + GPS + spatial data
**Why Last:**
- Combines everything learned
- Photos/videos with GPS coordinates
- Spatial linking to plan locations
- Possibly thumbnail generation
- Dependencies: `DatabaseService`, `StorageService`, Plans

---

### 2. **Projects Module**
**Status:** Schema exists, no feature module
**Priority:** HIGH - Users need this immediately after organization
**Estimated Time:** 1 day

**What to Build:**
- `src/features/projects/service.ts` - ProjectService
- `src/features/projects/http.ts` - HTTP endpoints
- `src/features/projects/index.ts` - Module composition

**Endpoints:**
```typescript
POST   /projects                         // Create project
GET    /projects/:id                     // Get project
GET    /organizations/:orgId/projects    // List org projects
PATCH  /projects/:id                     // Update project
DELETE /projects/:id                     // Delete project (cascade)
```

**Dependencies:** Core services only

---

### 3. **Plans Module** (Construction Plan Sheets)
**Status:** Schema exists, no feature module
**Priority:** HIGH - Core product feature
**Estimated Time:** 2 days (without PDF processing)

**What to Build:**
- `src/features/plans/service.ts` - PlanService
- `src/features/plans/http.ts` - HTTP endpoints
- `src/features/plans/index.ts` - Module composition

**Endpoints:**
```typescript
POST   /projects/:id/plans               // Create plan (metadata only for now)
GET    /plans/:id                        // Get plan details
GET    /projects/:id/plans               // List project plans
PATCH  /plans/:id                        // Update plan metadata
DELETE /plans/:id                        // Delete plan
```

**Note:** Start with metadata only, defer PDF processing to Phase 2

**Dependencies:** R2 Storage Service, Projects Module

---

### 4. **PDF Processing Architecture** (Critical Design Decision)
**Status:** Not designed
**Priority:** HIGH - Can't defer forever
**Estimated Time:** 3-4 days design + implementation

**What to Decide:**
1. Containerized service (recommended) - `packages/processing/`
2. Cloudflare Worker (CPU time limits risky)
3. Third-party API (adds cost + vendor dependency)

**Recommended Approach:**
- Separate containerized service with Sharp library
- Queue-based processing (Cloudflare Queues)
- Upload PDF → Queue job → Process → Store tiles in R2
- Update plan status: `pending` → `processing` → `complete` | `failed`

**Dependencies:** R2 Storage Service, Plans Module

---

## 🟡 MEDIUM PRIORITY - MVP Features

### 5. **Files Module**
**Status:** Schema exists, no feature module
**Priority:** MEDIUM - Links files to plans
**Estimated Time:** 1 day

**What to Build:**
- `src/features/files/service.ts` - FileService
- `src/features/files/http.ts` - HTTP endpoints
- `src/features/files/index.ts` - Module composition

**Endpoints:**
```typescript
POST   /plans/:id/files                  // Link file to plan
GET    /files/:id                        // Get file metadata
DELETE /files/:id                        // Delete file from R2
```

**Dependencies:** R2 Storage Service, Plans Module

---

### 6. **Media Module** (Photos/Videos)
**Status:** Schema exists, no feature module
**Priority:** MEDIUM - MVP feature
**Estimated Time:** 1-2 days

**What to Build:**
- `src/features/media/service.ts` - MediaService
- `src/features/media/http.ts` - HTTP endpoints
- `src/features/media/index.ts` - Module composition

**Endpoints:**
```typescript
POST   /projects/:id/media               // Upload photo/video
GET    /media/:id                        // Get media
GET    /plans/:id/media                  // List media for plan
DELETE /media/:id                        // Delete media
```

**Storage Structure:**
```
/orgs/{orgId}/projects/{projectId}/media/
  /photos/
    /{mediaId}.jpg
    /{mediaId}_thumb.jpg
  /videos/
    /{mediaId}.mp4
    /{mediaId}_thumb.jpg
```

**Dependencies:** R2 Storage Service, Projects Module

---

### 7. **Payments Module** (Polar Integration)
**Status:** Schema exists, no feature module
**Priority:** MEDIUM - Revenue, but can launch with trials
**Estimated Time:** 2 days

**What to Build:**
- `src/features/payments/service.ts` - PaymentService
- `src/features/payments/http.ts` - HTTP endpoints
- `src/features/payments/index.ts` - Module composition

**Endpoints:**
```typescript
POST   /subscriptions                    // Create subscription
GET    /organizations/:orgId/subscription // Get subscription
PATCH  /organizations/:orgId/subscription // Update subscription
DELETE /organizations/:orgId/subscription // Cancel subscription
POST   /webhooks/polar                   // Handle Polar webhooks
```

**Dependencies:** Core services only

---

## 🟢 LOW PRIORITY - Polish & Completion

### 8. **Organization Module - Remaining Features**
**Status:** Partial (soft delete exists)
**Priority:** LOW - Nice to have
**Estimated Time:** 4 hours

**What to Build:**
```typescript
POST /organizations/:id/restore          // Restore soft-deleted org
GET  /organizations/:id/seats            // Get seat usage info
```

**Dependencies:** OrganizationService already exists

---

### 9. **Scheduled Hard Delete Job**
**Status:** TODO comment in code
**Priority:** LOW - Can be added post-MVP
**Estimated Time:** 1 day

**What to Build:**
- Cloudflare Queue consumer for delayed deletion
- Schedule deletion job when org soft-deleted
- Execute hard delete after 30 days

**Dependencies:** Organization Module

---

### 10. **Enhanced Authorization Middleware**
**Status:** Basic session checking exists
**Priority:** LOW - RBAC beyond org membership
**Estimated Time:** 1-2 days

**What to Build:**
- Permission checking beyond org membership
- Action-level permissions (e.g., `projects:create`, `files:delete`)

**Dependencies:** All feature modules

---

### 11. **Email Templates**
**Status:** Basic magic link works
**Priority:** LOW - Functional but ugly
**Estimated Time:** 1 day

**What to Build:**
- HTML email templates for:
  - Magic link emails
  - Organization invitations
  - Trial expiration warnings

**Dependencies:** EmailService

---

### 12. **Comprehensive Testing**
**Status:** Basic tests exist
**Priority:** LOW - But important for quality
**Estimated Time:** Ongoing

**What to Build:**
- Integration tests for all modules
- Unit tests for services
- E2E workflow tests

**Dependencies:** All feature modules

---

## 📊 Recommended Implementation Order

### **Sprint 1: Storage Foundation** (Week 1)
1. ✅ **R2 Storage Service (Core)** - COMPLETE
2. **Projects Module** - NEXT
3. **Plans Module (metadata only)**

**Goal:** Users can create projects and plan records

**Current Status:** R2 Storage complete, ready to implement Projects Module

---

### **Sprint 2: File Processing** (Week 2-3)
4. ✅ PDF Processing Architecture Design
5. ✅ PDF Processing Implementation
6. ✅ Files Module
7. ✅ Integrate PDF processing with Plans

**Goal:** Users can upload PDFs and view tiles

---

### **Sprint 3: Media & Payments** (Week 4)
8. ✅ Media Module
9. ✅ Payments Module (Polar integration)

**Goal:** Users can capture site photos and subscribe

---

### **Sprint 4: Polish** (Week 5)
10. ✅ Organization restore endpoint
11. ✅ Scheduled hard delete jobs
12. ✅ Email templates
13. ✅ Testing

**Goal:** Production-ready platform

---

## 🎯 Immediate Next Steps

### **Current Status:**
✅ **R2 Storage Service** - COMPLETE

### **Start Here (In Order):**
1. **Projects Module** ⭐ - Quick win, simple CRUD, database-only
2. **Plans Module (Basic)** ⭐⭐ - Metadata only, defer processing
3. **Files Module** ⭐⭐⭐ - Learn two-tier pattern (D1 + R2)
4. **Media Module** ⭐⭐⭐⭐ - Most complex, combines everything

### **Then Decide:**
- PDF Processing approach (containerized service recommended)
- Whether to implement Payments before or after MVP launch

---

## Open Questions

1. **PDF Processing:** Containerized service vs. Worker vs. Third-party?
2. **Payments Timing:** MVP with trials only, or add Polar immediately?
3. **Media Priority:** Core MVP or post-launch feature?
4. **Testing Strategy:** Write tests as we go or batch at end?

---

## Notes

- Better Auth handles 95% of auth/org functionality
- Focus on business logic (Projects, Files, Media)
- R2 Storage is the critical blocker for all file features
- PDF processing can be deferred by starting with metadata-only plans
