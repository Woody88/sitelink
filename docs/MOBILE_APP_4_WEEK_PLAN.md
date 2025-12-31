# SiteLink Mobile App - 4-Week Development Plan

**Created:** December 23, 2024
**Status:** Week 1 In Progress
**Last Updated:** December 24, 2024

---

## Week 1 Progress

### Backend (COMPLETE)
- [x] Add review fields to planMarkers schema (reviewStatus, adjustedBbox, originalBbox, adjustedBy, adjustedAt, reviewNotes)
- [x] Create `GET /plans/:id/markers/pending-review` endpoint
- [x] Create `PATCH /markers/:id/position` endpoint
- [x] Create `PATCH /markers/:id/review` endpoint
- [x] Create `POST /markers/bulk-review` endpoint
- [x] Run database migration (0002_long_rafael_vega.sql)

### Mobile Setup (COMPLETE)
- [x] Initialize Expo project with SDK 54
- [x] Configure Expo Router with auth/main route groups
- [x] Set up TanStack Query provider
- [x] Create API client service
- [x] Install NativeWind for styling
- [x] Install OpenSeadragon + @types/openseadragon

### OpenSeadragon Viewer (COMPLETE)
- [x] Create PlanViewer.dom.tsx with 'use dom' directive
- [x] Implement DZI tile loading
- [x] Add marker overlays with confidence colors
- [x] Implement marker tap → details modal
- [x] Add sheet-to-sheet navigation
- [x] Add highlight animation for target marker

### Remaining Week 1
- [ ] Test full navigation flow with real data
- [ ] Add React Native Reusables UI components
- [ ] Implement back button with viewport restoration

---

## Quick Reference

| Week | Focus | Goal |
|------|-------|------|
| 1 | Plan Viewer & Navigation | Working deep zoom viewer with clickable markers |
| 2 | Marker Position Adjustment | Field workers can review and correct markers |
| 3 | Media Capture Workflow | Photos/videos with state tracking |
| 4 | Timeline, Bulk Review & Polish | Complete features, E2E testing |

---

## Technology Stack

### Mobile Framework
- **Expo SDK 54+** with Expo Router (file-based routing)
- **Expo DOM Components** (`'use dom'` directive) for OpenSeadragon integration
- **React Native Reusables** (shadcn/ui patterns) for UI components

### State Management
- **TanStack Query (React Query)** for server state
- **AsyncStorage** for offline persistence
- **Zustand** (optional) for complex local state

### Key Dependencies
```json
{
  "expo": "~54.0.0",
  "expo-router": "~4.0.0",
  "expo-camera": "~16.0.0",
  "react-dom": "^18.3.0",
  "react-native-web": "~0.19.0",
  "@expo/metro-runtime": "~4.0.0",
  "@tanstack/react-query": "^5.0.0",
  "@react-native-async-storage/async-storage": "^2.0.0",
  "nativewind": "^4.0.0"
}
```

---

## Architecture

### Why Expo DOM Components (Not WebView)

| Aspect | Expo DOM Components | WebView |
|--------|---------------------|---------|
| Integration | Native `'use dom'` directive | Separate web context |
| Data Flow | Marshalled props, async functions | postMessage bridge |
| Dev Experience | Fast Refresh, shared Metro | Separate debugging |
| Performance | Optimized by Expo | Standard WebView |
| OpenSeadragon | Full DOM access | Full DOM access |

**Expo DOM Components** is the recommended approach because:
1. Mentioned in project CLAUDE.md as the intended pattern
2. Seamless integration with Expo Router
3. Shared bundler configuration
4. Better debugging experience
5. Native actions via async function props

### Component Architecture

