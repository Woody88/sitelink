# Storage, Files, and Media Architecture Explained

**Audience:** Junior developers new to Effect-TS and the Sitelink codebase
**Last Updated:** January 2025

---

## TL;DR - Quick Summary

- **StorageService** = Generic file storage toolbox (core infrastructure)
- **Files Module** = Manages construction plan PDFs and tiles (business feature)
- **Media Module** = Manages site photos/videos linked to plan locations (business feature)

All three are separate. Files and Media both USE StorageService to do their jobs.

---

## Part 1: Understanding the Three Layers

Think of it like building a house:

### **1. StorageService** = The Toolbox 🧰

**What it is:**
- A **core infrastructure service** (lives in `src/core/storage/`)
- It's like a toolbox with basic tools that OTHER modules use
- Wraps Cloudflare R2 (cloud file storage) with Effect-TS patterns
- **Named generically** (not R2StorageService) for true abstraction

**What it does:**
- Provides **basic operations**: upload, download, delete, get URL
- Knows HOW to talk to storage, but doesn't know WHAT you're storing
- Used by Files module, Media module, Plans module, etc.

**Analogy:**
It's like having a hammer. The hammer doesn't know if you're building a table or a fence—it just knows how to hammer nails.

**Why NOT call it "R2StorageService"?**
- Defeats the purpose of abstraction
- Feature modules should depend on `StorageService` (generic interface)
- Implementation uses R2 today, but could swap to S3/MinIO/local filesystem tomorrow
- Following Effect-TS best practices: abstraction over implementation

**Code Example (Effect-TS pattern):**
```typescript
// src/core/storage/index.ts

// ✅ CORRECT: Generic name
export class StorageService extends Effect.Service<StorageService>()(
  "StorageService",  // ← Generic name, no R2 mentioned
  {
    dependencies: [R2Binding.Default],  // ← R2 is implementation detail
    effect: Effect.gen(function* () {
      const r2Bucket = yield* R2Binding  // Get R2 from Cloudflare

      // Basic tool: Upload a file
      const upload = Effect.fn("Storage.upload")(function* (
        path: string,
        data: Uint8Array,
        contentType: string
      ) {
        return yield* Effect.tryPromise({
          try: () => r2Bucket.put(path, data, {
            httpMetadata: { contentType }
          }),
          catch: (error) => new StorageError({ cause: error })
        })
      })

      // Basic tool: Download a file
      const download = Effect.fn("Storage.download")(function* (
        path: string
      ) {
        const object = yield* Effect.tryPromise({
          try: () => r2Bucket.get(path),
          catch: (error) => new StorageError({ cause: error })
        })

        if (!object) {
          return yield* Effect.fail(new FileNotFoundError({ path }))
        }

        return yield* Effect.promise(() => object.arrayBuffer())
      })

      // Basic tool: Delete a file
      const deleteFile = Effect.fn("Storage.delete")(function* (
        path: string
      ) {
        return yield* Effect.tryPromise({
          try: () => r2Bucket.delete(path),
          catch: (error) => new StorageError({ cause: error })
        })
      })

      // Basic tool: Get public URL
      const getUrl = (path: string) =>
        Effect.succeed(`https://your-cdn.com/${path}`)

      return {
        upload,
        download,
        deleteFile,
        getUrl
      } as const
    })
  }
) {}
```

**Key Point:** StorageService is just a **dumb wrapper** around storage. It doesn't know about "construction plans" or "site photos"—it just knows "upload blob to path."

---

### **2. Files Module** = The Carpenter 🔨

**What it is:**
- A **business feature module** (lives in `src/features/files/`)
- Knows about **construction plan files** (PDFs, DWG, etc.)
- Uses the Storage toolbox to store/retrieve plan-related files

**What it does:**
- Manages the **lifecycle** of plan files
- Knows the **file structure** for construction plans
- Tracks metadata in database (which plan, which project, processing status)
- Handles **PDF processing** (sends to processing service)

**Analogy:**
The carpenter uses the hammer (Storage) to build a specific thing (construction plan management). The carpenter knows "this PDF needs to go in `/orgs/123/projects/456/plans/789/original.pdf`"

**Database Schema:**
```typescript
// What Files module tracks in D1 database
// src/core/database/schemas/index.ts

