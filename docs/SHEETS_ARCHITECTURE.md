# Sheets Architecture Documentation

## Overview

This document describes the complete database architecture for the Plans and Sheets system, including the processing workflow, status synchronization, and key implementation patterns.

## Database Schema

### Complete Entity Relationship Diagram

```
┌─────────────────┐
│  organizations  │
└────────┬────────┘
         │ 1
         │
         │ N
┌────────▼────────┐
│    projects     │
└────────┬────────┘
         │ 1
         │
         │ N
┌────────▼────────────────────────────────────────────┐
│                      plans                          │
├─────────────────────────────────────────────────────┤
│ id (uuid, PK)                                       │
│ project_id (uuid, FK → projects.id)                 │
│ name (text)                                         │
│ description (text, nullable)                        │
│ processing_status (enum)                            │
│   - 'pending'                                       │
│   - 'processing'                                    │
│   - 'completed'                                     │
│   - 'failed'                                        │
│ created_at (timestamptz)                            │
│ updated_at (timestamptz)                            │
└────────┬────────────────────────────────────────────┘
         │ 1                               │ 1:1
         │                                 │
         │ N                               │
┌────────▼────────────┐      ┌─────────────▼──────────────┐
│       sheets        │      │     processingJobs         │
├─────────────────────┤      ├────────────────────────────┤
│ id (uuid, PK)       │      │ id (uuid, PK)              │
│ plan_id (uuid, FK)  │      │ plan_id (uuid, FK, UNIQUE) │
│ sheet_number (int)  │      │ status (enum)              │
│ name (text)         │      │   - 'pending'              │
│ tile_count (int)    │      │   - 'processing'           │
│ created_at          │      │   - 'completed'            │
│ updated_at          │      │   - 'failed'               │
└─────────────────────┘      │ started_at (timestamptz)   │
                             │ completed_at (timestamptz) │
                             │ error_message (text)       │
                             │ created_at (timestamptz)   │
                             │ updated_at (timestamptz)   │
                             └────────────────────────────┘
```

### Key Relationships

1. **Organizations → Projects**: 1:N relationship
2. **Projects → Plans**: 1:N relationship
3. **Plans → Sheets**: 1:N relationship
4. **Plans → ProcessingJobs**: 1:1 relationship (via `plan_id` UNIQUE constraint)

## Key Architectural Insight

### The 1:1 Job-to-Plan Relationship

**Problem**: Initial design had `sheets` containing `processing_status`, leading to complex aggregation logic.

**Solution**: Create a `processingJobs` table with a **1:1 relationship to plans**.

**Why this works**:
- One PDF upload = One plan = One processing job
- Job status directly represents plan processing status
- No aggregation needed - simple sync from job → plan
- Clean separation: `sheets` contains results, `processingJobs` tracks progress

```
Upload PDF → Create Plan → Create ProcessingJob (1:1)
                ↓
           Spawn Worker
                ↓
           Process PDF
                ↓
    Update Job Status → Sync to Plan Status
                ↓
           Create Sheets (results)
```

## Status Synchronization Flow

### Status Enum Values

Both `plans.processing_status` and `processingJobs.status` use the same enum:

```sql
CREATE TYPE processing_status AS ENUM (
  'pending',      -- Job queued, not started
  'processing',   -- PDF being processed
  'completed',    -- Successfully processed
  'failed'        -- Processing failed
);
```

### Sync Flow Diagram

```
┌─────────────────────────────────────────────────────┐
│              PDF Upload Initiated                   │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
         ┌─────────────────────────┐
         │  Create Plan Record     │
         │  status: 'pending'      │
         └────────────┬────────────┘
                       │
                       ▼
         ┌─────────────────────────┐
         │ Create ProcessingJob    │
         │  status: 'pending'      │
         │  plan_id: <plan.id>     │
         └────────────┬────────────┘
                       │
                       ▼
         ┌─────────────────────────┐
         │   Queue Worker Job      │
         └────────────┬────────────┘
                       │
                       ▼
         ┌─────────────────────────┐
         │   Worker Picks Up Job   │
         └────────────┬────────────┘
                       │
                       ▼
    ┌──────────────────────────────────┐
    │ UPDATE processingJobs            │
    │ SET status = 'processing',       │
    │     started_at = NOW()           │
    │ WHERE id = <job_id>              │
    └──────────────┬───────────────────┘
                   │
                   ▼
    ┌──────────────────────────────────┐
    │ UPDATE plans                     │
    │ SET processing_status =          │
    │     'processing'                 │
    │ WHERE id = <plan_id>             │
    └──────────────┬───────────────────┘
                   │
                   ▼
         ┌─────────────────┐
         │  Process PDF    │
         │  (Worker Logic) │
         └────────┬────────┘
                  │
                  ├─────── Success ──────┐
                  │                      │
                  ▼                      ▼
    ┌─────────────────────┐  ┌─────────────────────┐
    │   UPDATE job        │  │   UPDATE job        │
    │   status =          │  │   status =          │
    │   'completed'       │  │   'failed'          │
    │   completed_at =    │  │   error_message =   │
    │   NOW()             │  │   <error>           │
    └──────────┬──────────┘  └──────────┬──────────┘
               │                        │
               ▼                        ▼
    ┌─────────────────────┐  ┌─────────────────────┐
    │   UPDATE plan       │  │   UPDATE plan       │
    │   status =          │  │   status =          │
    │   'completed'       │  │   'failed'          │
    └──────────┬──────────┘  └──────────┬──────────┘
               │                        │
               ▼                        │
    ┌─────────────────────┐             │
    │  CREATE sheets      │             │
    │  (from results)     │             │
    └─────────────────────┘             │
                                        │
                    ┌───────────────────┘
                    │
                    ▼
         ┌──────────────────────┐
         │  Client Polls Status │
         │  Returns plan with   │
         │  current status      │
         └──────────────────────┘
```