```
packages/mobile/
├── app/                          # Expo Router screens
│   ├── (auth)/
│   │   └── login.tsx
│   ├── (main)/
│   │   ├── _layout.tsx           # Tab navigation
│   │   ├── projects/
│   │   │   ├── index.tsx         # Project list
│   │   │   └── [projectId]/
│   │   │       ├── index.tsx     # Plans list
│   │   │       └── plans/
│   │   │           └── [planId]/
│   │   │               ├── index.tsx    # Sheets grid
│   │   │               ├── viewer.tsx   # Plan viewer
│   │   │               └── review.tsx   # Marker review
│   │   └── media/
│   │       └── [markerId].tsx    # Media timeline
│   └── _layout.tsx
│
├── components/
│   ├── ui/                       # React Native Reusables
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── dialog.tsx
│   │   ├── input.tsx
│   │   └── ...
│   ├── plan-viewer/
│   │   ├── PlanViewer.dom.tsx    # 'use dom' component
│   │   ├── MarkerOverlay.tsx     # SVG marker rendering
│   │   └── MarkerModal.tsx       # Native modal
│   ├── media/
│   │   ├── CameraCapture.tsx
│   │   ├── StateSelector.tsx
│   │   └── Timeline.tsx
│   └── review/
│       ├── ReviewList.tsx
│       └── DraggableMarker.dom.tsx
│
├── hooks/
│   ├── usePlans.ts
│   ├── useMarkers.ts
│   ├── useMedia.ts
│   └── useOfflineSync.ts
│
├── services/
│   ├── api.ts                    # API client
│   ├── offline-queue.ts          # Offline sync
│   └── tile-cache.ts             # Tile caching
│
└── lib/
    └── utils.ts                  # Shared utilities
```

### Expo DOM Component Pattern

```typescript
// components/plan-viewer/PlanViewer.dom.tsx
'use dom';

import OpenSeadragon from 'openseadragon';
import { useEffect, useRef } from 'react';

interface Props {
  dziUrl: string;
  markers: Array<{ id: string; x: number; y: number; text: string }>;
  onMarkerTap: (markerId: string) => Promise<void>;  // Async required!
  onMarkerDrag: (markerId: string, x: number, y: number) => Promise<void>;
}

export default function PlanViewer({ dziUrl, markers, onMarkerTap, onMarkerDrag }: Props) {
  const viewerRef = useRef<HTMLDivElement>(null);
  const osdRef = useRef<OpenSeadragon.Viewer | null>(null);

  useEffect(() => {
    if (!viewerRef.current) return;

    osdRef.current = OpenSeadragon({
      element: viewerRef.current,
      tileSources: dziUrl,
      // ... config
    });

    // Add marker overlays
    markers.forEach(marker => {
      const overlay = document.createElement('div');
      overlay.className = 'marker-circle';
      overlay.onclick = () => onMarkerTap(marker.id);
      osdRef.current?.addOverlay(overlay, new OpenSeadragon.Point(marker.x, marker.y));
    });

    return () => osdRef.current?.destroy();
  }, [dziUrl, markers]);

  return <div ref={viewerRef} style={{ width: '100%', height: '100%' }} />;
}
```

```typescript
// app/(main)/projects/[projectId]/plans/[planId]/viewer.tsx
import { useLocalSearchParams, router } from 'expo-router';
import { View } from 'react-native';
import PlanViewer from '@/components/plan-viewer/PlanViewer.dom';
import MarkerModal from '@/components/plan-viewer/MarkerModal';
import { useMarkers } from '@/hooks/useMarkers';

export default function ViewerScreen() {
  const { planId, sheetId } = useLocalSearchParams();
  const { markers } = useMarkers(planId, sheetId);
  const [selectedMarker, setSelectedMarker] = useState(null);

  const handleMarkerTap = async (markerId: string) => {
    const marker = markers.find(m => m.id === markerId);
    setSelectedMarker(marker);
  };

  const handleNavigate = async (targetSheetRef: string) => {
    router.push(`/projects/${projectId}/plans/${planId}/viewer?sheet=${targetSheetRef}`);
  };

  return (
    <View style={{ flex: 1 }}>
      <PlanViewer
        dziUrl={`${API_URL}/plans/${planId}/sheets/${sheetId}/dzi`}
        markers={markers}
        onMarkerTap={handleMarkerTap}
        dom={{ scrollEnabled: false }}
      />
      <MarkerModal
        marker={selectedMarker}
        onNavigate={handleNavigate}
        onClose={() => setSelectedMarker(null)}
      />
    </View>
  );
}
```

---

## API Gap Analysis

### Existing Endpoints (Ready for Mobile)