export const files = sqliteTable("files", {
  id: text().primaryKey(),
  planId: text("plan_id")
    .notNull()
    .references(() => plans.id, { onDelete: "cascade" }),
  filePath: text("file_path"),        // Where in storage?
  fileType: text("file_type"),        // pdf, dwg, etc.
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .$defaultFn(() => new Date())
    .notNull(),
})
```

**Storage Structure (Files module decides this):**
```
/orgs/{orgId}/projects/{projectId}/plans/{planId}/
  /original.pdf              ← Original uploaded PDF
  /tiles/                    ← Generated by processing service
    /0/0_0.jpg               ← Zoom level 0
    /1/0_0.jpg, 1_0.jpg, 0_1.jpg, 1_1.jpg  ← Zoom level 1
    /2/...                   ← Zoom level 2
  /thumbnail.jpg             ← Preview image
```

**Code Example:**
```typescript
// src/features/files/service.ts

export class FileService extends Effect.Service<FileService>()(
  "FileService",
  {
    dependencies: [Drizzle.Default, StorageService.Default],  // ← Generic dependency
    effect: Effect.gen(function* () {
      const db = yield* Drizzle
      const storage = yield* StorageService  // Uses the toolbox!

      const uploadPlanPDF = Effect.fn("FileService.uploadPlanPDF")(
        function* (params: {
          planId: string
          projectId: string
          orgId: string
          pdfData: Uint8Array
        }) {
          // 1. Decide WHERE to store it (business logic)
          const filePath = `/orgs/${params.orgId}/projects/${params.projectId}/plans/${params.planId}/original.pdf`

          // 2. Use Storage toolbox to actually upload
          yield* storage.upload(filePath, params.pdfData, "application/pdf")

          // 3. Track it in database
          const [file] = yield* db
            .insert(schema.files)
            .values({
              id: generateId(),
              planId: params.planId,
              filePath,
              fileType: "pdf",
              createdAt: new Date()
            })
            .returning()

          // 4. Trigger processing (send to processing service)
          yield* queuePDFProcessing(params.planId, filePath)

          return file
        }
      )

      return { uploadPlanPDF } as const
    })
  }
) {}
```

**Key Point:** Files module knows **WHAT** you're storing (construction plans) and **WHERE** they go. It uses StorageService to do the actual storing.

---

### **3. Media Module** = The Photographer 📷

**What it is:**
- Another **business feature module** (lives in `src/features/media/`)
- Knows about **site photos and videos**
- ALSO uses the Storage toolbox, but for different files

**What it does:**
- Manages **site photos/videos** captured by workers
- Stores them linked to specific locations on plans
- Generates thumbnails for videos
- Tracks which user took what photo where

**Analogy:**
The photographer ALSO uses the same hammer (Storage), but builds something completely different (photo gallery). Different purpose, same tool.

**Database Schema:**
```typescript
// What Media module tracks
// src/core/database/schemas/index.ts

export const medias = sqliteTable("medias", {
  id: text().primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  planId: text("plan_id")                    // Optional: which plan sheet?
    .references(() => plans.id, { onDelete: "set null" }),
  filePath: text("file_path").notNull(),
  mediaType: text("media_type"),              // photo | video
  coordinates: text("coordinates"),           // JSON: { x: 450, y: 720 }
  description: text("description"),
  capturedBy: text("captured_by")
    .notNull()
    .references(() => users.id),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .$defaultFn(() => new Date())
    .notNull(),
})
```

**Storage Structure (Media module decides this):**
```
/orgs/{orgId}/projects/{projectId}/media/
  /photos/
    /media_abc123.jpg        ← Full resolution photo
    /media_abc123_thumb.jpg  ← Thumbnail
  /videos/
    /media_def456.mp4        ← Video
    /media_def456_thumb.jpg  ← Video thumbnail
