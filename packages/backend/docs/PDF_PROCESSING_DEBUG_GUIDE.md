# PDF Processing Pipeline - Debug Guide

## Quick Diagnosis

### Problem: Sheets stuck at status="pending"

**Symptom:**
```sql
SELECT sheet_number, status, tile_count FROM plan_sheets WHERE upload_id = '...'
-- All showing status = 'pending', tile_count = NULL
```

**Root Cause:** Tile generation consumer not updating database after processing

**Check:**
1. Look for tile generation logs: `✅ Successfully generated <N> tiles`
2. Look for database update logs: `💾 Updating plan_sheets table`
3. Check if tiles exist in R2: `organizations/<org>/projects/<proj>/plans/<plan>/sheets/sheet-<N>/`

**Fix:** Verify tile generation consumer has database update code (implemented in this PR)

---

### Problem: No markers detected

**Symptom:**
```sql
SELECT COUNT(*) FROM plan_markers WHERE upload_id = '...'
-- Returns 0
```

**Root Cause:** Marker detection queue never triggered

**Check:**
1. Verify all tiles complete: `SELECT COUNT(*) FROM plan_sheets WHERE upload_id = '...' AND status = 'complete'`
2. Check PlanCoordinator state: `GET /coordinator/<upload_id>/progress`
3. Look for marker detection logs: `[PlanCoordinator] All tiles complete! Auto-triggering marker detection`

**Fix:** Ensure PlanCoordinator.tileComplete() is being called (implemented in this PR)

---

### Problem: Processing job stuck at "processing"

**Symptom:**
```sql
SELECT status, completed_at FROM processing_jobs WHERE upload_id = '...'
-- status = 'processing', completed_at = NULL
```

**Root Cause:** No final status update after marker detection

**Check:**
1. Verify marker detection completed
2. Check PlanCoordinator logs: `Processing job marked as complete`
3. Check coordinator status: Should be "complete"

**Fix:** Ensure tileComplete() updates processing_jobs table (implemented in this PR)

---

## Debugging Checklist

### 1. Check Database State

```sql
-- Overview
SELECT
  pj.status as job_status,
  pj.total_pages,
  pj.completed_pages,
  COUNT(DISTINCT ps.id) as sheets_created,
  SUM(CASE WHEN ps.metadata_status = 'extracted' THEN 1 ELSE 0 END) as metadata_complete,
  SUM(CASE WHEN ps.status = 'complete' THEN 1 ELSE 0 END) as tiles_complete,
  COUNT(DISTINCT pm.id) as markers_detected
FROM processing_jobs pj
LEFT JOIN plan_sheets ps ON ps.upload_id = pj.upload_id
LEFT JOIN plan_markers pm ON pm.upload_id = pj.upload_id
WHERE pj.upload_id = '<upload_id>'
GROUP BY pj.id
```

Expected at each stage:
- **After PDF split**: sheets_created = total_pages, all others = 0
- **After metadata**: metadata_complete = total_pages
- **After tiles**: tiles_complete = total_pages
- **After markers**: markers_detected > 0, job_status = 'complete'

### 2. Check R2 Storage

```bash
# List sheets
wrangler r2 object list SitelinkStorage --prefix "organizations/<org>/projects/<proj>/plans/<plan>/uploads/<upload>/sheet-"

# List tiles for a specific sheet
wrangler r2 object list SitelinkStorage --prefix "organizations/<org>/projects/<proj>/plans/<plan>/sheets/sheet-1/"
```

Expected structure:
```
uploads/<upload>/
  sheet-1.pdf
  sheet-2.pdf
  ...
sheets/
  sheet-1/
    tiles_files/
      0/
        0_0.jpg
        0_1.jpg
        ...
      1/
        ...
    tiles.dzi
  sheet-2/
    ...
```

### 3. Check Queue Messages

```bash
# Check tile generation queue
wrangler queues consumer list TILE_GENERATION_QUEUE

# Check marker detection queue
wrangler queues consumer list MARKER_DETECTION_QUEUE
```

Look for:
- Consumer lag (messages waiting to be processed)
- Error rates
- Processing times

### 4. Check Durable Object State

```bash
# Get PlanCoordinator state
curl "http://localhost:8787/coordinator/<upload_id>/progress"
```

Expected response at each stage:

**During metadata extraction:**
```json
{
  "uploadId": "...",
  "completedSheets": [1, 2, 3],
  "completedTiles": [],
  "totalSheets": 10,
  "status": "in_progress",
  "progress": 30
}
```

**During tile generation:**
```json
{
  "uploadId": "...",
  "completedSheets": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  "completedTiles": [1, 2, 3],
  "totalSheets": 10,
  "status": "tiles_in_progress",
  "progress": 100
}
```

**After completion:**
```json
{
  "uploadId": "...",
  "completedSheets": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  "completedTiles": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  "totalSheets": 10,
  "status": "complete",
  "progress": 100
}
```

---

## Common Issues

### Issue: TypeScript errors in queue consumer

**Error:**
```
Property 'sheetId' does not exist on type 'TileJob'
```

**Fix:** Ensure `TileJob` interface includes `sheetId` field:
```typescript
export interface TileJob {
  uploadId: string
  sheetId: string  // Add this
  projectId: string
  planId: string
  organizationId: string
  sheetNumber: number
  sheetKey: string
  totalSheets: number
}
```

