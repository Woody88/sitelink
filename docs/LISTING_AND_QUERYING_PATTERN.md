# Listing and Querying Pattern: D1 Database vs R2 Storage

**Critical Architectural Concept**
**Last Updated:** January 2025

---

## TL;DR - The Golden Rule

> **NEVER list/query from R2 directly. ALWAYS query D1 database for metadata, then fetch files from R2 when needed.**

```
User wants to list photos
    ↓
Query D1 Database (get metadata + file paths)
    ↓
Return metadata to user
    ↓
(Optional) User clicks to view specific photo
    ↓
Fetch actual file from R2 using stored path
```

---

## Part 1: Understanding the Two Systems

### **R2 = Dumb File Storage** (like a filing cabinet)

**What R2 CAN do:**
- Store large files cheaply (PDFs, images, videos)
- Retrieve files by exact path: `GET /orgs/123/projects/456/file.jpg`
- List files by **prefix only**: "Show me all files starting with `/orgs/123/`"

**What R2 CANNOT do:**
- ❌ Query by date, type, user, coordinates, description
- ❌ Filter beyond simple prefix matching
- ❌ Sort results
- ❌ Join with other data
- ❌ Aggregate or count
- ❌ Search by metadata

**R2 List Capabilities (Limited):**
```typescript
// R2 can ONLY list by prefix
r2.list({
  prefix: "/orgs/123/projects/456/media/photos/"  // ✅ Only this
})

// R2 CANNOT do:
r2.list({
  where: { capturedBy: "user_123" }  // ❌ Not possible
  filter: { mediaType: "photo" }     // ❌ Not possible
  orderBy: "createdAt DESC"          // ❌ Not possible
})
```

---

### **D1 = Smart Database** (like an organized index)

**What D1 CAN do:**
- Store **metadata** about files (paths, names, dates, relationships)
- Query, filter, sort, join, aggregate
- Complex searches with multiple conditions
- Fast indexed lookups

**What D1 SHOULD NOT do:**
- Store large file data (expensive, not designed for it)

**D1 Query Capabilities (Full SQL):**
```typescript
// D1 can do complex queries
db
  .select()
  .from(schema.medias)
  .where(
    and(
      eq(schema.medias.projectId, projectId),
      eq(schema.medias.mediaType, "photo"),
      gte(schema.medias.createdAt, lastWeek),
      isNotNull(schema.medias.coordinates)
    )
  )
  .orderBy(desc(schema.medias.createdAt))
  .limit(50)
```

---

## Part 2: The Two-Tier Architecture

| Aspect | D1 Database | R2 Storage |
|--------|-------------|------------|
| **Stores** | Metadata (paths, names, dates, etc.) | File bytes (PDFs, images, videos) |
| **Size limit** | Small records (KB) | Large files (GB) |
| **Cost** | $$$  (per row) | $ (per GB, very cheap) |
| **Query by** | Any field, complex conditions | Prefix only |
| **Sort/filter** | ✅ Yes, very fast | ❌ No |
| **Relationships** | ✅ Foreign keys, joins | ❌ None |
| **Use for** | Listing, searching, filtering | Storing, retrieving files |

---

## Part 3: Database Schema (The Queryable Metadata)

### **Plans Table**
```typescript
// src/core/database/schemas/index.ts

export const plans = sqliteTable("plans", {
  id: text().primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  name: text().notNull(),
  description: text(),
  directoryPath: text("directory_path"),  // ← R2 folder path
  processingStatus: text("processing_status"),  // pending, processing, complete, failed
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .$defaultFn(() => new Date())
    .notNull(),
})

// Example record:
{
  id: "plan_123",
  projectId: "project_456",
  name: "Foundation Plan A-1",
  description: "Ground floor foundation",
  directoryPath: "/orgs/123/projects/456/plans/plan_123/",  // ← Points to R2
  processingStatus: "complete",
  createdAt: 1705315200000
}
```

### **Medias Table**
```typescript
export const medias = sqliteTable("medias", {
  id: text().primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  planId: text("plan_id")
    .references(() => plans.id, { onDelete: "set null" }),
  filePath: text("file_path").notNull(),  // ← R2 file path
  mediaType: text("media_type"),  // photo, video
  coordinates: text("coordinates"),  // JSON: {"x": 450, "y": 720}
  description: text("description"),
  capturedBy: text("captured_by")
    .notNull()
    .references(() => users.id),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .$defaultFn(() => new Date())
    .notNull(),
})

// Example record:
{
  id: "media_abc123",
  projectId: "project_456",
  planId: "plan_123",
  filePath: "/orgs/123/projects/456/media/photos/media_abc123.jpg",  // ← Points to R2
  mediaType: "photo",
  coordinates: '{"x":450,"y":720}',
  description: "Foundation issue at northwest corner",
  capturedBy: "user_xyz",
  createdAt: 1705315200000
}
```