| Endpoint | Method | Purpose | Status |
|----------|--------|---------|--------|
| `/api/plans/:id/sheets` | GET | List sheets with marker counts | Ready |
| `/api/plans/:id/sheets/:id/dzi` | GET | DZI tile metadata XML | Ready |
| `/api/plans/:id/sheets/:id/tiles/:level/:tile` | GET | Individual tile images | Ready |
| `/api/plans/:id/sheets/:id/markers` | GET | Detected markers (read-only) | Ready |
| `/api/projects/:id/media` | POST | Upload media | Ready |
| `/api/media/:id/download` | GET | Download media | Ready |
| `/auth/*` | * | Better-auth endpoints | Ready |

### Missing Endpoints (Must Build)

| Priority | Endpoint | Method | Purpose | Week |
|----------|----------|--------|---------|------|
| **P0** | `/api/markers/:id/position` | PATCH | Reposition marker | 2 |
| **P0** | `/api/markers/:id/review` | PATCH | Confirm/reject marker | 2 |
| **P0** | `/api/plans/:id/markers/pending-review` | GET | Low-confidence markers | 1 |
| **P1** | `/api/markers/:id/media` | POST | Upload media linked to marker | 3 |
| **P1** | `/api/markers/:id/media` | GET | Media timeline for marker | 3 |
| **P2** | `/api/plans/:id/markers/bulk-review` | POST | Bulk confirm/reject | 4 |

### Database Schema Updates Needed

```sql
-- Add to planMarkers table (Week 1)
ALTER TABLE plan_markers ADD COLUMN review_status TEXT DEFAULT 'pending';
ALTER TABLE plan_markers ADD COLUMN adjusted_bbox TEXT;
ALTER TABLE plan_markers ADD COLUMN original_bbox TEXT;
ALTER TABLE plan_markers ADD COLUMN adjusted_by TEXT;
ALTER TABLE plan_markers ADD COLUMN adjusted_at INTEGER;

-- Add to media table (Week 3)
ALTER TABLE media ADD COLUMN marker_id TEXT REFERENCES plan_markers(id);
ALTER TABLE media ADD COLUMN state TEXT CHECK(state IN ('start', 'in_progress', 'issue', 'complete'));
ALTER TABLE media ADD COLUMN sequence_order INTEGER;
ALTER TABLE media ADD COLUMN notes TEXT;
ALTER TABLE media ADD COLUMN captured_at INTEGER;
```

---

## Week 1: Plan Viewer & Navigation

**Goal:** Working plan viewer with clickable markers that navigate between sheets

### Backend Tasks

- [ ] Add review fields to `planMarkers` schema
  - File: `packages/backend/src/db/schema.ts`
  - Fields: `reviewStatus`, `adjustedBbox`, `originalBbox`, `adjustedBy`, `adjustedAt`

- [ ] Run database migration
  - Command: `bun run db:gen:migration && bun run db:local:studio`

- [ ] Create `GET /plans/:id/markers/pending-review` endpoint
  - File: `packages/backend/src/features/plans/http.ts`
  - Returns markers with confidence < 70%

- [ ] Enhance existing markers endpoint with review status
  - File: `packages/backend/src/features/plans/service.ts`

### Mobile Setup Tasks

- [ ] Initialize Expo project
  ```bash
  cd packages/mobile
  npx create-expo-app@latest . --template expo-template-blank-typescript
  ```

- [ ] Install core dependencies
  ```bash
  npx expo install expo-router react-dom react-native-web @expo/metro-runtime
  bun add @tanstack/react-query nativewind
  ```

- [ ] Initialize React Native Reusables
  ```bash
  bunx --bun @react-native-reusables/cli@latest init
  ```

- [ ] Add base UI components
  ```bash
  bunx --bun @react-native-reusables/cli@latest add button card dialog input
  ```

- [ ] Configure Expo Router with file-based routing

- [ ] Set up TanStack Query provider

### Mobile Feature Tasks

- [ ] Create auth screens (login via better-auth)
  - File: `app/(auth)/login.tsx`

- [ ] Build Projects list screen
  - File: `app/(main)/projects/index.tsx`