## Transaction Patterns

### 1. Creating a Plan with Processing Job

```sql
BEGIN;

-- Create the plan
INSERT INTO plans (id, project_id, name, processing_status)
VALUES (
  gen_random_uuid(),
  '<project_id>',
  'Site Plan A',
  'pending'
)
RETURNING id INTO plan_id;

-- Create the processing job (1:1 relationship)
INSERT INTO processingJobs (id, plan_id, status)
VALUES (
  gen_random_uuid(),
  plan_id,
  'pending'
)
RETURNING id INTO job_id;

COMMIT;
```

### 2. Worker Starting Processing

```sql
BEGIN;

-- Update job status
UPDATE processingJobs
SET
  status = 'processing',
  started_at = NOW(),
  updated_at = NOW()
WHERE id = '<job_id>';

-- Sync to plan
UPDATE plans
SET
  processing_status = 'processing',
  updated_at = NOW()
WHERE id = (
  SELECT plan_id
  FROM processingJobs
  WHERE id = '<job_id>'
);

COMMIT;
```

### 3. Worker Completing Successfully

```sql
BEGIN;

-- Update job status
UPDATE processingJobs
SET
  status = 'completed',
  completed_at = NOW(),
  updated_at = NOW()
WHERE id = '<job_id>';

-- Sync to plan
UPDATE plans
SET
  processing_status = 'completed',
  updated_at = NOW()
WHERE id = (
  SELECT plan_id
  FROM processingJobs
  WHERE id = '<job_id>'
);

-- Create sheets from processing results
INSERT INTO sheets (id, plan_id, sheet_number, name, tile_count)
VALUES
  (gen_random_uuid(), '<plan_id>', 1, 'Sheet 1', 120),
  (gen_random_uuid(), '<plan_id>', 2, 'Sheet 2', 98);

COMMIT;
```

### 4. Worker Handling Failure

```sql
BEGIN;

-- Update job status with error
UPDATE processingJobs
SET
  status = 'failed',
  error_message = '<error_details>',
  completed_at = NOW(),
  updated_at = NOW()
WHERE id = '<job_id>';

-- Sync to plan
UPDATE plans
SET
  processing_status = 'failed',
  updated_at = NOW()
WHERE id = (
  SELECT plan_id
  FROM processingJobs
  WHERE id = '<job_id>'
);

COMMIT;
```

## Query Patterns

### 1. Get Plan with Processing Status

```sql
-- Simple query - status is directly on plan
SELECT
  p.id,
  p.name,
  p.processing_status,
  p.created_at,
  p.updated_at
FROM plans p
WHERE p.id = '<plan_id>';
```

### 2. Get Plan with Detailed Job Info

```sql
-- Join to get job details
SELECT
  p.id,
  p.name,
  p.processing_status,
  j.status as job_status,
  j.started_at,
  j.completed_at,
  j.error_message
FROM plans p
LEFT JOIN processingJobs j ON j.plan_id = p.id
WHERE p.id = '<plan_id>';
```

### 3. Get Plan with Sheets (After Processing)

```sql
SELECT
  p.id,
  p.name,
  p.processing_status,
  json_agg(
    json_build_object(
      'id', s.id,
      'sheet_number', s.sheet_number,
      'name', s.name,
      'tile_count', s.tile_count
    ) ORDER BY s.sheet_number
  ) as sheets
FROM plans p
LEFT JOIN sheets s ON s.plan_id = p.id
WHERE p.id = '<plan_id>'
GROUP BY p.id, p.name, p.processing_status;
```

### 4. List All Plans in Project with Status