### **Files Table**
```typescript
export const files = sqliteTable("files", {
  id: text().primaryKey(),
  planId: text("plan_id")
    .notNull()
    .references(() => plans.id, { onDelete: "cascade" }),
  filePath: text("file_path"),  // ← R2 file path
  fileType: text("file_type"),  // pdf, dwg, etc.
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .$defaultFn(() => new Date())
    .notNull(),
})

// Example record:
{
  id: "file_xyz789",
  planId: "plan_123",
  filePath: "/orgs/123/projects/456/plans/plan_123/original.pdf",  // ← Points to R2
  fileType: "pdf",
  createdAt: 1705315200000
}
```

---

## Part 4: R2 Storage Structure (Just File Bytes)

```
R2 Bucket: "sitelink-storage"
│
└── /orgs/
    └── /123/
        └── /projects/
            └── /456/
                ├── /plans/
                │   └── /plan_123/
                │       ├── original.pdf              ← Files table points here
                │       ├── thumbnail.jpg
                │       └── /tiles/
                │           ├── /0/
                │           │   └── 0_0.jpg
                │           ├── /1/
                │           │   ├── 0_0.jpg
                │           │   ├── 1_0.jpg
                │           │   ├── 0_1.jpg
                │           │   └── 1_1.jpg
                │           └── /2/
                │               └── ...
                │
                └── /media/
                    ├── /photos/
                    │   ├── media_abc123.jpg         ← Medias table points here
                    │   ├── media_abc123_thumb.jpg
                    │   ├── media_def456.jpg
                    │   └── media_def456_thumb.jpg
                    │
                    └── /videos/
                        ├── media_xyz789.mp4         ← Medias table points here
                        ├── media_xyz789_thumb.jpg
                        └── ...
```

**Key Point:** R2 is just a blob store. No metadata, no relationships, no queries.

---

## Part 5: Concrete Implementation Examples

### **Example 1: List All Photos for a Project**

❌ **WRONG - Don't do this:**
```typescript
// Trying to list from R2 directly
const files = await r2.list({
  prefix: `/orgs/123/projects/456/media/photos/`
})

// Problems:
// 1. No metadata (who took it? when? where on plan?)
// 2. No filtering (can't filter by date, user, plan)
// 3. No sorting (random order)
// 4. Returns ALL files (no pagination control)
```

✅ **CORRECT - Query D1 first:**
```typescript
// src/features/media/service.ts

const listProjectPhotos = Effect.fn("MediaService.listProjectPhotos")(
  function* (params: {
    projectId: string
    planId?: string
    limit?: number
    offset?: number
  }) {
    const db = yield* Drizzle

    // 1. Query D1 database for metadata
    const photos = yield* db
      .select({
        id: schema.medias.id,
        filePath: schema.medias.filePath,       // Path in R2
        mediaType: schema.medias.mediaType,
        planId: schema.medias.planId,
        coordinates: schema.medias.coordinates,
        description: schema.medias.description,
        capturedBy: schema.medias.capturedBy,
        capturedAt: schema.medias.createdAt,
      })
      .from(schema.medias)
      .where(
        and(
          eq(schema.medias.projectId, params.projectId),
          eq(schema.medias.mediaType, "photo"),
          params.planId
            ? eq(schema.medias.planId, params.planId)
            : undefined
        )
      )
      .orderBy(desc(schema.medias.createdAt))  // ← Sort in database!
      .limit(params.limit ?? 50)
      .offset(params.offset ?? 0)

    // 2. Generate URLs for accessing files in R2
    return photos.map(photo => ({
      ...photo,
      coordinates: photo.coordinates
        ? JSON.parse(photo.coordinates)
        : null,
      // User will fetch actual file from R2 via these endpoints
      thumbnailUrl: `/api/media/${photo.id}/thumbnail`,
      fullUrl: `/api/media/${photo.id}/download`,
    }))
  }
)
```

---

### **Example 2: List Plans for a Project**