```

**Code Example:**
```typescript
// src/features/media/service.ts

export class MediaService extends Effect.Service<MediaService>()(
  "MediaService",
  {
    dependencies: [Drizzle.Default, StorageService.Default],  // ← Same generic dependency
    effect: Effect.gen(function* () {
      const db = yield* Drizzle
      const storage = yield* StorageService  // Same toolbox!

      const uploadPhoto = Effect.fn("MediaService.uploadPhoto")(
        function* (params: {
          projectId: string
          orgId: string
          photoData: Uint8Array
          planId?: string
          coordinates?: { x: number, y: number }
          description?: string
        }) {
          const mediaId = generateId()

          // 1. Different path structure than Files
          const photoPath = `/orgs/${params.orgId}/projects/${params.projectId}/media/photos/${mediaId}.jpg`
          const thumbPath = `/orgs/${params.orgId}/projects/${params.projectId}/media/photos/${mediaId}_thumb.jpg`

          // 2. Use same Storage toolbox to upload
          yield* storage.upload(photoPath, params.photoData, "image/jpeg")

          // 3. Generate and upload thumbnail
          const thumbnail = yield* generateThumbnail(params.photoData)
          yield* storage.upload(thumbPath, thumbnail, "image/jpeg")

          // 4. Track in database (different table than files!)
          const [media] = yield* db
            .insert(schema.medias)
            .values({
              id: mediaId,
              projectId: params.projectId,
              planId: params.planId,
              mediaType: "photo",
              filePath: photoPath,
              coordinates: params.coordinates
                ? JSON.stringify(params.coordinates)
                : null,
              description: params.description,
              createdAt: new Date()
            })
            .returning()

          return media
        }
      )

      return { uploadPhoto } as const
    })
  }
) {}
```

**Key Point:** Media module knows about **photos/videos** and stores them differently than Files module, but both use the same StorageService.

---

## Part 2: Why Media Needs Coordinates

This is a **critical product feature** from the PRD. Let me explain with a real construction scenario:

### **The Problem (Without Coordinates):**

A rebar contractor is on-site and takes 50 photos with their phone:
- `IMG_0234.jpg` - Some concrete work
- `IMG_0235.jpg` - Foundation corner
- `IMG_0236.jpg` - Rebar placement
- ... etc.

**Two weeks later:**
- Client asks: "Where exactly is that rebar issue?"
- Contractor: "Uh... somewhere in the foundation? Let me look through 200 photos..."
- **Result:** Wasted time, confusion, poor documentation

---

### **The Solution (With Coordinates):**

The app lets workers **link photos to specific locations on the plan sheets**.

### **User Flow on Mobile:**

#### **Step 1: On Site - Taking Photo**

1. Worker opens **Plan Sheet A-1** (Foundation Plan) on their phone
2. They zoom in to the **northwest corner** of the foundation
3. They **tap on that location** on the plan (x: 450, y: 720)
4. App opens camera and takes a photo
5. App saves: "Photo taken at coordinates (x: 450, y: 720) on Sheet A-1"

#### **Step 2: Back in Office - Reviewing**

1. Foreman opens **Plan Sheet A-1** on their tablet
2. Sees a **photo marker/pin 📷** at the northwest corner
3. Taps the marker → sees the photo taken at that location
4. Can see ALL photos taken at that specific location

---

### **Visual Example:**

```
┌──────────────────────────────────────────────────────┐
│  Foundation Plan (Sheet A-1)                         │
│                                                      │
│  ┌────────────────────────────────────┐             │
│  │                                    │             │
│  │   📷 (x:450, y:720)                │             │ ← Photo marker
│  │        Northwest Corner            │             │    (tap to view)
│  │        "Rebar spacing issue"       │             │
│  │                                    │             │
│  │                                    │             │
│  │                    📷 (x:1200,     │             │ ← Another photo
│  │                        y:400)      │             │    at different
│  │                    "Good concrete" │             │    location
│  │                                    │             │
│  └────────────────────────────────────┘             │
│                                                      │
└──────────────────────────────────────────────────────┘
```

When you tap the 📷 marker, you see the actual site photo taken at that location.

---

### **Database Schema with Coordinates:**

```typescript
// Example media record in database
{
  id: "media_abc123",
  projectId: "project_456",
  planId: "plan_789",           // Foundation Plan (Sheet A-1)
  filePath: "/orgs/123/projects/456/media/photos/media_abc123.jpg",
  mediaType: "photo",

  // THIS IS THE KEY PART:
  coordinates: JSON.stringify({  // Where on the plan?
    x: 450,                      // 450 pixels from left edge
    y: 720                       // 720 pixels from top edge
  }),

  description: "Rebar spacing issue at northwest corner",
  capturedBy: "user_xyz",
  createdAt: Date.now()
}
```

---

### **Why This Feature is Valuable:**

#### **Problem 1: "Where was this photo taken?"**
- ❌ **Traditional**: Worker uploads 100 photos with no context → chaos
- ✅ **Sitelink**: Photo is pinned to exact location on plan → instant context

#### **Problem 2: "Show me all issues in the foundation"**
- ❌ **Traditional**: Manually search through hundreds of photos
- ✅ **Sitelink**: View the foundation plan, see all photo markers at a glance

#### **Problem 3: "Document progress on east wall"**
- ❌ **Traditional**: Manually organize photos by location in folders
- ✅ **Sitelink**: Filter photos by plan location automatically

#### **Problem 4: "What's the status of grid line B?"**
- ❌ **Traditional**: Ask workers, hope they remember
- ✅ **Sitelink**: View plan, see photo markers along grid line B with timestamps

---

### **Technical Implementation:**

#### **Mobile App (React Native):**

```typescript
// When user taps on the plan to take a photo
function onPlanTap(event) {
  const { x, y } = event.nativeEvent

  // 1. Get tap coordinates
  const coordinates = {
    x: event.nativeEvent.locationX,
    y: event.nativeEvent.locationY
  }

  // 2. Open camera
  const photo = await capturePhoto()

  // 3. Upload with coordinates
  await uploadPhoto({
    projectId,
    planId,
    photoData: photo,
    coordinates  // ← Saved to database
  })
}