- [ ] Build Plans list screen
  - File: `app/(main)/projects/[projectId]/index.tsx`

- [ ] Build Sheets grid screen
  - File: `app/(main)/projects/[projectId]/plans/[planId]/index.tsx`

- [ ] Create OpenSeadragon DOM component
  - File: `components/plan-viewer/PlanViewer.dom.tsx`
  - Features: DZI loading, zoom/pan gestures

- [ ] Add marker overlay rendering
  - Render circles and triangles at normalized coordinates
  - Different colors for confidence levels

- [ ] Implement marker tap → details modal
  - File: `components/plan-viewer/MarkerModal.tsx`
  - Shows: reference, confidence, "Go to Sheet" button

- [ ] Implement sheet-to-sheet navigation
  - Parse target sheet reference from marker
  - Navigate to target sheet with highlight

- [ ] Add back button with viewport restoration
  - Store viewport state before navigation
  - Restore on back

### Week 1 Success Criteria

| Metric | Target |
|--------|--------|
| Plan loads within | 2 seconds |
| Zoom levels available | 4+ |
| Marker tap accuracy | 95% |
| Navigation to target sheet | 100% success |
| Back button restoration | 100% accurate |
| Crash rate | 0% |

### Definition of Done - Week 1

- [ ] Demo video: login → project → plan → tap marker → navigate → back
- [ ] Works on iOS Simulator AND Android Emulator
- [ ] Handles 50MB+ plans without lag
- [ ] All React Native Reusables components styled correctly

---

## Week 2: Marker Position Adjustment

**Goal:** Field workers can review and correct low-confidence marker positions

### Backend Tasks

- [ ] Create `PATCH /markers/:id/position` endpoint
  - File: `packages/backend/src/features/markers/http.ts`
  - Payload: `{ x: number, y: number, notes?: string }`

- [ ] Create `PATCH /markers/:id/review` endpoint
  - File: `packages/backend/src/features/markers/http.ts`
  - Payload: `{ action: 'confirm' | 'reject', reason?: string }`

- [ ] Create MarkersService with adjustment logic
  - File: `packages/backend/src/features/markers/service.ts`
  - Stores original bbox before adjustment
  - Updates review status

- [ ] Add audit trail for adjustments
  - Track who adjusted, when, why

### Mobile Feature Tasks

- [ ] Create ReviewList screen
  - File: `app/(main)/projects/[projectId]/plans/[planId]/review.tsx`
  - Shows markers with confidence < 70%

- [ ] Add filtering by confidence threshold
  - Slider or preset buttons (50%, 60%, 70%)

- [ ] Implement long-press to enter edit mode
  - 500ms hold triggers edit mode
  - Visual feedback: pulsing animation

- [ ] Create draggable marker DOM component
  - File: `components/review/DraggableMarker.dom.tsx`
  - Smooth 60fps drag
  - Crosshair overlay during drag

- [ ] Build position confirmation dialog
  - Shows old vs new coordinates
  - Cancel / Confirm buttons

- [ ] Implement Confirm/Reject/Skip actions
  - Update marker status via API
  - Remove from review list on confirm/reject

- [ ] Add offline queue for adjustments
  - File: `services/offline-queue.ts`
  - Store pending adjustments in AsyncStorage
  - Sync when online

- [ ] Implement bulk select and confirm
  - Multi-select mode
  - "Confirm All Selected" action

### Week 2 Success Criteria

| Metric | Target |
|--------|--------|
| Review list loads | < 500ms |
| Drag gesture FPS | 60fps |
| Adjustment saved | < 1 second |
| Offline queue works | Persists across restart |
| Sync success rate | 100% |

### Definition of Done - Week 2

- [ ] Demo video: review list → long-press → drag → confirm → verify on server
- [ ] Works with airplane mode ON (queues adjustment)
- [ ] Turn airplane mode OFF → adjustment syncs
- [ ] Bulk confirm works for 10+ markers

---

## Week 3: Media Capture Workflow

**Goal:** Capture photos/videos linked to callouts with state tracking

### Backend Tasks

- [ ] Extend media schema with state fields
  - File: `packages/backend/src/db/schema.ts`
  - Add: `markerId`, `state`, `sequenceOrder`, `notes`, `capturedAt`