```sql
SELECT
  p.id,
  p.name,
  p.processing_status,
  COUNT(s.id) as sheet_count
FROM plans p
LEFT JOIN sheets s ON s.plan_id = p.id
WHERE p.project_id = '<project_id>'
GROUP BY p.id, p.name, p.processing_status
ORDER BY p.created_at DESC;
```

### 5. Get Active Processing Jobs

```sql
-- Find all jobs currently processing
SELECT
  j.id,
  j.plan_id,
  j.status,
  j.started_at,
  p.name as plan_name
FROM processingJobs j
JOIN plans p ON p.id = j.plan_id
WHERE j.status = 'processing'
ORDER BY j.started_at;
```

### 6. Get Failed Plans for Retry

```sql
-- Find failed plans that can be retried
SELECT
  p.id,
  p.name,
  j.error_message,
  j.completed_at
FROM plans p
JOIN processingJobs j ON j.plan_id = p.id
WHERE p.processing_status = 'failed'
  AND p.project_id = '<project_id>'
ORDER BY j.completed_at DESC;
```

## Use Cases

### Use Case 1: Upload PDF and Create Plan

**Flow**:
1. User uploads PDF via API
2. API stores file in R2 storage
3. API creates plan record (status: 'pending')
4. API creates processingJob record (status: 'pending')
5. API queues worker job
6. API returns plan ID to client
7. Client polls for status updates

**Implementation**:
```typescript
// In Plans module
async function createPlanFromPDF(
  projectId: string,
  pdfFile: File
): Effect.Effect<Plan, PlanError, PlanService> {
  return Effect.gen(function* () {
    // Store file
    const fileId = yield* StorageService.uploadPDF(pdfFile)

    // Create plan in transaction
    const plan = yield* Database.transaction((tx) =>
      Effect.gen(function* () {
        // Insert plan
        const plan = yield* tx.insert(plans).values({
          projectId,
          processingStatus: 'pending'
        }).returning()

        // Insert job (1:1)
        const job = yield* tx.insert(processingJobs).values({
          planId: plan.id,
          status: 'pending'
        }).returning()

        return plan
      })
    )

    // Queue worker
    yield* WorkerService.queuePDFProcessing(plan.id)

    return plan
  })
}
```

### Use Case 2: Worker Processing PDF

**Flow**:
1. Worker picks up job from queue
2. Updates job status to 'processing'
3. Syncs plan status to 'processing'
4. Processes PDF (extract sheets, generate tiles)
5. On success:
   - Updates job status to 'completed'
   - Syncs plan status to 'completed'
   - Creates sheet records
6. On failure:
   - Updates job status to 'failed'
   - Syncs plan status to 'failed'
   - Stores error message

### Use Case 3: Client Polling Status

**Flow**:
1. Client calls GET /plans/:id every 2 seconds
2. API returns plan with current processing_status
3. When status = 'completed', client fetches sheets
4. When status = 'failed', client shows error

**Implementation**:
```typescript
// In Plans module
async function getPlanStatus(
  planId: string
): Effect.Effect<PlanWithStatus, PlanError, PlanService> {
  return Database.query((db) =>
    db
      .select({
        id: plans.id,
        name: plans.name,
        processingStatus: plans.processing_status,
        jobStatus: processingJobs.status,
        startedAt: processingJobs.started_at,
        completedAt: processingJobs.completed_at,
        errorMessage: processingJobs.error_message
      })
      .from(plans)
      .leftJoin(processingJobs, eq(processingJobs.plan_id, plans.id))
      .where(eq(plans.id, planId))
  )
}
```

### Use Case 4: Listing Plans in a Project

**Flow**:
1. Client requests all plans in a project
2. API returns plans with processing status
3. Client groups by status (pending, processing, completed, failed)

### Use Case 5: Retrying Failed Plan

**Flow**:
1. User clicks "Retry" on failed plan
2. API updates existing job status to 'pending'
3. API syncs plan status to 'pending'
4. API queues new worker job
5. Processing continues normally

## Migration Checklist

### Phase 1: Database Schema

- [ ] Create `processing_status` enum type
- [ ] Add `processing_status` column to `plans` table
- [ ] Create `processingJobs` table with UNIQUE constraint on `plan_id`
- [ ] Add foreign key: `processingJobs.plan_id → plans.id`
- [ ] Add indexes:
  - [ ] `processingJobs.plan_id` (unique)
  - [ ] `processingJobs.status`
  - [ ] `plans.processing_status`

### Phase 2: Data Migration

- [ ] Migrate existing plans to new schema:
  - [ ] Set default `processing_status = 'completed'` for plans with sheets
  - [ ] Set `processing_status = 'pending'` for plans without sheets
  - [ ] Create corresponding `processingJobs` records

