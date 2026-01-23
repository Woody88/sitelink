# Agent Orchestration Guide for Navigation Refactor

**Epic:** sitelink-7i3 - Navigation & UX Refactor
**For Use By:** AI agents implementing the navigation refactor
**Context Preservation:** Use this guide when starting a new session or agent

---

## Master Orchestration Prompt

Use this prompt to orchestrate the entire navigation refactor with subagents:

```
I need to implement the SiteLink navigation refactor (Epic: sitelink-7i3).

CONTEXT:
- Primary spec: docs/design/NAVIGATION_UX_SPEC.md
- Implementation roadmap: docs/design/IMPLEMENTATION_ROADMAP.md
- Design inspiration: docs/design/inspiration/wealthsimple/
- Existing design system: docs/sitelink/DESIGN_SYSTEM.md

CURRENT TASK: [INSERT BEAD ID, e.g., sitelink-576]

REQUIREMENTS:
1. Follow the component hierarchy in NAVIGATION_UX_SPEC.md exactly
2. Extract business logic to hooks (no logic in components)
3. Use memo() and useCallback to prevent unnecessary re-renders
4. All touch targets must be >= 48px (glove-friendly)
5. Use dark theme color tokens (no hardcoded colors)
6. Animations must use native driver for 60fps
7. Components must be < 150 lines (split if larger)

WORKFLOW:
Phase 1 - Research:
- Use Explore agent to understand current implementation
- Use Context7 agent to get latest library docs (expo-camera, react-native-reanimated, etc.)

Phase 2 - Planning:
- Use Plan agent to design implementation steps
- Break down into small, testable components
- Identify potential performance issues

Phase 3 - Execution:
- Follow the plan from Phase 2
- Reference NAVIGATION_UX_SPEC.md for exact specifications
- Consult Wealthsimple screenshots for visual patterns

Phase 4 - Review:
- Use codereview agent to review implementation
- Use unit-testing:test-automator for critical paths (camera capture, state persistence)
- Verify against quality gates in IMPLEMENTATION_ROADMAP.md

Please start with Phase 1 research for task [BEAD_ID].
```

---

## Agent Selection Matrix

Use this table to select the right agent for each phase of work:

| Phase                      | Agent Type                    | When to Use                                                     | Example                                                    |
| -------------------------- | ----------------------------- | --------------------------------------------------------------- | ---------------------------------------------------------- |
| **Research - Codebase**    | `Explore`                     | Understand current navigation structure, find existing patterns | "How is tab navigation currently implemented?"             |
| **Research - Libraries**   | `Context7`                    | Get latest API docs for expo-camera, reanimated, etc.           | "Get expo-camera API for React Native"                     |
| **Research - UX Patterns** | `WebSearch`                   | Find best practices for mobile gestures, accessibility          | "Best practices for swipeable tabs in React Native"        |
| **Planning**               | `Plan`                        | Design implementation strategy, break down into steps           | "Plan implementation of Camera tab with state persistence" |
| **Execution**              | _(You)_                       | Write code following the plan                                   | Direct implementation                                      |
| **Review - Code Quality**  | `codereview`                  | Review for performance, patterns, best practices                | "Review Camera tab implementation"                         |
| **Review - Testing**       | `unit-testing:test-automator` | Generate tests for critical functionality                       | "Create tests for camera state persistence"                |
| **Debugging**              | `unit-testing:debugger`       | Investigate errors, test failures, unexpected behavior          | "Camera state not persisting across tab switches"          |

---

## Task-Specific Agent Workflows

### Task: sitelink-576 - Workspace Navigation Refactor

#### Phase 1: Research (30 min)

**Explore Agent:**

```
Analyze the current project workspace navigation implementation:
- Current route structure in apps/mobile/app/project/[id]/
- How tabs are currently implemented
- What components handle navigation
- Dependencies on react-navigation or expo-router

Provide:
1. File paths of key navigation components
2. Current tab structure
3. Dependencies that need to change
4. Potential breaking changes
```

**Context7 Agent:**

```
Get documentation for:
1. expo-router file-based routing (latest)
2. react-native-pager-view or react-native-tab-view for swipeable tabs
3. React Navigation stack navigation patterns

Focus on:
- How to implement swipeable content tabs
- Header customization with back button
- Tab indicator animation
```