```typescript
// src/features/plans/service.ts

const listProjectPlans = Effect.fn("PlanService.listProjectPlans")(
  function* (projectId: string) {
    const db = yield* Drizzle

    // Query D1 database (NOT R2!)
    const plans = yield* db
      .select({
        id: schema.plans.id,
        name: schema.plans.name,
        description: schema.plans.description,
        directoryPath: schema.plans.directoryPath,  // R2 folder
        processingStatus: schema.plans.processingStatus,
        createdAt: schema.plans.createdAt,
      })
      .from(schema.plans)
      .where(eq(schema.plans.projectId, projectId))
      .orderBy(schema.plans.name)

    return plans.map(plan => ({
      ...plan,
      // Tiles are served from R2 via this endpoint
      tilesUrl: `/api/plans/${plan.id}/tiles/{z}/{x}/{y}.jpg`,
      thumbnailUrl: `/api/plans/${plan.id}/thumbnail`,
    }))
  }
)
```

---

### **Example 3: Get Photos at Specific Plan Location**

```typescript
// src/features/media/service.ts

const getPhotosAtLocation = Effect.fn("MediaService.getPhotosAtLocation")(
  function* (params: {
    planId: string
    x: number
    y: number
    radius: number  // pixels
  }) {
    const db = yield* Drizzle

    // 1. Query D1 for photos on this plan
    const photos = yield* db
      .select()
      .from(schema.medias)
      .where(
        and(
          eq(schema.medias.planId, params.planId),
          isNotNull(schema.medias.coordinates)
        )
      )

    // 2. Filter by distance in JavaScript
    // (SQLite doesn't have good spatial query support)
    const nearby = photos.filter(photo => {
      const coords = JSON.parse(photo.coordinates!)
      const distance = Math.sqrt(
        Math.pow(coords.x - params.x, 2) +
        Math.pow(coords.y - params.y, 2)
      )
      return distance <= params.radius
    })

    return nearby.map(photo => ({
      ...photo,
      coordinates: JSON.parse(photo.coordinates!),
      url: `/api/media/${photo.id}/download`,
    }))
  }
)
```

---

### **Example 4: Search Media by Description**

```typescript
// src/features/media/service.ts

const searchMedia = Effect.fn("MediaService.search")(function* (params: {
  projectId: string
  query: string
}) {
  const db = yield* Drizzle

  // Full-text search in D1 (not possible in R2!)
  const results = yield* db
    .select()
    .from(schema.medias)
    .where(
      and(
        eq(schema.medias.projectId, params.projectId),
        like(schema.medias.description, `%${params.query}%`)
      )
    )
    .orderBy(desc(schema.medias.createdAt))

  return results.map(media => ({
    ...media,
    url: `/api/media/${media.id}/download`,
  }))
})
```

---

## Part 6: HTTP API Endpoints (User-Facing)

### **GET /projects/:projectId/media**

**Returns:** Metadata list from D1

```typescript
// src/features/media/http.ts

HttpApiEndpoint.get("listProjectMedia")`/projects/${projectIdParam}/media`
  .addSuccess(Schema.Array(MediaMetadata))

// Response:
{
  "media": [
    {
      "id": "media_123",
      "description": "Foundation issue",
      "coordinates": { "x": 450, "y": 720 },
      "capturedAt": "2025-01-15T10:30:00Z",
      "capturedBy": "John Doe",
      "thumbnailUrl": "/api/media/media_123/thumbnail",  // ← Fetch from R2
      "fullUrl": "/api/media/media_123/download"         // ← Fetch from R2
    },
    // ... more media
  ]
}
```

---

### **GET /api/media/:mediaId/download**

**Returns:** Actual file from R2

```typescript
// src/features/media/http.ts

HttpApiEndpoint.get("downloadMedia")`/media/${mediaIdParam}/download`

// Implementation:
const download = Effect.fn("downloadMedia")(function* (mediaId: string) {
  const db = yield* Drizzle
  const storage = yield* StorageService

  // 1. Get file path from D1
  const [media] = yield* db
    .select({ filePath: schema.medias.filePath })
    .from(schema.medias)
    .where(eq(schema.medias.id, mediaId))

  if (!media) {
    return yield* Effect.fail(new MediaNotFoundError({ mediaId }))
  }

  // 2. Fetch actual file from R2
  const fileData = yield* storage.download(media.filePath)

  // 3. Return file
  return new Response(fileData, {
    headers: { "Content-Type": "image/jpeg" }
  })
})
```

---

### **GET /projects/:projectId/plans**

**Returns:** Plan metadata from D1

```typescript
// Response:
{
  "plans": [
    {
      "id": "plan_123",
      "name": "Foundation Plan A-1",
      "processingStatus": "complete",
      "createdAt": "2025-01-15T10:30:00Z",
      "thumbnailUrl": "/api/plans/plan_123/thumbnail",   // ← Fetch from R2
      "tilesUrl": "/api/plans/plan_123/tiles/{z}/{x}/{y}.jpg"  // ← DZI tiles
    }
  ]
}
```

