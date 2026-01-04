# SiteLink Navigation Refactor - Implementation Roadmap

**Epic:** sitelink-7i3 - Navigation & UX Refactor
**Spec Reference:** `docs/design/NAVIGATION_UX_SPEC.md`
**Created:** January 4, 2026

---

## Implementation Order (Recommended)

### Phase 1: Foundation (Week 1-2)

**Priority:** Get the core navigation structure in place

#### 1.1 Workspace Navigation (P1 - CRITICAL PATH)
**Task:** sitelink-576 - Refactor project workspace navigation structure
**Why First:** Unblocks all other workspace tasks (Camera, Activity, gestures)
**Effort:** 3-5 days
**Deliverables:**
- New route: `/project/[id]/_layout.tsx` with swipeable tabs
- Components: WorkspaceHeader, WorkspaceTabs, TabContent
- Remove old nested tabs structure
- Back arrow navigation working

**Success Criteria:**
- [ ] Can navigate Projects → Workspace → Back to Projects
- [ ] Three tabs visible: Plans, Camera, Activity
- [ ] Tab switching works (tap only, gestures come later)
- [ ] No bottom tab bar

**Dependencies:** None - start immediately

---

#### 1.2 Projects Screen Update (P2 - PARALLEL WORK)
**Task:** sitelink-auf - Update Projects screen with filter chips
**Why Parallel:** Independent of workspace refactor
**Effort:** 2-3 days
**Deliverables:**
- Horizontal scrollable filter chips (All, Active, Completed, Archived)
- NotificationBell component with badge
- ProfileAvatar component
- Updated ProjectCard layout

**Success Criteria:**
- [ ] Filter chips scroll horizontally
- [ ] Tapping chip filters project list
- [ ] Selected chip has filled background
- [ ] Counts shown in parentheses

**Dependencies:** None - can work in parallel with 1.1

---

### Phase 2: Tab Content (Week 2-3)

Once workspace navigation (sitelink-576) is complete:

#### 2.1 Camera Tab (P1)
**Task:** sitelink-sku - Implement Camera tab with state persistence
**Depends On:** sitelink-576 (workspace navigation)
**Effort:** 4-5 days
**Deliverables:**
- Camera viewfinder with expo-camera
- Issue toggle with red shutter mode
- Voice note button (hold to record)
- Callout link bar with change button
- Zustand store for camera state persistence

**Success Criteria:**
- [ ] Camera opens and captures photos
- [ ] Issue toggle changes shutter to red
- [ ] Linked callout persists when switching tabs
- [ ] Issue mode resets after capture
- [ ] Voice note recording works

**Dependencies:** sitelink-576 must be complete

---

#### 2.2 Activity Tab (P1)
**Task:** sitelink-ju1 - Build Activity tab with AI summary and photo timeline
**Depends On:** sitelink-576 (workspace navigation)
**Effort:** 4-5 days
**Deliverables:**
- AI Summary card (with placeholder/loading state)
- Photo timeline grouped by date + callout
- Filter button for timeline
- Copy/Share buttons for summary

**Success Criteria:**
- [ ] Summary card visible at top
- [ ] Timeline shows photos grouped by callout
- [ ] Horizontal scroll for photos within callout group
- [ ] Timeline updates in real-time as photos are captured
- [ ] "Generate Summary" button calls placeholder API

**Dependencies:** sitelink-576 must be complete

---

### Phase 3: Supporting Features (Week 3-4)

#### 3.1 Notifications Screen (P2)
**Task:** sitelink-dbw - Create Notifications screen and bell component
**Depends On:** sitelink-576 (for header integration)
**Effort:** 2-3 days
**Deliverables:**
- NotificationBell component with unread badge
- Notifications screen with grouped list
- Notification types with icons/colors
- Stack navigation route

**Success Criteria:**
- [ ] Bell icon shows in workspace header
- [ ] Badge shows unread count
- [ ] Tapping bell opens notifications screen
- [ ] Notifications grouped by Today/This Week/Earlier
- [ ] Unread indicator (blue dot) works

**Dependencies:** sitelink-576 for header integration

---

#### 3.2 Settings Refactor (P2)
**Task:** sitelink-bb2 - Refactor Settings to stack navigation
**Effort:** 2-3 days
**Deliverables:**
- Settings as stack screen at `/settings`
- Gear icon in workspace header
- Profile avatar in Projects header
- Migrated settings content

**Success Criteria:**
- [ ] Gear icon opens Settings
- [ ] Profile avatar opens Settings
- [ ] All existing settings functionality preserved
- [ ] Proper back navigation

**Dependencies:** None - can be done independently

---

### Phase 4: Gestures & Polish (Week 4-5)

#### 4.1 Swipe Gestures for Tabs (P2)
**Task:** sitelink-e4j - Implement swipe gestures for tab navigation
**Depends On:** sitelink-576 (workspace tabs must exist)
**Effort:** 2-3 days
**Deliverables:**
- Pan gesture handler for horizontal swipes
- Tab indicator animation with spring physics
- Smooth 60fps transitions

**Success Criteria:**
- [ ] Swipe left/right switches tabs
- [ ] Tab indicator follows finger during swipe
- [ ] Smooth spring animation on release
- [ ] 30% threshold to trigger tab change

**Dependencies:** sitelink-576, ideally after Camera and Activity are built

---

#### 4.2 Back Gesture (P3 - OPTIONAL)
**Task:** sitelink-aq5 - Add back gesture navigation from workspace
**Depends On:** sitelink-576
**Effort:** 1-2 days
**Deliverables:**
- Slide-from-left edge gesture
- Overlay reveal animation
- 40% threshold to go back

