# SiteLink Mobile App - Core Feature Requirements

## Priority 1: Plan Viewing & Navigation

### 1.1 Plan Viewer (OpenSeadragon)
**Requirement:** Deep zoom plan viewing with smooth pan/zoom
- Load DZI tiles from Cloudflare R2
- Support pinch-to-zoom, double-tap zoom, pan gestures
- Show/hide marker overlays (toggle)
- Performance: Load plans up to 50MB without lag
- Offline: Cache tiles for offline viewing

**Acceptance Criteria:**
- [ ] Can load and view construction plans smoothly
- [ ] Zoom works from overview to detail level (at least 4 zoom levels)
- [ ] Works offline once plan is cached
- [ ] Loads within 2 seconds on 4G connection

### 1.2 Clickable/Pressable Callouts
**Requirement:** Tap callout marker → Navigate to referenced sheet
- Display both circle and triangle markers on plan
- Show marker reference (e.g., "5/A7") on tap
- Navigate to linked sheet when marker is pressed
- Highlight destination marker after navigation
- Back navigation returns to previous location

**User Flow:**
```
User views Sheet A5
  ↓
Taps marker "5/A7" (circle)
  ↓
App shows marker details modal:
  - Reference: 5/A7
  - Detail: 5
  - Target Sheet: A7
  - Confidence: 92%
  - [View Referenced Sheet] button
  ↓
User taps [View Referenced Sheet]
  ↓
App navigates to Sheet A7
  ↓
Sheet A7 loads with detail marker #5 highlighted
  ↓
User can tap back to return to A5
```

**Acceptance Criteria:**
- [ ] Tap marker shows reference info
- [ ] Navigation completes in <1 second
- [ ] Target marker is highlighted for 2 seconds
- [ ] Back button returns to exact viewport position
- [ ] Works for both circles and triangles

## Priority 2: Callout Position Adjustment

### 2.1 Review Low-Confidence Callouts
**Requirement:** Allow field workers to correct marker positions for low-confidence detections (<70% confidence)

**Markers Requiring Review:**
- Detection confidence < 70%
- OCR confidence (detail or sheet) < 80%
- Link status = "pending"

**Review Interface:**
```
┌─────────────────────────────────┐
│  📋 Markers Needing Review (12) │
├─────────────────────────────────┤
│  🔵 5/A7          Confidence: 65%│
│  🔺 3/A10         Confidence: 58%│
│  🔵 10/S-201      Confidence: 72%│
│  ...                             │
└─────────────────────────────────┘
```

### 2.2 Drag-to-Reposition Markers
**Requirement:** Long-press marker → Drag to correct position → Confirm

**User Flow:**
```
User in "Review Mode"
  ↓
Long-press on low-confidence marker
  ↓
Marker enters "edit mode" (visual feedback: pulsing, larger)
  ↓
User drags marker to correct position
  ↓
Crosshair shows exact center point
  ↓
User releases finger
  ↓
Confirmation dialog:
  "Adjust marker position?"
  Old: x=1234, y=5678
  New: x=1240, y=5680
  [Cancel] [Confirm]
  ↓
User taps [Confirm]
  ↓
Position saved to database
  ↓
Marker status: "confirmed" by user
  ↓
Marker removed from review list
```

**Technical Implementation:**
```typescript
// Marker adjustment state
interface MarkerAdjustment {
  markerId: string
  originalX: number
  originalY: number
  newX: number
  newY: number
  adjustedBy: string  // user ID
  adjustedAt: string  // timestamp
}

// Database update
UPDATE plan_markers 
SET 
  x = ?,
  y = ?,
  link_status = 'confirmed',
  reviewed_by = ?,
  reviewed_at = CURRENT_TIMESTAMP,
  position_adjusted = TRUE,
  original_x = ?,  -- Store original for audit
  original_y = ?
WHERE id = ?
```