---

### **GET /api/plans/:planId/tiles/:z/:x/:y.jpg**

**Returns:** Tile image from R2

```typescript
const getTile = Effect.fn("getTile")(function* (params: {
  planId: string
  z: number
  x: number
  y: number
}) {
  const db = yield* Drizzle
  const storage = yield* StorageService

  // 1. Get plan directory from D1
  const [plan] = yield* db
    .select({ directoryPath: schema.plans.directoryPath })
    .from(schema.plans)
    .where(eq(schema.plans.id, params.planId))

  // 2. Build R2 path
  const tilePath = `${plan.directoryPath}/tiles/${params.z}/${params.x}_${params.y}.jpg`

  // 3. Fetch from R2
  const tileData = yield* storage.download(tilePath)

  return new Response(tileData, {
    headers: { "Content-Type": "image/jpeg" }
  })
})
```

---

## Part 7: Complete Upload → List Workflow

### **Upload Photo Workflow:**

```typescript
// 1. Client uploads photo
POST /projects/123/media
Body: {
  photoData: <binary>,
  planId: "plan_456",
  coordinates: { x: 450, y: 720 },
  description: "Foundation issue"
}

// 2. Backend processes:
const uploadPhoto = Effect.fn("uploadPhoto")(function* (params) {
  const db = yield* Drizzle
  const storage = yield* StorageService

  const mediaId = generateId()

  // 2a. Upload to R2
  const photoPath = `/orgs/123/projects/123/media/photos/${mediaId}.jpg`
  yield* storage.upload(photoPath, params.photoData, "image/jpeg")

  // 2b. Generate and upload thumbnail
  const thumbnail = yield* generateThumbnail(params.photoData)
  const thumbPath = `/orgs/123/projects/123/media/photos/${mediaId}_thumb.jpg`
  yield* storage.upload(thumbPath, thumbnail, "image/jpeg")

  // 2c. Insert metadata into D1
  const [media] = yield* db
    .insert(schema.medias)
    .values({
      id: mediaId,
      projectId: params.projectId,
      planId: params.planId,
      filePath: photoPath,
      mediaType: "photo",
      coordinates: JSON.stringify(params.coordinates),
      description: params.description,
      capturedBy: params.userId,
      createdAt: new Date(),
    })
    .returning()

  // 2d. Return metadata
  return {
    id: media.id,
    thumbnailUrl: `/api/media/${mediaId}/thumbnail`,
    fullUrl: `/api/media/${mediaId}/download`,
  }
})
```

### **List Photos Workflow:**

```typescript
// 1. Client requests list
GET /projects/123/media?planId=plan_456

// 2. Backend queries D1 (NOT R2!)
const photos = yield* db
  .select()
  .from(schema.medias)
  .where(
    and(
      eq(schema.medias.projectId, "123"),
      eq(schema.medias.planId, "plan_456")
    )
  )
  .orderBy(desc(schema.medias.createdAt))

// 3. Return metadata with URLs
return photos.map(photo => ({
  ...photo,
  coordinates: JSON.parse(photo.coordinates),
  thumbnailUrl: `/api/media/${photo.id}/thumbnail`,
  fullUrl: `/api/media/${photo.id}/download`,
}))

// 4. Client renders thumbnails
// User clicks one → GET /api/media/media_123/download → Fetch from R2
```

---

## Part 8: Why This Architecture?

### **Cost Efficiency:**

| Operation | D1 Only (Bad) | R2 Only (Bad) | D1 + R2 (Good) |
|-----------|---------------|---------------|----------------|
| Store 1GB PDF | $$$$ | $ | $ (in R2) |
| Store metadata | Included | Can't do it | Included |
| List 1000 files | Fast | Slow | Fast (D1) |
| Filter by date | ✅ | ❌ | ✅ (D1) |
| Total cost | Very high | Limited features | Optimal |

### **Performance:**

| Task | D1 Query | R2 List | Winner |
|------|----------|---------|--------|
| "Show photos from last week" | Instant | Can't do it | D1 |
| "Show photos by user X" | Instant | Can't do it | D1 |
| "Sort by date" | Instant | Random order | D1 |
| "Search descriptions" | Instant | Can't do it | D1 |
| "Fetch 1GB file" | Too slow/expensive | Fast & cheap | R2 |

### **Feature Set:**