#### Phase 2: Planning (30 min)

**Plan Agent:**

```
Plan the implementation of workspace navigation refactor based on:
- Spec: docs/design/NAVIGATION_UX_SPEC.md Section 3.2
- Current implementation from Explore agent findings
- Library APIs from Context7 agent

Design:
1. New route structure (/project/[id]/_layout.tsx)
2. Component breakdown (WorkspaceHeader, WorkspaceTabs, TabContent)
3. Migration path from old to new structure
4. State management for active tab
5. Animation approach for tab indicator

Identify:
- Files to create
- Files to delete
- Potential performance issues
- Testing strategy
```

#### Phase 3: Execution (2-3 days)

Follow the plan. Key checkpoints:

**Checkpoint 1: Header Component**

- Create `components/workspace/workspace-header.tsx`
- Back button with "← Projects" label
- Project name (not tappable)
- NotificationBell and SettingsGear icons
- Test: Back button navigates to /projects

**Checkpoint 2: Tab Bar Component**

- Create `components/workspace/workspace-tabs.tsx`
- Three tabs: Plans, Camera, Activity
- Tab indicator (animated underline)
- Test: Tapping tab changes content

**Checkpoint 3: Tab Content**

- Create `components/workspace/tab-content.tsx`
- PagerView or similar for swipeable content
- Test: Content changes when tab switches

**Checkpoint 4: Integration**

- Update `app/project/[id]/_layout.tsx`
- Remove old `(tabs)/_layout.tsx`
- Test: Full navigation flow

#### Phase 4: Review (1 day)

**codereview Agent:**

```
Review the workspace navigation implementation:

Files to review:
- app/project/[id]/_layout.tsx
- components/workspace/workspace-header.tsx
- components/workspace/workspace-tabs.tsx
- components/workspace/tab-content.tsx

Check for:
1. Component size (must be < 150 lines)
2. Business logic extraction (should be in hooks)
3. Memo usage to prevent re-renders
4. useCallback for event handlers
5. Touch target sizes (>= 48px)
6. Dark theme color tokens usage
7. TypeScript strict mode compliance

Verify against:
- docs/design/NAVIGATION_UX_SPEC.md Section 3.2
- docs/design/NAVIGATION_UX_SPEC.md Section 8 (Implementation Guidelines)
```

**unit-testing:test-automator Agent:**

```
Generate tests for workspace navigation:

Test cases:
1. Back button navigates to /projects
2. Tapping each tab changes content
3. Active tab indicator position is correct
4. Header shows correct project name
5. NotificationBell and SettingsGear render

Use React Native Testing Library with:
- render() for component testing
- fireEvent for interactions
- waitFor() for async state changes
```

---

### Task: sitelink-sku - Camera Tab Implementation

#### Phase 1: Research (30 min)

**Context7 Agent:**

```
Get latest documentation for:
1. expo-camera - Camera component API, permissions, photo capture
2. expo-file-system - Local file storage for offline photos
3. zustand - State management with persistence
4. react-native-reanimated - Shutter button press animation

Focus on:
- How to capture photos with expo-camera
- Proper permission handling
- Persisting state to AsyncStorage with Zustand
- Spring animations for button press
```

**Explore Agent:**

```
Find existing implementations in the codebase:
- Any existing camera code
- LiveStore photo capture events (photoCaptured, photoMarkedAsIssue)
- Existing UI patterns for buttons and toggles
- How callouts are currently stored/queried
```

#### Phase 2: Planning (45 min)

**Plan Agent:**

```
Plan the Camera tab implementation based on:
- Spec: docs/design/NAVIGATION_UX_SPEC.md Section 3.3
- Spec: docs/sitelink/concrete-flows.md Section 1 (Camera UI)

Component hierarchy to create:
1. CameraTab (screen component)
2. CameraViewfinder (expo-camera wrapper)
3. CameraControls (shutter, voice, gallery buttons)
4. ShutterButton (72pt, animated)
5. VoiceNoteButton (hold to record)
6. IssueToggle (toggle switch)
7. CalloutLinkBar (shows linked callout)

State management:
- Create stores/camera-store.ts (Zustand)
- Persist: linkedCalloutId, linkedCalloutLabel, isIssueMode
- Create hooks/use-capture-photo.ts (LiveStore event)

Animation requirements:
- Shutter button press: scale spring animation
- Issue toggle: background color transition
- Capture flash: opacity sequence animation

Implementation order:
1. Create Zustand store
2. Create CameraViewfinder component
3. Create ShutterButton with animation
4. Create IssueToggle
5. Integrate with LiveStore events
6. Test state persistence
```

