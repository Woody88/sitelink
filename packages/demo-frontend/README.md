# Sitelink Demo Frontend

A minimal frontend demo to verify the complete PDF processing pipeline: upload → processing → tile viewing.

## Features

- 📤 PDF upload with progress tracking
- ⏱️ Real-time processing status polling
- 📑 Sheet tab navigation
- 🔍 Interactive tile viewer (OpenSeadragon)
- 🔐 OAuth authentication (Google, Microsoft)

## Prerequisites

1. **Backend running** on `http://localhost:8787`
   ```bash
   cd ../backend
   bun run dev
   ```

2. **plan-ocr-service container** running on port 8000
   ```bash
   docker start plan-ocr-service
   # or
   docker run -d --name plan-ocr-service -p 8000:8000 plan-ocr-service
   ```

3. **Bun** installed
   ```bash
   curl -fsSL https://bun.sh/install | bash
   ```

## Setup

1. Install dependencies:
   ```bash
   bun install
   ```

2. Start the dev server:
   ```bash
   bun run dev
   ```

3. Open http://localhost:3000

## How It Works

### Architecture

```
Frontend (Bun.serve on :3000)
  ├── HTML routes (auto-bundled)
  │   ├── / → index.html
  │   └── /auth.html → auth.html
  │
  └── API proxy (/api/*) → Backend (:8787)
```

### Bun Auto-Bundling

Bun automatically:
- Bundles `<script src="./app.js">` into optimized JS
- Bundles `<link href="./styles.css">` into optimized CSS
- Enables hot reloading in development mode
- No webpack, vite, or separate bundler needed!

### Processing Flow

```
1. Upload PDF
   └─> POST /api/projects/{id}/plans
       Returns: { planId, jobId }

2. Poll Job Status (every 2s)
   └─> GET /api/processing/jobs/{jobId}
       Returns: { status, progress, completedPages, totalPages }

3. Load Sheets
   └─> GET /api/plans/{planId}/sheets
       Returns: { sheets: [...] }

4. View Tiles
   └─> GET /api/plans/{planId}/sheets/{sheetId}/tiles/{level}/{x}_{y}.jpg
       OpenSeadragon dynamically loads tiles
```

## Testing Flow

### 1. Sign In

- Open http://localhost:3000
- Redirects to `/auth.html`
- Click "Continue with Google" or "Continue with Microsoft"
- OAuth flow completes → redirects to `/`

### 2. Upload PDF

- Select a multi-page PDF (construction plans work best)
- Optionally enter a plan name
- Click "Upload Plan"
- Watch the upload progress

### 3. Watch Processing

- Progress bar shows 0-100%
- Status updates every 2 seconds
- "Processing: X/Y pages complete"
- Automatically transitions to viewer when complete

### 4. View Sheets

- Tabs appear for each sheet
- Click tabs to switch between sheets
- OpenSeadragon viewer:
  - **Pan**: Click and drag
  - **Zoom**: Scroll wheel
  - **Reset**: Home button (top-left)
  - **Fullscreen**: Fullscreen button (top-left)
  - **Navigator**: Mini-map (bottom-right)

## Expected Processing Times

| Pages | Time |
|-------|------|
| 1 page | ~5-10 seconds |
| 5 pages | ~30-45 seconds |
| 10 pages | ~60-90 seconds |

## Configuration

### Environment Variables

Create `.env` file (optional):

```env
PORT=3000
BACKEND_URL=http://localhost:8787
```

### CORS Setup

The backend needs to allow `localhost:3000` in CORS. This is configured in:

`packages/backend/src/core/auth/config.ts`:
```typescript
trustedOrigins: [
  "http://localhost:8787",
  "http://localhost:3000"  // Must be added!
]
```

## Troubleshooting

### "Unauthorized" / Redirects to /auth.html

**Problem**: Session cookies not being sent

**Fix**: Make sure all API calls use `credentials: 'include'`:
```javascript
fetch('/api/endpoint', { credentials: 'include' })
```

### Upload fails with 400

**Problem**: File format or project not found

**Check**:
- File is a valid PDF
- Demo Project was created (check console logs)

### Processing stuck at 0%

**Problem**: Backend queue consumers not running

**Check**:
```bash
# In backend directory
bun run dev

# Look for queue consumer logs
```

### Tiles not loading

**Problem**: Tile generation failed or tiles not in R2

**Check**:
1. Sheet status is "ready" (not "processing")
2. OpenSeadragon console logs for tile URLs
3. Backend logs for tile generation errors

### No sheets after processing completes

**Problem**: PDF splitting failed

**Check**:
- Backend logs for PDF processing errors
- Processing job status: `GET /api/processing/jobs/{jobId}`

## File Structure

```
demo-frontend/
├── server.ts           # Bun.serve() with HTML imports + API proxy
├── index.html          # Main app UI
├── auth.html           # OAuth sign-in page
├── app.js              # Application logic (~300 lines)
├── styles.css          # UI styling
├── package.json        # Dependencies
└── README.md           # This file
```

## API Endpoints Used

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/auth/session` | Check authentication |
| GET | `/api/auth/sign-in/google` | OAuth with Google |
| GET | `/api/auth/sign-in/microsoft` | OAuth with Microsoft |
| GET | `/api/auth/sign-out` | Sign out |
| GET | `/api/projects/organizations/{orgId}/projects` | List projects |
| POST | `/api/projects/` | Create project |
| POST | `/api/projects/{projectId}/plans` | Upload PDF |
| GET | `/api/processing/jobs/{jobId}` | Poll job status |
| GET | `/api/plans/{planId}/sheets` | List sheets |
| GET | `/api/plans/{planId}/sheets/{sheetId}/tiles/{level}/{tile}` | Get tile image |

## Sample PDFs

For testing, use:
- Multi-page construction plans (5-10 pages)
- Standard letter or A4 size
- Under 20MB

## Development Notes

### Hot Reloading

Bun automatically reloads when files change:
- HTML files: Full page reload
- JS/CSS files: Hot module replacement
- server.ts: Server restart

### Console Logs

Key logs to watch:
- `"App initialized"` - Ready to upload
- `"Upload successful"` - Upload complete
- `"Job status:"` - Processing updates
- `"Loaded sheets:"` - Sheets loaded
- `"OpenSeadragon initialized"` - Viewer ready

### Browser DevTools

Useful for debugging:
- **Network tab**: Check API calls, see response codes
- **Console**: Application logs and errors
- **Application tab**: Check cookies for session token

## Production Deployment

This is a **demo/verification frontend** - not production-ready!

For production, consider:
- Add error boundaries
- Implement retry logic
- Add loading skeletons
- Handle network failures gracefully
- Add analytics/monitoring
- Use WebSockets for real-time updates (instead of polling)
- Implement proper state management
- Add unit tests

## License

MIT - Demo purposes only