| Feature | Possible with D1+R2? | Possible with R2 only? |
|---------|---------------------|----------------------|
| List files | ✅ | ✅ (prefix only) |
| Filter by date | ✅ | ❌ |
| Filter by user | ✅ | ❌ |
| Search by description | ✅ | ❌ |
| Sort results | ✅ | ❌ |
| Pagination | ✅ | Limited |
| Complex queries | ✅ | ❌ |
| Spatial queries (coordinates) | ✅ | ❌ |

---

## Part 9: Common Mistakes to Avoid

### ❌ **Mistake 1: Trying to list/query from R2**
```typescript
// DON'T DO THIS
const photos = await r2.list({ prefix: `/orgs/123/` })
// Can't filter, sort, or get metadata!
```

### ✅ **Correct:**
```typescript
// Query D1 for metadata
const photos = await db.select().from(schema.medias).where(...)
```

---

### ❌ **Mistake 2: Storing file data in D1**
```typescript
// DON'T DO THIS
await db.insert(schema.files).values({
  id: "file_123",
  fileData: largeBuffer  // ❌ Don't store file bytes in database!
})
```

### ✅ **Correct:**
```typescript
// Store file in R2, reference in D1
await storage.upload(filePath, largeBuffer)
await db.insert(schema.files).values({
  id: "file_123",
  filePath: filePath  // ✅ Store path only
})
```

---

### ❌ **Mistake 3: Not storing file paths in D1**
```typescript
// DON'T DO THIS
await storage.upload(`/random/path/${Date.now()}.jpg`, data)
// How will you find it later???
```

### ✅ **Correct:**
```typescript
// Always store the path in D1
const filePath = `/orgs/123/media/${mediaId}.jpg`
await storage.upload(filePath, data)
await db.insert(schema.medias).values({
  id: mediaId,
  filePath: filePath  // ✅ Store for later retrieval
})
```

---

### ❌ **Mistake 4: Returning R2 objects directly**
```typescript
// DON'T DO THIS
const files = await r2.list({ prefix: "/orgs/123/" })
return files.objects  // ❌ No metadata, no context
```

### ✅ **Correct:**
```typescript
// Return rich metadata from D1
const media = await db.select().from(schema.medias).where(...)
return media.map(m => ({
  ...m,
  url: `/api/media/${m.id}/download`  // User fetches from R2 later
}))
```

---

## Part 10: Testing Strategy

### **Unit Test - Service Layer:**
```typescript
// test/unit/media-service.test.ts

describe("MediaService.listProjectPhotos", () => {
  it("should query D1 and return metadata", async () => {
    // Mock D1
    const mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            {
              id: "media_123",
              filePath: "/orgs/123/photos/media_123.jpg",
              coordinates: '{"x":450,"y":720}',
            }
          ])
        })
      })
    }

    // Test
    const result = await MediaService.listProjectPhotos("project_123")

    // Verify it queried D1, not R2
    expect(mockDb.select).toHaveBeenCalled()
    expect(result).toHaveLength(1)
    expect(result[0].coordinates).toEqual({ x: 450, y: 720 })
  })
})
```

### **Integration Test - End-to-End:**
```typescript
// test/integration/media.test.ts

describe("Media Listing", () => {
  it("should upload photo and list it", async () => {
    // 1. Upload
    const uploadResponse = await fetch("/projects/123/media", {
      method: "POST",
      body: photoData
    })
    const { id } = await uploadResponse.json()

    // 2. List - should query D1
    const listResponse = await fetch("/projects/123/media")
    const { media } = await listResponse.json()

    // 3. Verify metadata returned (not raw R2 objects)
    expect(media).toContainEqual(
      expect.objectContaining({
        id,
        thumbnailUrl: expect.stringContaining("/thumbnail"),
        fullUrl: expect.stringContaining("/download")
      })
    )
  })
})
```

---

## Summary

### **The Pattern:**

1. **Upload:**
   - Store file → R2
   - Store metadata (including path) → D1

2. **List:**
   - Query D1 for metadata
   - Return paths/URLs to access files in R2

3. **Download:**
   - Lookup path in D1
   - Fetch file from R2 using path

### **Key Rules:**

✅ **DO:**
- Store file bytes in R2
- Store file metadata (paths, names, relationships) in D1
- Query/list from D1
- Fetch individual files from R2 when user requests them

❌ **DON'T:**
- Store file bytes in D1
- Try to query/filter/sort R2 objects
- List from R2 for user-facing features
- Forget to store R2 paths in D1

### **Mental Model:**

```
D1 = Library Card Catalog (searchable index)
R2 = Library Shelves (storage)

When you want a book:
1. Search the card catalog (D1) for metadata
2. Note the shelf location (file path)
3. Walk to that shelf (R2) and grab the book (file)
```

**You always start with D1, then go to R2 when needed.**
