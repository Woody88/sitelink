# Mobile Development Kickoff Prompt

Copy and paste this into Claude Code to start your mobile development plan:

```
Use sitelink-orchestrator to create a comprehensive 4-week mobile app development plan with these CRITICAL features:

READ FIRST: docs/MOBILE_FEATURES.md contains detailed feature specifications

CORE FEATURES (Priority Order):

1. PLAN VIEWING & NAVIGATION
   - OpenSeadragon deep zoom viewer (DZI tiles)
   - Tap callout → Navigate to referenced sheet
   - Highlight target marker after navigation
   - Back button returns to exact position
   - Offline caching for viewed plans

2. CALLOUT POSITION ADJUSTMENT
   - Review list showing markers with confidence < 70%
   - Long-press marker → Drag to correct position
   - Confirm/Reject/Skip actions
   - Bulk review operations
   - Offline queue for adjustments (sync when online)

3. MEDIA WORKFLOW (Sequence-Based)
   - Capture photos/videos linked to callouts
   - 4 states: Start → In Progress → Issue/Incident → Complete
   - Timeline view showing all media for a callout
   - State-based filtering and notifications
   - Offline capture with background sync

PHASE 1: BACKEND API ASSESSMENT
Delegate to api-developer:
- Audit existing endpoints in packages/backend/src
- Document authentication (better-auth integration)
- Identify API GAPS for mobile features:
  * Marker position update endpoint
  * Marker review endpoints (confirm/reject)
  * Media upload with state workflow
  * Media timeline retrieval
  * Markers needing review (confidence < 70%)
- Provide API specifications for missing endpoints
- Timeline: What can be built in Week 1 vs Week 2+

PHASE 2: OPENSEADRAGON INTEGRATION
Delegate to openseadragon-specialist:
- Verify DZI tile generation in packages/backend
- Design WebView integration for Expo
- Plan marker overlay system:
  * Clickable markers (circles + triangles)
  * Draggable markers for position adjustment
  * Visual feedback (pulsing, crosshair)
  * Highlight on navigation
- Design navigation flow (tap marker → jump to sheet)
- Performance optimization for large plans
- Offline tile caching strategy

PHASE 3: MOBILE APP ARCHITECTURE
Delegate to mobile-architect:
- Review packages/mobile current state
- Design screen structure:
  * Projects → Plans → Plan Viewer
  * Marker Review List
  * Marker Details Modal
  * Media Capture Flow
  * Media Timeline View
- Plan state management:
  * React Query for server data
  * AsyncStorage for offline data
  * Media upload queue
  * Position adjustment queue
- Design offline-first architecture
- UX considerations for construction sites:
  * Large touch targets (workers wear gloves)
  * High contrast (outdoor sunlight)
  * Quick camera access
  * Minimal text entry

PHASE 4: DATABASE & MEDIA STORAGE
Delegate to database-engineer:
- Review current schema for mobile needs
- Design media table schema:
  * State field (start/progress/issue/complete)
  * Sequence ordering per marker
  * Timeline queries
- Design marker adjustment tracking:
  * Original vs adjusted position
  * Audit trail (who, when)
- Plan indexes for mobile queries:
  * Markers by confidence (for review list)
  * Media timeline by marker
- R2 storage structure for media

PHASE 5: TESTING STRATEGY
Delegate to test-orchestrator:
- Plan Maestro E2E tests:
  * Plan viewing and navigation
  * Marker adjustment flow
  * Media capture workflow
  * Offline sync scenarios
- Unit tests for:
  * OpenSeadragon integration
  * State machine (media workflow)
  * Queue processing (offline)
- Integration tests for APIs

DELIVERABLES:

Week 1 Plan:
- API endpoints to build first
- Basic plan viewer with clickable markers
- Navigation between sheets
- Success criteria

Week 2 Plan:
- Marker review list
- Position adjustment UI
- API integration for adjustments
- Success criteria

Week 3 Plan:
- Camera integration
- Media workflow (state selection)
- Upload with state tracking
- Success criteria

Week 4 Plan:
- Media timeline view
- Offline sync completion
- Bulk review operations
- E2E testing
- Success criteria

CONSTRAINTS:
- Use Expo (required for OpenSeadragon)
- Effect-TS HttpApiBuilder for APIs (NOT Hono!)
- Construction site UX (large buttons, high contrast)
- Offline-first (poor connectivity on job sites)
- Must work with existing detection (80% accuracy)

OUTPUT FORMAT:
1. API Gap Analysis (what exists, what's missing)
2. Technical Architecture Diagram
3. 4-Week Sprint Plan with clear dependencies
4. Risk Assessment & Mitigation
5. Success Metrics for each phase

Focus on getting a WORKING plan viewer with marker navigation in Week 1,
then add adjustment and media features progressively.
```