// When viewing the plan, show photo markers
function renderPhotoMarkers() {
  const photos = await getPhotosForPlan(planId)

  return photos.map(photo => {
    const coords = JSON.parse(photo.coordinates)
    return (
      <Marker
        x={coords.x}
        y={coords.y}
        onPress={() => viewPhoto(photo)}
        icon="📷"
      />
    )
  })
}
```

#### **Backend API:**

```typescript
// POST /projects/:projectId/media
POST /media
Body: {
  projectId: "project_123",
  planId: "plan_456",          // Optional: which plan sheet?
  coordinates: { x: 450, y: 720 },  // Optional: where on plan?
  description: "Rebar issue",
  photoData: <base64 or multipart>
}

// GET /plans/:planId/media - Get all photos for a plan
Response: [
  {
    id: "media_123",
    coordinates: { x: 450, y: 720 },
    thumbnailUrl: "https://cdn.../thumb.jpg",
    fullUrl: "https://cdn.../photo.jpg",
    capturedBy: "John Doe",
    capturedAt: "2025-01-15T10:30:00Z"
  }
]
```

---

### **Optional vs Required:**

From the PRD, coordinates are **optional** (a photo can be project-wide, not tied to a specific plan):

```typescript
// Use Case 1: Photo tied to specific location on plan
{
  planId: "plan_123",
  coordinates: { x: 450, y: 720 }  // ✅ Pinned to plan location
}