### Phase 3: Code Updates

- [ ] Update Plans module schema:
  - [ ] Add `processing_status` to plans table definition
  - [ ] Create `processingJobs` table definition
- [ ] Update Plans service:
  - [ ] Modify `createPlan` to create job in transaction
  - [ ] Add `updateProcessingStatus` method
  - [ ] Add `getPlanWithJob` query
- [ ] Create ProcessingJobs module:
  - [ ] Service for updating job status
  - [ ] Sync logic to update plan status
- [ ] Update Worker:
  - [ ] Update status at processing start
  - [ ] Update status on completion
  - [ ] Update status on failure

### Phase 4: API Updates

- [ ] Update plan creation endpoint
- [ ] Add status polling endpoint
- [ ] Add retry endpoint for failed plans
- [ ] Update plan listing to include status

### Phase 5: Testing

- [ ] Test plan creation with job
- [ ] Test status transitions
- [ ] Test transaction rollback scenarios
- [ ] Test concurrent status updates
- [ ] Test retry flow
- [ ] Test polling endpoints

### Phase 6: Documentation

- [ ] Update API documentation
- [ ] Document status flow for frontend team
- [ ] Add runbook for handling failed jobs
- [ ] Document retry procedures

## Database Indexes

### Required Indexes

```sql
-- Primary keys (automatically indexed)
CREATE UNIQUE INDEX plans_pkey ON plans(id);
CREATE UNIQUE INDEX processingJobs_pkey ON processingJobs(id);
CREATE UNIQUE INDEX sheets_pkey ON sheets(id);

-- Foreign keys
CREATE INDEX plans_project_id_idx ON plans(project_id);
CREATE INDEX sheets_plan_id_idx ON sheets(plan_id);

-- Unique constraint for 1:1 relationship
CREATE UNIQUE INDEX processingJobs_plan_id_unique ON processingJobs(plan_id);

-- Status queries
CREATE INDEX plans_processing_status_idx ON plans(processing_status);
CREATE INDEX processingJobs_status_idx ON processingJobs(status);

-- Composite indexes for common queries
CREATE INDEX plans_project_status_idx ON plans(project_id, processing_status);
CREATE INDEX processingJobs_status_created_idx ON processingJobs(status, created_at);
```

## Error Handling

### Processing Failure Scenarios

1. **PDF Parse Error**: Invalid or corrupted PDF file
2. **Timeout**: Processing takes too long
3. **Resource Error**: Out of memory or storage
4. **Network Error**: Cannot access R2 storage
5. **Database Error**: Cannot save results

### Error Storage

All errors are stored in `processingJobs.error_message`:

```sql
UPDATE processingJobs
SET
  status = 'failed',
  error_message = 'PDF parse error: Invalid page structure on page 3',
  completed_at = NOW()
WHERE id = '<job_id>';
```

### Retry Strategy

For transient errors, implement exponential backoff:
- First retry: Immediate
- Second retry: After 1 minute
- Third retry: After 5 minutes
- Fourth retry: After 15 minutes
- After 4 failures: Mark as permanently failed

## Performance Considerations

### Query Optimization

1. **Status Checks**: Use index on `plans.processing_status`
2. **Active Jobs**: Index on `processingJobs.status` for worker queries
3. **Avoid N+1**: Use joins instead of separate queries for job details

### Transaction Scope

Keep transactions small:
- Create plan + job: Single transaction
- Update status: Single transaction
- Create sheets: Separate transaction after job completion

### Polling Efficiency

- Client polling interval: 2-3 seconds
- Use HTTP caching headers
- Consider WebSocket for real-time updates (future enhancement)

## Future Enhancements

### Potential Improvements

1. **WebSocket Status Updates**: Real-time status instead of polling
2. **Job Priority**: Add priority field for rush jobs
3. **Partial Success**: Track individual sheet processing status
4. **Job Metrics**: Processing time, file size, page count
5. **Job History**: Archive completed jobs after 30 days
6. **Batch Processing**: Process multiple PDFs in one job

### Monitoring

Track these metrics:
- Average processing time per plan
- Success/failure rates
- Active job count
- Queue depth
- Failed job reasons (aggregate error messages)

## Summary

This architecture provides:

✅ **Clear Status Flow**: Job status → Plan status (1:1 sync)
✅ **Simple Queries**: No aggregation needed for plan status
✅ **Transactional Safety**: All updates in transactions
✅ **Scalability**: Indexes on all query paths
✅ **Error Tracking**: Full error context in job records
✅ **Future-Proof**: Easy to extend with new job types

The key insight is using a **1:1 relationship between jobs and plans** instead of trying to aggregate status from sheets. This matches the business logic (one PDF = one plan = one job) and keeps the data model simple and efficient.