#### Phase 3: Execution (3-4 days)

**Checkpoint 1: Zustand Store**

```typescript
// stores/camera-store.ts
interface CameraState {
  linkedCalloutId: string | null
  linkedCalloutLabel: string | null
  isIssueMode: boolean
  setLinkedCallout: (id: string | null, label: string | null) => void
  toggleIssueMode: () => void
  resetIssueMode: () => void
}
```

**Checkpoint 2: Camera Viewfinder**

- Implement expo-camera
- Request permissions
- Handle camera ready state
- Test: Camera shows video feed

**Checkpoint 3: Shutter Button**

- 72pt circular button
- Spring press animation
- Red color when isIssueMode is true
- Test: Animation smooth at 60fps

**Checkpoint 4: Issue Toggle**

- Toggle button component
- Updates Zustand store
- Resets after photo capture
- Test: State changes correctly

**Checkpoint 5: Photo Capture**

```typescript
// hooks/use-capture-photo.ts
function useCapturePhoto() {
  const store = useStore()
  const { isIssueMode, linkedCalloutId, resetIssueMode } = useCameraStore()

  return useCallback(async () => {
    const photo = await cameraRef.current.takePictureAsync()
    const id = crypto.randomUUID()
    const localPath = await saveLocally(photo.uri, id)

    store.commit(
      events.photoCaptured({
        id,
        projectId: currentProjectId,
        markerId: linkedCalloutId,
        localPath,
        isIssue: isIssueMode,
        capturedAt: new Date(),
      }),
    )

    resetIssueMode() // Reset after capture
  }, [isIssueMode, linkedCalloutId])
}
```

**Checkpoint 6: State Persistence Test**

- Capture photo in Camera tab
- Switch to Plans tab
- Switch back to Camera tab
- Verify: linkedCallout and isIssueMode preserved

#### Phase 4: Review (1 day)

**codereview Agent:**

```
Review Camera tab implementation:

Files:
- components/camera/camera-viewfinder.tsx
- components/camera/camera-controls.tsx
- components/camera/shutter-button.tsx
- components/camera/issue-toggle.tsx
- stores/camera-store.ts
- hooks/use-capture-photo.ts

Focus on:
1. Permission handling for camera access
2. State persistence working correctly
3. Issue mode resets after capture
4. Animation performance (60fps)
5. Memory leaks (camera cleanup on unmount)
6. Error handling (camera not available, storage full)
```

**unit-testing:debugger Agent** (if state not persisting):

```
Debug camera state persistence issue:

Expected behavior:
- User sets linked callout to "5/A7"
- User enables issue mode
- User switches to Plans tab
- User switches back to Camera tab
- Linked callout is still "5/A7", issue mode still enabled

Steps to debug:
1. Check Zustand persist config
2. Verify AsyncStorage is initialized
3. Check if resetIssueMode is being called incorrectly
4. Add console logs to track state changes
5. Verify useCameraStore is being called in Camera component
```

---

### Task: sitelink-ju1 - Activity Tab Implementation

#### Phase 1: Research (30 min)

**Explore Agent:**

```
Find existing photo queries and LiveStore patterns:
- How photos are currently queried from LiveStore
- Existing timeline/list implementations
- Any existing summary or AI features
- Photo grouping logic

Provide:
- LiveStore query examples
- Photo data structure
- Callout reference structure
```

**Context7 Agent:**

```
Get documentation for:
1. React Native SectionList - Grouped list rendering
2. React Native FlatList - Horizontal photo scrolling
3. expo-image - Image caching and optimization
4. date-fns - Date formatting and grouping

Focus on:
- SectionList with getItemLayout for performance
- Horizontal FlatList patterns
- Image caching strategies
```