// Use Case 2: General project photo (no specific location)
{
  planId: null,
  coordinates: null  // ❌ Just in project gallery (not on a plan)
}

// Use Case 3: Photo tied to plan but not specific location
{
  planId: "plan_123",
  coordinates: null  // ✅ Related to this plan, but not pinned
}
```

---

### **Competitive Advantage:**

From PRD (page 12):
> **What Small Contractors Actually Need**
> - View high-resolution plans on mobile devices
> - Navigate between linked sheets quickly
> - **Capture photos/videos tied to specific plan locations** ← THIS!

This feature differentiates Sitelink from:
- **Generic photo storage apps** (Dropbox, Google Photos) - no spatial linking
- **Enterprise construction software** (Fieldwire, PlanGrid) - too complex and expensive

**It's essentially geo-tagging, but for plan sheets instead of GPS coordinates.**

---

## Part 3: Key Differences Summary

| Aspect | StorageService | Files Module | Media Module |
|--------|----------------|--------------|--------------|
| **Layer** | Core (infrastructure) | Feature (business) | Feature (business) |
| **Purpose** | Generic file operations | Manage construction plans | Manage site photos/videos |
| **Knows About** | Upload/download/delete | PDF files, processing, tiles | Photos, videos, thumbnails, locations |
| **Dependencies** | R2 Binding only | Storage + Database | Storage + Database |
| **Used By** | Files, Media, Plans | Nobody (end feature) | Nobody (end feature) |
| **Database Table** | None | `files` table | `medias` table |
| **Storage Path** | Doesn't care | `/orgs/.../plans/...` | `/orgs/.../media/...` |
| **Coordinates** | N/A | No | Yes (optional) |

---

## Part 4: Implementation Steps

### **Step 1: Create R2 Binding**
```typescript
// src/core/bindings.ts (ADD THIS)
import type { R2Bucket } from "@cloudflare/workers-types"
import { Context } from "effect"

export class R2Binding extends Context.Tag("R2Binding")<
  R2Binding,
  R2Bucket
>() {}
```

### **Step 2: Create Storage Service**
```typescript
// src/core/storage/index.ts (NEW FILE)
import { Effect, Schema } from "effect"
import { R2Binding } from "../bindings"

// Custom errors
export class StorageError extends Schema.TaggedError<StorageError>(
  "StorageError"
)("StorageError", {
  cause: Schema.Defect,
}) {}

export class FileNotFoundError extends Schema.TaggedError<FileNotFoundError>(
  "FileNotFoundError"
)("FileNotFoundError", {
  path: Schema.String,
}) {}

// ✅ Abstract service (no R2 in name!)
export class StorageService extends Effect.Service<StorageService>()(
  "StorageService",
  {
    dependencies: [R2Binding.Default],
    effect: Effect.gen(function* () {
      const r2 = yield* R2Binding

      const upload = Effect.fn("Storage.upload")(function* (
        path: string,
        data: Uint8Array | ArrayBuffer,
        contentType: string
      ) {
        return yield* Effect.tryPromise({
          try: () => r2.put(path, data, {
            httpMetadata: { contentType }
          }),
          catch: (cause) => new StorageError({ cause })
        })
      })

      const download = Effect.fn("Storage.download")(function* (
        path: string
      ) {
        const object = yield* Effect.tryPromise({
          try: () => r2.get(path),
          catch: (cause) => new StorageError({ cause })
        })

        if (!object) {
          return yield* new FileNotFoundError({ path })
        }

        return yield* Effect.promise(() => object.arrayBuffer())
      })

      const deleteFile = Effect.fn("Storage.delete")(function* (
        path: string
      ) {
        return yield* Effect.tryPromise({
          try: () => r2.delete(path),
          catch: (cause) => new StorageError({ cause })
        })
      })

      const getUrl = (path: string) =>
        Effect.succeed(`https://your-cdn.com/${path}`)

      return {
        upload,
        download,
        deleteFile,
        getUrl
      } as const
    })
  }
) {}
```

### **Step 3: Add R2 Binding to Wrangler Config**
```toml
# wrangler.toml
[[r2_buckets]]
binding = "SITELINK_BUCKET"
bucket_name = "sitelink-dev"
preview_bucket_name = "sitelink-preview"
```

### **Step 4: Update Worker Entry Point**
```typescript
// src/index.ts
import { R2Binding } from "./core/bindings"