- [ ] Run database migration

- [ ] Create `POST /markers/:id/media` endpoint
  - File: `packages/backend/src/features/media/http.ts`
  - Accepts: file, state, notes

- [ ] Create `GET /markers/:id/media` endpoint (timeline)
  - Returns media grouped by state
  - Ordered by sequence_order

- [ ] Add sequence_order auto-increment logic
  - Per-marker incrementing

### Mobile Feature Tasks

- [ ] Create MediaCapture screen
  - File: `app/(main)/media/capture.tsx`
  - Full-screen camera

- [ ] Build state selection UI
  - File: `components/media/StateSelector.tsx`
  - Large buttons: Start | In Progress | Issue | Complete
  - Construction-site friendly (glove-compatible)

- [ ] Integrate Expo Camera
  - Photo capture
  - Video recording (up to 60 seconds)

- [ ] Build photo preview screen
  - Review before save
  - Add notes input
  - Retake / Save buttons

- [ ] Implement upload to R2 via API
  - Progress indicator
  - Retry on failure

- [ ] Associate media with marker
  - Pass markerId in upload

- [ ] Add notes input field
  - Optional description
  - Voice-to-text (future)

- [ ] Build offline capture queue
  - Store media locally when offline
  - Track sync status: pending | uploading | synced | failed

- [ ] Implement background upload service
  - Continue upload when app backgrounded
  - Notification on complete

### Week 3 Success Criteria

| Metric | Target |
|--------|--------|
| Camera launch | < 1 second |
| Photo capture | < 500ms shutter |
| Upload speed | 5MB in 10s (4G) |
| State selection | 1 tap |
| Offline capture | Works |
| Background sync | Completes |

### Definition of Done - Week 3

- [ ] Demo video: tap marker → "Add Media" → select state → capture → save
- [ ] Photo appears in marker's media list
- [ ] Works offline (media queued for upload)
- [ ] Large touch targets work with work gloves

---

## Week 4: Timeline, Bulk Review & Polish

**Goal:** Complete media timeline, bulk operations, E2E testing

### Backend Tasks

- [ ] Create `POST /plans/:id/markers/bulk-review` endpoint
  - Payload: `{ markerIds: string[], action: 'confirm' | 'reject', reason?: string }`
  - Returns: `{ success: true, updated: number }`

- [ ] Add timeline grouping by state in service
  - Group media by state
  - Include counts

- [ ] Create processing status endpoint
  - File: `packages/backend/src/features/plans/http.ts`
  - Returns structured processing progress

### Mobile Feature Tasks

- [ ] Create MediaTimeline screen
  - File: `app/(main)/media/[markerId].tsx`
  - Grouped by state with headers

- [ ] Build timeline UI with state grouping
  - File: `components/media/Timeline.tsx`
  - Visual state indicators (icons)

- [ ] Create full-screen media viewer
  - Tap to expand
  - Swipe to navigate sequence

- [ ] Add state filtering
  - Filter buttons: All | Start | Progress | Issue | Complete

- [ ] Implement bulk marker selection
  - Checkbox mode in review list
  - Select All / Deselect All

- [ ] Add bulk confirm/reject actions
  - Apply to all selected
  - Progress indicator

- [ ] Build offline sync status indicator
  - File: `components/SyncStatus.tsx`
  - Shows: X items pending sync
  - Tap to force sync

- [ ] Add sync error handling
  - Retry failed items
  - Show error details

### Testing Tasks

- [ ] Set up Maestro E2E framework
  ```bash
  brew install maestro
  ```

- [ ] Write Maestro test: Plan viewer flow
  - Login → Select project → View plan → Zoom/pan

- [ ] Write Maestro test: Marker navigation
  - Tap marker → View details → Navigate to sheet

- [ ] Write Maestro test: Position adjustment
  - Open review → Long-press → Drag → Confirm

- [ ] Write Maestro test: Media capture
  - Open marker → Capture → Select state → Save

- [ ] Write Maestro test: Offline sync
  - Enable airplane mode → Make changes → Disable → Verify sync

- [ ] Write unit tests for API hooks
  - File: `hooks/__tests__/`