#### Phase 2: Planning (45 min)

**Plan Agent:**

```
Plan Activity tab implementation based on:
- Spec: docs/design/NAVIGATION_UX_SPEC.md Section 3.4
- Spec: docs/sitelink/concrete-flows.md Section 3 (AI Summary)

Component hierarchy:
1. ActivityTab (screen component)
2. SummaryCard (AI summary at top)
3. PhotoTimeline (SectionList)
4. TimelineSection (date group)
5. CalloutGroup (photos by callout)
6. PhotoThumbnail (individual photo)

Data layer:
- Create hooks/use-photos-timeline.ts (LiveStore query)
- Create hooks/use-daily-summary.ts (API call placeholder)
- Group photos by: date (primary) → callout (secondary)

Layout:
- SummaryCard: fixed height, collapsible
- Timeline: SectionList with sticky headers
- Photos: Horizontal FlatList per callout group

Implementation order:
1. Create photo timeline query hook
2. Create data grouping logic (useMemo)
3. Create PhotoTimeline with SectionList
4. Create PhotoThumbnail component
5. Create SummaryCard placeholder
6. Test real-time updates
```

#### Phase 3: Execution (3-4 days)

**Checkpoint 1: Timeline Query**

```typescript
// hooks/use-photos-timeline.ts
export function usePhotosTimeline(projectId: string) {
  const photos = useQuery(tables.photos.where({ projectId }).orderBy("capturedAt", "desc"))

  return useMemo(() => {
    // Group by date
    const byDate = groupBy(photos, (p) => format(p.capturedAt, "yyyy-MM-dd"))

    // Within each date, group by callout
    return Object.entries(byDate).map(([date, datePhotos]) => ({
      date,
      data: groupBy(datePhotos, (p) => p.markerId),
    }))
  }, [photos])
}
```

**Checkpoint 2: PhotoTimeline Component**

- SectionList with date sections
- Sticky section headers
- CalloutGroup with horizontal photo scroll
- Test: Scrolling is smooth

**Checkpoint 3: PhotoThumbnail**

- expo-image for caching
- Issue badge overlay (if isIssue)
- Voice note badge (if has voice note)
- Timestamp display
- Test: Images load efficiently

**Checkpoint 4: SummaryCard**

- Placeholder for AI-generated content
- "Generate Summary" button
- Loading state
- Copy/Share buttons
- Test: Button triggers API call

**Checkpoint 5: Real-time Updates**

- Capture photo in Camera tab
- Switch to Activity tab
- Verify: New photo appears in timeline
- Test: LiveStore reactive query works

#### Phase 4: Review (1 day)

**codereview Agent:**

```
Review Activity tab implementation:

Files:
- components/activity/summary-card.tsx
- components/activity/photo-timeline.tsx
- components/activity/timeline-section.tsx
- components/activity/callout-group.tsx
- components/activity/photo-thumbnail.tsx
- hooks/use-photos-timeline.ts

Performance checks:
1. SectionList has getItemLayout defined
2. PhotoThumbnail uses memo
3. Horizontal FlatList (not map) for photos
4. expo-image with proper cache policy
5. useMemo for data grouping
6. No inline function props

Verify:
- Timeline updates when photo captured
- Grouping logic correct
- Images load without janky scrolling
```

---

## Context Preservation Pattern

When starting a new session or agent, use this pattern to preserve context:

### For Continuing Work on a Task

```
I'm continuing work on [TASK_ID: e.g., sitelink-576].

CONTEXT RECAP:
- Epic: sitelink-7i3 (Navigation & UX Refactor)
- Current task: [BRIEF DESCRIPTION]
- Previous session completed: [CHECKPOINTS DONE]
- Next checkpoint: [WHAT'S NEXT]

SPECS:
- Primary: docs/design/NAVIGATION_UX_SPEC.md Section [X]
- Roadmap: docs/design/IMPLEMENTATION_ROADMAP.md

CURRENT STATUS:
[Describe what's working and what's not]

Please help me with: [SPECIFIC ASK]
```

### For Starting a New Task