export default {
  async fetch(request, env, _ctx): Promise<Response> {
    // ... existing code ...

    // Create R2 Binding Layer
    const R2Layer = Layer.succeed(R2Binding, env.SITELINK_BUCKET)

    // Assemble App Layer
    const AppLayer = CoreLayer.pipe(
      Layer.provide(ConfigLayer),
      Layer.provide(D1Layer),
      Layer.provide(ResendLayer),
      Layer.provide(R2Layer),  // ← ADD THIS
    )

    // ... rest of code ...
  }
}
```

### **Step 5: Add to Core Layer**
```typescript
// src/core/index.ts
import { Layer } from "effect"
import { AuthService } from "./auth"
import { Drizzle } from "./database"
import { EmailService } from "./email"
import { OrganizationService } from "./organization/service"
import { StorageService } from "./storage"  // ← ADD THIS

export const CoreLayer = EmailService.Default.pipe(
  Layer.merge(Drizzle.Default),
  Layer.merge(AuthService.Default),
  Layer.provideMerge(OrganizationService.Default),
  Layer.merge(StorageService.Default),  // ← ADD THIS
)
```

### **Step 6: Use in Feature Modules**
```typescript
// src/features/files/service.ts
export class FileService extends Effect.Service<FileService>()(
  "FileService",
  {
    dependencies: [Drizzle.Default, StorageService.Default],  // ← Declare dependency
    effect: Effect.gen(function* () {
      const db = yield* Drizzle
      const storage = yield* StorageService  // ← Use it!

      // ... business logic using storage.upload(), storage.download(), etc.
    })
  }
) {}
```

---

## Part 5: Mental Model

```
┌─────────────────────────────────────────────┐
│         Application Layer (API)             │
│   "Upload this PDF to project 123"          │
│   "Take a photo at plan location (x,y)"     │
└──────────────────┬──────────────────────────┘
                   │
       ┌───────────┼───────────────┐
       │           │               │
       ▼           ▼               ▼
  ┌────────┐  ┌────────┐  ┌──────────┐
  │ Files  │  │ Media  │  │  Plans   │  ← Feature Modules
  │ Module │  │ Module │  │  Module  │     (Business Logic)
  └───┬────┘  └───┬────┘  └────┬─────┘
      │           │             │
      └───────────┼─────────────┘
                  ▼
       ┌──────────────────────┐
       │   StorageService     │  ← Core Service
       │  (Generic toolbox)   │     (Infrastructure)
       │  - upload()          │
       │  - download()        │
       │  - delete()          │
       │  - getUrl()          │
       └──────────┬───────────┘
                  ▼
       ┌──────────────────────┐
       │     R2 Bucket        │  ← Cloudflare Binding
       │  (Actual storage)    │     (External Service)
       └──────────────────────┘
```

---

## Part 6: Testing Strategy

### **Unit Tests for StorageService:**
```typescript
// test/unit/storage.test.ts
import { describe, expect, it } from "vitest"
import { Effect, Layer } from "effect"
import { StorageService } from "../../src/core/storage"
import { R2Binding } from "../../src/core/bindings"

