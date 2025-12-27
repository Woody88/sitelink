# Local PDF Processing Queue Trigger

## Problem
In local development mode, R2 event notifications don't trigger automatically when PDFs are uploaded. The queue message is sent successfully, but Cloudflare Queues don't auto-invoke the consumer in local mode.

## Solution
Use the manual trigger endpoint to invoke the PDF processing queue consumer after uploading a PDF.

## Usage

### Step 1: Upload a PDF
```bash
POST http://localhost:8787/api/projects/{projectId}/plans
Content-Type: multipart/form-data

# This will upload the PDF to R2 and create plan/planUpload records
# The response includes the filePath
```

### Step 2: Manually Trigger PDF Processing
After uploading, copy the `filePath` from the upload response logs and trigger processing:

```bash
POST http://localhost:8787/api/test/pdf-processing-trigger
Content-Type: application/json

{
  "filePath": "organizations/{orgId}/projects/{projectId}/plans/{planId}/uploads/{uploadId}/original.pdf"
}
```

### Example with curl
```bash
# Upload PDF (example - adjust to your actual endpoint)
curl -X POST http://localhost:8787/api/projects/{projectId}/plans \
  -F "name=My Plan" \
  -F "file=@/path/to/plan.pdf"

# Look in the logs for the filePath, then trigger processing:
curl -X POST http://localhost:8787/api/test/pdf-processing-trigger \
  -H "Content-Type: application/json" \
  -d '{
    "filePath": "organizations/abc123/projects/def456/plans/ghi789/uploads/jkl012/original.pdf"
  }'
```

## What Happens

The trigger endpoint will:

1. Verify the PDF exists in R2 storage
2. Extract organization/project/plan/upload IDs from the file path
3. Create an R2Notification message (same format as R2 would send)
4. Directly invoke the `pdfProcessingQueueConsumer` function
5. The consumer will:
   - Split the PDF into individual sheet PDFs
   - Upload sheets to R2
   - Create `plan_sheets` records in the database
   - Initialize the PlanCoordinator Durable Object
   - Enqueue metadata extraction jobs for each sheet

## Response

Success:
```json
{
  "success": true,
  "message": "PDF processing queue consumer executed successfully",
  "data": {
    "filePath": "organizations/.../original.pdf",
    "organizationId": "...",
    "projectId": "...",
    "planId": "...",
    "uploadId": "...",
    "notification": { /* R2Notification object */ }
  }
}
```

Error:
```json
{
  "success": false,
  "error": "PDF file not found in R2: ..."
}
```

## Production vs Local

- **Local**: Must manually trigger with this endpoint
- **Production**: R2 automatically sends notifications to the queue, consumer invokes automatically

## Security

This endpoint is **only available in development mode** (`ENVIRONMENT=development` or undefined). It will return 403 in production.

## Related Endpoints

- `GET /api/test/setup` - Create test user/org/project
- `POST /api/test/queue` - Queue a tile generation job
- `POST /api/test/queue/trigger` - Manually trigger tile generation queue consumer
- `POST /api/test/pdf-processing-trigger` - Manually trigger PDF processing queue consumer (THIS ENDPOINT)

## Debugging

Check the worker logs for:
- `📤 Uploading PDF to R2: ...` - PDF upload started
- `✅ PDF uploaded successfully to R2` - Upload completed
- `📤 Enqueuing PDF processing job for: ...` - Queue message sent
- `✅ PDF processing job enqueued successfully` - Queue send succeeded
- `🚀 [TEST PDF PROCESSING TRIGGER] Manually triggering...` - Manual trigger invoked
- `📄 Splitting PDF into N sheets...` - Processing started
- `✅ Successfully processed PDF processing job` - Processing completed