```
I'm starting task [TASK_ID] from the navigation refactor epic.

DEPENDENCIES:
- [LIST DEPENDENT TASKS AND THEIR STATUS]

WORKFLOW:
1. Research phase: Use Explore + Context7 agents
2. Planning phase: Use Plan agent
3. Execution: Follow plan
4. Review: Use codereview + testing agents

Please start with research phase for [TASK_ID].
Refer to:
- docs/design/NAVIGATION_UX_SPEC.md Section [X]
- docs/design/IMPLEMENTATION_ROADMAP.md
```

---

## Common Patterns for All Tasks

### Pattern 1: Component Creation

**Always follow this structure:**

```typescript
// components/[domain]/[component-name].tsx

import { memo, useCallback, useMemo } from 'react'
import { View, Text, Pressable } from 'react-native'
import { colors, spacing, typography } from '@/lib/theme' // Use tokens

interface [ComponentName]Props {
  // Props interface
}

export const [ComponentName] = memo(function [ComponentName](props: [ComponentName]Props) {
  // Extract business logic to hooks
  const data = useCustomHook()

  // Stabilize callbacks
  const handlePress = useCallback(() => {
    // ...
  }, [deps])

  // Compute derived state
  const derivedValue = useMemo(() => {
    // ...
  }, [deps])

  return (
    <View className="...">
      {/* JSX using NativeWind classes */}
    </View>
  )
})
```

### Pattern 2: LiveStore Queries

```typescript
// hooks/use-[entity-name].ts

import { useQuery } from '@livestore/react'
import { tables } from '@sitelink/domain'

export function use[EntityName](filters: FilterType) {
  return useQuery(
    tables.[entity]
      .where(filters)
      .orderBy('createdAt', 'desc')
  )
}
```

### Pattern 3: Event Commits

```typescript
// hooks/use-[action-name].ts

import { useStore } from '@livestore/react'
import { events } from '@sitelink/domain'
import { useCallback } from 'react'

export function use[ActionName]() {
  const store = useStore()

  return useCallback(async (params: ParamsType) => {
    // Perform side effects (save files, etc.)
    const result = await doSideEffect(params)

    // Commit event to LiveStore
    store.commit(events.[eventName]({
      ...params,
      result,
    }))

    return result
  }, [store])
}
```

### Pattern 4: Animations

```typescript
// Use react-native-reanimated

import { useSharedValue, withSpring, withTiming } from "react-native-reanimated"

// For smooth gestures - use shared values
const translateX = useSharedValue(0)

// For spring physics
const scale = useSharedValue(1)
const pressIn = () => {
  scale.value = withSpring(0.9, { damping: 10, stiffness: 400 })
}
const pressOut = () => {
  scale.value = withSpring(1, { damping: 15, stiffness: 300 })
}

// For color transitions
const bgColor = useSharedValue("#38383A")
const toggleColor = (isActive: boolean) => {
  bgColor.value = withTiming(isActive ? "#FF453A" : "#38383A", { duration: 150 })
}
```

---

## Emergency Debugging Workflow

If stuck for >1 hour:

1. **Use `unit-testing:debugger` agent:**

```
Debug this issue: [DESCRIBE PROBLEM]

Expected: [WHAT SHOULD HAPPEN]
Actual: [WHAT IS HAPPENING]
Steps to reproduce: [STEPS]

Files involved:
- [FILE PATHS]

Please investigate and suggest fixes.
```

2. **Simplify the implementation:**

- Remove animations temporarily
- Use static data instead of LiveStore queries
- Remove memo/useCallback
- Get it working first, optimize later

3. **Consult the spec:**

- Re-read NAVIGATION_UX_SPEC.md relevant section
- Check if you're implementing the right thing
- Look at Wealthsimple screenshots for clarity

4. **Ask for help:**

- Post issue in beads with specific error
- Tag with relevant labels
- Include code snippets and error messages

---

## Success Metrics

Track these for each task:

- [ ] All components < 150 lines
- [ ] No business logic in components (extracted to hooks)
- [ ] All touch targets >= 48px
- [ ] Animations at 60fps (use Performance Monitor)
- [ ] Dark theme tokens used (no hardcoded colors)
- [ ] TypeScript strict mode passing
- [ ] codereview agent approves
- [ ] Tests passing (if applicable)

---

_Last Updated: January 4, 2026_