describe("StorageService", () => {
  // Mock R2 for testing
  const MockR2 = Layer.succeed(R2Binding, {
    put: vi.fn(),
    get: vi.fn(),
    delete: vi.fn(),
  })

  const TestLayer = StorageService.Default.pipe(Layer.provide(MockR2))

  it("should upload file successfully", async () => {
    const program = Effect.gen(function* () {
      const storage = yield* StorageService
      const data = new TextEncoder().encode("test content")
      yield* storage.upload("/test/path.txt", data, "text/plain")
    })

    await Effect.runPromise(program.pipe(Effect.provide(TestLayer)))
  })
})
```

### **Integration Tests for Media Coordinates:**
```typescript
// test/integration/media.test.ts
describe("Media with Coordinates", () => {
  it("should save photo with plan coordinates", async () => {
    const response = await SELF.fetch("https://example.com/media", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${sessionToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        projectId: "project_123",
        planId: "plan_456",
        coordinates: { x: 450, y: 720 },
        description: "Foundation issue",
        photoData: "base64..."
      })
    })

    expect(response.status).toBe(201)
    const media = await response.json()
    expect(media.coordinates).toEqual({ x: 450, y: 720 })
  })
})
```

---

## Part 7: Common Pitfalls to Avoid

### ❌ **Don't: Mix abstraction with implementation**
```typescript
// BAD: Feature module depends on R2 directly
export class FileService extends Effect.Service<FileService>()(
  "FileService",
  {
    dependencies: [R2Binding.Default],  // ❌ Too low-level!
    effect: Effect.gen(function* () {
      const r2 = yield* R2Binding
      yield* r2.put(...)  // ❌ Tight coupling to R2
    })
  }
) {}
```

### ✅ **Do: Depend on abstraction**
```typescript
// GOOD: Feature module depends on generic interface
export class FileService extends Effect.Service<FileService>()(
  "FileService",
  {
    dependencies: [StorageService.Default],  // ✅ Abstract!
    effect: Effect.gen(function* () {
      const storage = yield* StorageService
      yield* storage.upload(...)  // ✅ Can swap implementation
    })
  }
) {}
```

---

### ❌ **Don't: Store business logic in StorageService**
```typescript
// BAD: StorageService knows about plans
const uploadPlanPDF = Effect.fn("Storage.uploadPlanPDF")(...)  // ❌ Too specific!
```

### ✅ **Do: Keep StorageService generic**
```typescript
// GOOD: StorageService only knows about files
const upload = Effect.fn("Storage.upload")(...)  // ✅ Generic operation
```

---

### ❌ **Don't: Forget coordinates are optional**
```typescript
// BAD: Requires coordinates for all media
coordinates: { x: number, y: number }  // ❌ Required
```

### ✅ **Do: Make coordinates optional**
```typescript
// GOOD: Coordinates optional (project-wide photos don't need them)
coordinates?: { x: number, y: number } | null  // ✅ Optional
```

---

## Part 8: Future Extensions

### **Possible Future Features:**

1. **Drawing Tools on Plans**
   - Add shapes (circles, arrows, rectangles) with coordinates
   - Store in `annotations` table with coordinates

2. **AR Overlay**
   - Use coordinates to overlay plan elements in augmented reality
   - Show "what should be built" at specific plan locations

3. **Progress Tracking**
   - Track completion status by plan location
   - "Grid line A is 80% complete" based on photo coordinates

4. **Heat Maps**
   - Show which plan areas have most activity/issues
   - Based on density of media coordinates

---

## Summary

1. **StorageService** (abstract) not R2StorageService (implementation) ✅
2. **Files Module** manages construction plan PDFs
3. **Media Module** manages site photos/videos with optional plan coordinates
4. **Coordinates** link photos to specific plan locations (key differentiator)
5. All three are separate; Files and Media use StorageService

**Key Insight:** It's like geo-tagging, but for construction plans instead of GPS maps.