**Success Criteria:**
- [ ] Swipe from left edge reveals overlay
- [ ] Releasing past threshold navigates back
- [ ] Smooth animation

**Dependencies:** sitelink-576

**Note:** This is a power-user feature. Back arrow is primary navigation.

---

## Parallel Work Opportunities

To maximize velocity, these tasks can be done simultaneously:

### Week 1-2 Parallel Tracks:
- **Track A:** Workspace navigation refactor (sitelink-576)
- **Track B:** Projects screen filter chips (sitelink-auf)
- **Track C:** Settings refactor (sitelink-bb2) - if separate developer available

### Week 2-3 Parallel Tracks:
- **Track A:** Camera tab (sitelink-sku)
- **Track B:** Activity tab (sitelink-ju1)

Both depend on workspace navigation being done first.

### Week 3-4 Parallel Tracks:
- **Track A:** Notifications screen (sitelink-dbw)
- **Track B:** Swipe gestures (sitelink-e4j)

---

## Task Dependency Graph

```
START
  │
  ├─→ [P1] sitelink-576: Workspace Navigation (CRITICAL PATH)
  │     │
  │     ├─→ [P1] sitelink-sku: Camera Tab
  │     ├─→ [P1] sitelink-ju1: Activity Tab
  │     ├─→ [P2] sitelink-dbw: Notifications
  │     ├─→ [P2] sitelink-e4j: Swipe Gestures
  │     └─→ [P3] sitelink-aq5: Back Gesture
  │
  ├─→ [P2] sitelink-auf: Projects Filter Chips (INDEPENDENT)
  │
  └─→ [P2] sitelink-bb2: Settings Refactor (INDEPENDENT)
```

---

## Critical Path

The fastest route to a working implementation:

```
Day 1-5:   sitelink-576 (Workspace Navigation)
Day 3-7:   sitelink-auf (Projects Filters) - PARALLEL
Day 6-10:  sitelink-sku (Camera Tab)
Day 11-15: sitelink-ju1 (Activity Tab)
Day 16-18: sitelink-dbw (Notifications)
Day 19-21: sitelink-e4j (Swipe Gestures)
```

**Total:** ~21 days for core functionality

---

## Quality Gates

Before marking each task complete:

### Code Quality
- [ ] All components < 150 lines
- [ ] Business logic extracted to hooks
- [ ] TypeScript strict mode passing
- [ ] No hardcoded colors (use tokens)
- [ ] Touch targets >= 48px verified

### Performance
- [ ] FlatList used for all lists
- [ ] Components memoized where appropriate
- [ ] Callbacks wrapped in useCallback
- [ ] Animations use native driver
- [ ] 60fps maintained during gestures

### Testing
- [ ] Run on iOS simulator
- [ ] Run on Android emulator
- [ ] Test with gloved hands (thick tap targets)
- [ ] Test offline mode
- [ ] Test state persistence

### Review
- [ ] Use `codereview` agent to review code
- [ ] Check against NAVIGATION_UX_SPEC.md
- [ ] Verify Wealthsimple patterns followed

---

## Agent Workflow for Each Task

See `AGENT_ORCHESTRATION.md` for detailed agent usage patterns.

**Quick Reference:**
1. **Research:** Use `Explore` + `Context7` agents
2. **Planning:** Use `Plan` agent for implementation strategy
3. **Execution:** Follow plan, consult spec frequently
4. **Review:** Use `codereview` + `unit-testing:test-automator` agents

---

## When Things Go Wrong

### If stuck on workspace navigation (sitelink-576):
- Consult `Explore` agent to understand current tab implementation
- Reference React Navigation docs via `Context7`
- Check Wealthsimple screenshots for layout inspiration
- Simplify: Start with static tabs, add swipe later

### If camera state isn't persisting:
- Review Zustand persistence setup
- Check AsyncStorage initialization
- Verify store is properly wrapped in provider
- Use `debug` agent to investigate state issues

### If animations are janky:
- Ensure using `useNativeDriver: true`
- Move to Reanimated worklets
- Profile with React DevTools
- Reduce complexity of animated components

---

## Resources

- **Primary Spec:** `docs/design/NAVIGATION_UX_SPEC.md`
- **Design System:** `docs/sitelink/DESIGN_SYSTEM.md`
- **Wealthsimple Inspiration:** `docs/design/inspiration/wealthsimple/`
- **PRD Reference:** `docs/sitelink/prd.md`
- **Concrete Flows:** `docs/sitelink/concrete-flows.md`

---

## Completion Checklist

Mark these off as you complete each phase:

### Phase 1: Foundation
- [ ] sitelink-576: Workspace navigation complete
- [ ] sitelink-auf: Projects filter chips complete

### Phase 2: Tab Content
- [ ] sitelink-sku: Camera tab complete
- [ ] sitelink-ju1: Activity tab complete

### Phase 3: Supporting Features
- [ ] sitelink-dbw: Notifications screen complete
- [ ] sitelink-bb2: Settings refactor complete

### Phase 4: Gestures & Polish
- [ ] sitelink-e4j: Swipe gestures complete
- [ ] sitelink-aq5: Back gesture complete (optional)

### Final Integration
- [ ] All tabs working in workspace
- [ ] Navigation flows smoothly
- [ ] Animations at 60fps
- [ ] Dark theme consistent
- [ ] Touch targets verified
- [ ] Epic sitelink-7i3 closed

---

*Last Updated: January 4, 2026*