**Acceptance Criteria:**
- [ ] Only markers with confidence < 70% can be adjusted
- [ ] Drag works smoothly (60fps)
- [ ] Crosshair shows exact placement point
- [ ] Adjustment is saved to server immediately
- [ ] Offline adjustments queued for sync
- [ ] Adjustment history tracked (who, when)

### 2.3 Bulk Review Actions
**Requirement:** Review multiple markers efficiently

**Actions:**
- Confirm position (no adjustment needed)
- Reject marker (false positive)
- Adjust position (drag to correct)
- Skip (review later)

**Bulk Operations:**
- Select multiple markers → Confirm all
- Filter by confidence range
- Filter by sheet
- Sort by confidence (lowest first)

## Priority 3: Media Management with Sequence Workflow

### 3.1 Photo/Video Capture States
**Requirement:** Organize site media by work progress state

**States:**
1. **Start** - Before work begins (baseline)
2. **In Progress** - Work underway (progress updates)
3. **Issue/Incident** - Problems, safety concerns, damage
4. **Complete** - Finished work (final verification)

**User Flow:**
```
User viewing callout "5/A7"
  ↓
Taps [📷 Add Media]
  ↓
Select state:
  ┌─────────────────────────────┐
  │  What are you documenting?  │
  ├─────────────────────────────┤
  │  ▶️ Start                    │
  │  🔄 In Progress              │
  │  ⚠️  Issue/Incident          │
  │  ✅ Complete                 │
  └─────────────────────────────┘
  ↓
User selects "In Progress"
  ↓
Camera opens with state overlay: "🔄 IN PROGRESS"
  ↓
User captures photo/video
  ↓
Review screen:
  - Preview
  - State: In Progress
  - Linked to: Marker 5/A7, Sheet A7
  - Add note (optional)
  - [Retake] [Save]
  ↓
User taps [Save]
  ↓
Media uploaded to R2
  ↓
Metadata saved:
    marker_id: marker-123
    state: "in_progress"
    captured_at: timestamp
    captured_by: user_id
    notes: "Framing complete, ready for drywall"
```

### 3.2 Media Timeline View
**Requirement:** View all media for a marker in chronological sequence

**Interface:**
```
┌─────────────────────────────────────┐
│  Marker 5/A7 - Media Timeline       │
├─────────────────────────────────────┤
│  ▶️ Start (2 photos) - 2 days ago   │
│  [📷][📷]                            │
│                                      │
│  🔄 In Progress (3 items) - 1 day ago│
│  [📷][📷][🎥]                        │
│                                      │
│  ⚠️ Issue (1 video) - 5 hours ago   │
│  [🎥 "Plumbing leak discovered"]    │
│                                      │
│  ✅ Complete (1 photo) - 2 hours ago│
│  [📷 "Repair completed"]             │
└─────────────────────────────────────┘
```

**Features:**
- Tap media → Full screen view
- Swipe through sequence
- Filter by state
- Download for offline
- Share via email/text

### 3.3 Bundle Sequence Logic
**Requirement:** Track complete workflow from start to finish

**Sequence Validation:**
- Cannot mark "Complete" without "Start" photo
- Warning if "Issue" state exists without resolution
- Suggested next state based on current state

**State Transitions:**
```
Start → In Progress → Complete (happy path)
Start → In Progress → Issue → In Progress → Complete (with issue)
Start → Issue → Complete (immediate issue resolution)
```

**Notification Logic:**
- Issue state → Notify supervisor
- Complete without Start → Prompt for Start photo
- 3+ days in "In Progress" → Reminder

### 3.4 Database Schema