- [ ] Write integration tests for services
  - File: `services/__tests__/`

### Week 4 Success Criteria

| Metric | Target |
|--------|--------|
| Timeline renders | < 1 second |
| Bulk select works | 50+ markers |
| E2E test pass rate | 100% |
| Sync indicator accuracy | 100% |
| Test coverage | > 70% |

### Definition of Done - Week 4

- [ ] All 6 Maestro E2E tests passing
- [ ] App submitted to TestFlight / Internal Testing
- [ ] Performance profile shows no memory leaks
- [ ] Documentation updated

---

## Risk Assessment

### High Risk

| Risk | Impact | Mitigation |
|------|--------|------------|
| Expo DOM Components OpenSeadragon issues | Blocking | Test Day 1, have WebView fallback ready |
| Large plan performance | Poor UX | Tile prefetching, lazy loading |
| Offline sync conflicts | Data loss | Last-write-wins with conflict log |

### Medium Risk

| Risk | Impact | Mitigation |
|------|--------|------------|
| Camera permissions denied | Feature blocked | Clear rationale, fallback to file picker |
| Large media upload failures | Lost work | Chunked uploads, resume capability |
| Construction site connectivity | Features fail | Aggressive caching, queue everything |

### Low Risk

| Risk | Impact | Mitigation |
|------|--------|------------|
| Better-auth mobile issues | Auth problems | Well-documented library |
| Expo updates breaking | Build failures | Pin versions |
| R2 storage costs | Budget | Compression, usage alerts |

---

## React Native Reusables Components Used

| Component | Usage |
|-----------|-------|
| `Button` | All actions, large touch targets |
| `Card` | Project/plan/sheet list items |
| `Dialog` | Marker details, confirmations |
| `Input` | Notes, search |
| `Badge` | Confidence indicators, sync status |
| `Progress` | Upload progress |
| `Tabs` | Timeline state filtering |
| `Skeleton` | Loading states |
| `Avatar` | User indicators |
| `Alert` | Sync errors, warnings |

### Installation Commands

```bash
bunx --bun @react-native-reusables/cli@latest add button
bunx --bun @react-native-reusables/cli@latest add card
bunx --bun @react-native-reusables/cli@latest add dialog
bunx --bun @react-native-reusables/cli@latest add input
bunx --bun @react-native-reusables/cli@latest add badge
bunx --bun @react-native-reusables/cli@latest add progress
bunx --bun @react-native-reusables/cli@latest add tabs
bunx --bun @react-native-reusables/cli@latest add skeleton
bunx --bun @react-native-reusables/cli@latest add avatar
bunx --bun @react-native-reusables/cli@latest add alert
```

---

## Construction Site UX Guidelines

### Touch Targets
- Minimum 48x48px (preferably 56x56px)
- Workers wear gloves - larger is better
- Spacing between targets: 8px minimum

### Visual Design
- High contrast (outdoor sunlight)
- Large text (16px minimum body)
- Clear icons with labels
- Status colors: Green (complete), Yellow (progress), Red (issue)

### Workflows
- Minimal text entry (voice-to-text future)
- Quick camera access (1 tap from marker)
- Offline-first (queue everything)
- Sync status always visible

---

## Summary Dashboard

| Phase | Backend Hours | Mobile Hours | Testing Hours |
|-------|---------------|--------------|---------------|
| Week 1 | 8 | 32 | 4 |
| Week 2 | 12 | 28 | 4 |
| Week 3 | 10 | 30 | 4 |
| Week 4 | 6 | 24 | 14 |
| **Total** | **36** | **114** | **26** |

**Grand Total: ~176 hours (4.4 weeks at 40 hrs/week)**

---

## Next Steps

1. **Day 1 Morning:** Run Expo DOM Components proof-of-concept with OpenSeadragon
2. **Day 1 Afternoon:** Set up React Native Reusables and base navigation
3. **Day 2:** Backend schema migration + pending-review endpoint
4. **Day 3-5:** Complete Week 1 mobile features

**Critical Validation:** If Expo DOM Components + OpenSeadragon works on Day 1, we're on track. If not, evaluate alternatives immediately.