### Issue: Coordinator not found

**Error:**
```
PlanCoordinator not initialized
```

**Cause:** Coordinator was never initialized OR the upload ID doesn't match

**Fix:**
1. Check that `pdfProcessingQueueConsumer` initializes coordinator
2. Verify the upload ID is consistent across all steps
3. Check Durable Object bindings in `wrangler.jsonc`

### Issue: Tiles generated but database not updated

**Symptoms:**
- Tiles exist in R2
- Logs show "Successfully generated tiles"
- No database update logs

**Cause:** Missing database update code OR database transaction failed

**Fix:**
1. Verify `processJob()` has database update code after tile upload
2. Check for database errors in logs
3. Ensure `drizzle` import and `planSheets` schema are correct

### Issue: Marker detection receives no tiles

**Error in marker detection consumer:**
```
⚠️ No tiles found for plan <plan_id>
```

**Cause:** Tile generation didn't complete OR R2 prefix is wrong

**Fix:**
1. Verify tiles exist in R2 at: `organizations/<org>/projects/<proj>/plans/<plan>/sheets/`
2. Check that `status = 'complete'` in `plan_sheets` table
3. Verify PlanCoordinator state shows all tiles complete

---

## Manual Recovery

### Scenario: Processing stuck mid-way

**Steps:**

1. **Identify the stuck stage:**
   ```sql
   SELECT
     ps.sheet_number,
     ps.metadata_status,
     ps.status as tile_status,
     ps.tile_count
   FROM plan_sheets ps
   WHERE ps.upload_id = '<upload_id>'
   ORDER BY ps.sheet_number
   ```

2. **Re-enqueue missing jobs:**

   **If stuck at metadata extraction:**
   ```typescript
   // Call metadata extraction endpoint for missing sheets
   await env.METADATA_EXTRACTION_QUEUE.send({
     uploadId: '<upload_id>',
     planId: '<plan_id>',
     sheetId: '<sheet_id>',
     sheetNumber: <N>,
     sheetKey: '<sheet_key>',
     totalSheets: <total>
   })
   ```

   **If stuck at tile generation:**
   ```typescript
   // Call tile generation endpoint for missing sheets
   await env.TILE_GENERATION_QUEUE.send({
     uploadId: '<upload_id>',
     sheetId: '<sheet_id>',
     sheetNumber: <N>,
     sheetKey: '<sheet_key>',
     planId: '<plan_id>',
     projectId: '<project_id>',
     organizationId: '<org_id>',
     totalSheets: <total>
   })
   ```

3. **Reset PlanCoordinator if needed:**
   ```typescript
   // Delete the old coordinator
   await env.PLAN_COORDINATOR.get(
     env.PLAN_COORDINATOR.idFromName('<upload_id>')
   ).fetch('http://localhost/delete', { method: 'DELETE' })

   // Re-initialize with correct counts
   await coordinator.fetch('http://localhost/initialize', {
     method: 'POST',
     body: JSON.stringify({
       uploadId: '<upload_id>',
       totalSheets: <total>,
       timeoutMs: 900000  // 15 minutes
     })
   })
   ```

---

## Performance Profiling

### Measure Processing Times

Add custom timing logs:

```typescript
// In processJob()
const startTime = Date.now()
console.log(`[TIMING] Starting tile generation for sheet ${job.sheetNumber}`)

// ... processing code ...

const endTime = Date.now()
console.log(`[TIMING] Tile generation took ${endTime - startTime}ms for sheet ${job.sheetNumber}`)
```

### Expected Timings

| Stage | Expected Duration | Notes |
|-------|------------------|-------|
| PDF Split | 1-5s per page | Depends on PDF size |
| Metadata Extraction | 5-10s per sheet | OCR processing |
| Tile Generation | 10-20s per sheet | vips processing |
| Marker Detection | 30-60s total | All tiles processed together |

### Bottleneck Identification

1. **Slow metadata extraction:**
   - Check OCR service performance
   - Verify network latency to service
   - Consider batch processing

2. **Slow tile generation:**
   - Check container performance
   - Verify vips configuration
   - Consider parallel processing

3. **Slow marker detection:**
   - Check OCR service load
   - Verify tile count (more tiles = slower)
   - Consider pagination/chunking

---

## Monitoring Queries

### Overall System Health

```sql
-- Processing jobs status breakdown
SELECT status, COUNT(*) as count
FROM processing_jobs
WHERE created_at > datetime('now', '-24 hours')
GROUP BY status
```

### Recent Failures

```sql
-- Jobs that failed in last 24 hours
SELECT
  upload_id,
  status,
  last_error,
  created_at,
  started_at,
  completed_at
FROM processing_jobs
WHERE status = 'failed'
  AND created_at > datetime('now', '-24 hours')
ORDER BY created_at DESC
```

### Average Processing Times

```sql
-- Average time from start to completion
SELECT
  AVG((completed_at - started_at) / 1000.0) as avg_processing_seconds,
  MIN((completed_at - started_at) / 1000.0) as min_processing_seconds,
  MAX((completed_at - started_at) / 1000.0) as max_processing_seconds
FROM processing_jobs
WHERE status = 'complete'
  AND completed_at > datetime('now', '-24 hours')
```