```sql
CREATE TABLE media (
  id TEXT PRIMARY KEY,
  marker_id TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('photo', 'video')),
  mime_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  width INTEGER,
  height INTEGER,
  duration INTEGER,  -- for videos
  
  -- Sequence workflow fields
  state TEXT NOT NULL CHECK(state IN ('start', 'in_progress', 'issue', 'complete')),
  sequence_order INTEGER,  -- Auto-increment per marker
  notes TEXT,
  
  -- Metadata
  captured_at TIMESTAMP NOT NULL,
  captured_by TEXT NOT NULL,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (marker_id) REFERENCES plan_markers(id),
  FOREIGN KEY (plan_id) REFERENCES plans(id),
  FOREIGN KEY (captured_by) REFERENCES users(id)
);

-- Index for timeline queries
CREATE INDEX idx_media_marker_sequence 
  ON media(marker_id, sequence_order);

-- Index for state filtering
CREATE INDEX idx_media_state 
  ON media(state);
```

### 3.5 Offline Support
**Requirement:** Allow media capture offline, sync when online

**Offline Queue:**
```typescript
interface QueuedMedia {
  id: string
  localUri: string          // Local file path
  markerId: string
  state: MediaState
  notes?: string
  capturedAt: string
  capturedBy: string
  syncStatus: 'pending' | 'uploading' | 'synced' | 'failed'
  attempts: number
}

// Store in AsyncStorage
await AsyncStorage.setItem('media_queue', JSON.stringify(queue))

// Sync when online
NetInfo.addEventListener(state => {
  if (state.isConnected) {
    processMediaQueue()
  }
})
```

## API Requirements for Mobile

### Endpoints Needed

```typescript
// 1. Get markers for plan
GET /api/plans/:planId/markers
Response: Marker[]

// 2. Update marker position
PUT /api/markers/:markerId/position
Body: { x: number, y: number, adjustedBy: string }
Response: { success: boolean }

// 3. Confirm marker
PUT /api/markers/:markerId/confirm
Body: { confirmedBy: string, notes?: string }
Response: { success: boolean }

// 4. Reject marker
PUT /api/markers/:markerId/reject
Body: { rejectedBy: string, reason: string }
Response: { success: boolean }

// 5. Upload media
POST /api/media
Body: FormData {
  file: File
  markerId: string
  state: 'start' | 'in_progress' | 'issue' | 'complete'
  notes?: string
  capturedAt: string
}
Response: { id: string, url: string, sequenceOrder: number }

// 6. Get media timeline for marker
GET /api/markers/:markerId/media
Response: Media[] (sorted by sequence_order)

// 7. Get markers needing review
GET /api/plans/:planId/markers/review
Query: { minConfidence?: number }
Response: Marker[] (confidence < 70%)
```

## Success Metrics

### Plan Viewing
- [ ] 95% of plans load within 2 seconds
- [ ] Zero crashes on plans up to 100MB
- [ ] Smooth 60fps pan/zoom on device

### Callout Navigation
- [ ] 100% of valid references navigate correctly
- [ ] <1 second navigation time
- [ ] <5% user error rate (wrong sheet)

### Position Adjustment
- [ ] 90% of adjusted markers have confidence > 90% after adjustment
- [ ] Average adjustment distance: <20 pixels
- [ ] 80% of markers reviewed within 24 hours of detection

### Media Workflow
- [ ] 95% of work items have "Start" photo
- [ ] 90% of issues have resolution photo
- [ ] Average sequence completion time: <3 days
- [ ] 100% media sync success rate (eventually)

## Implementation Priority

**Sprint 1 (Week 1):**
1. Plan viewer with OpenSeadragon ✅
2. Display markers (read-only) ✅
3. Clickable markers with details modal ✅
4. Basic navigation to referenced sheet ✅

**Sprint 2 (Week 2):**
5. Marker review list (confidence < 70%) ✅
6. Drag-to-reposition markers ✅
7. Confirm/reject actions ✅
8. Offline queue for adjustments ✅

**Sprint 3 (Week 3):**
9. Camera integration ✅
10. State selection (Start/Progress/Issue/Complete) ✅
11. Media upload with state ✅
12. Basic timeline view ✅

**Sprint 4 (Week 4):**
13. Complete media timeline with filtering ✅
14. Bulk review actions ✅
15. Notification system ✅
16. E2E testing ✅
