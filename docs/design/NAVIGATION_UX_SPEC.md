# SiteLink Navigation & UX Specification

**Version:** 2.0
**Date:** January 4, 2026
**Status:** Revised - Ready for Implementation
**Design Inspiration:** Wealthsimple (see `/docs/design/inspiration/wealthsimple/`)

---

## Table of Contents

1. [Design Philosophy](#1-design-philosophy)
2. [Navigation Architecture](#2-navigation-architecture)
3. [Screen Specifications](#3-screen-specifications)
4. [Component Hierarchy](#4-component-hierarchy)
5. [Typography & Spacing](#5-typography--spacing)
6. [Motion & Animation](#6-motion--animation)
7. [State Management Patterns](#7-state-management-patterns)
8. [Implementation Guidelines](#8-implementation-guidelines)

---

## 1. Design Philosophy

### Guiding Principles for Construction Workers

| Principle                   | Application                                                                                              |
| --------------------------- | -------------------------------------------------------------------------------------------------------- |
| **Clarity Over Cleverness** | Obvious interactions. No hidden gestures as primary navigation. Large, clear tap targets (48px minimum). |
| **Action Over Destination** | Camera is an action (FAB), not a destination. Primary workflows are one-tap away.                        |
| **Support, Don't Dictate**  | Preserve state across view switches. Don't reset user context.                                           |
| **Design for Interruption** | Workers constantly switch between app and physical world. App must feel like picking up a tool.          |
| **Glove-First Interaction** | 48px minimum touch targets. Forgiving gestures. No precision required.                                   |

### Wealthsimple Patterns Adopted

| Pattern                     | Wealthsimple Usage                | SiteLink Adaptation                                                         |
| --------------------------- | --------------------------------- | --------------------------------------------------------------------------- |
| **Horizontal filter chips** | Transaction type filters          | Project status filters (All, Active, Completed, Archived) - **48px height** |
| **Segmented control**       | Two-option toggles                | Plans/Activity view switcher in project workspace                           |
| **Bottom sheet modals**     | Multi-level filter drill-down     | Notification actions, sheet discipline filter                               |
| **Subtle banners**          | Account alerts                    | Daily summary generation (no heavy card styling)                            |
| **Back arrow + title**      | Navigation header                 | `← Back to Projects` header in workspace                                    |
| **Contextual headers**      | Different headers per screen type | Global nav vs project nav vs detail nav                                     |
| **Dark theme**              | Full dark UI                      | Dark theme as default (construction site visibility)                        |

### Key Design Change: Camera as Action

**Previous:** Camera was a tab destination alongside Plans and Activity
**New:** Camera is a Floating Action Button (FAB) accessible from Plans and Activity views

**Rationale:**

- Camera is the **primary action**, not a browsing destination
- Construction workers need 1-tap photo capture
- FAB is ergonomic for gloved, one-handed use (bottom-right, thumb zone)
- Eliminates unnecessary navigation step in the core workflow

---

## 2. Navigation Architecture

### Route Structure

```
/
├── /projects                          # HOME - Projects list
│   └── (modal) CreateProjectModal
│
├── /project/[id]/                     # PROJECT WORKSPACE (layout)
│   ├── (view) plans                   # Plans view (segmented control)
│   ├── (view) activity                # Activity view (segmented control)
│   └── (modal) camera                 # Camera modal (triggered by FAB)
│
├── /notifications                     # NOTIFICATION CENTER (stack)
│
└── /settings                          # SETTINGS (stack)
    ├── /settings/profile
    ├── /settings/subscription
    ├── /settings/notifications
    └── /settings/members
```

### Navigation Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         APP LAUNCH                              │
│                             │                                   │
│                             ▼                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              /projects (HOME)                             │  │
│  │  ┌────────────────────────────────────────────────────┐   │  │
│  │  │  [🔔]        Projects            [👤 Profile]      │   │  │
│  │  ├────────────────────────────────────────────────────┤   │  │
│  │  │  [All] [Active] [Completed] [Archived] ← 48px      │   │  │
│  │  ├────────────────────────────────────────────────────┤   │  │
│  │  │  Riverside Apartments                      2h ago  │   │  │
│  │  │  📍 123 Main St, Denver, CO                     >  │───┼──┼──► Tap Project
│  │  │  ──────────────────────────────────────────────   │   │  │
│  │  │  Downtown Office                          1d ago  │   │  │
│  │  │  📍 456 Market St, San Francisco, CA        >     │   │  │
│  │  └────────────────────────────────────────────────────┘   │  │
│  └──────────────────────────────────────────────────────────┘  │
│              │                         │                        │
│              ▼ Tap Bell                ▼ Tap Profile            │
│      /notifications              /settings                      │
└─────────────────────────────────────────────────────────────────┘
                         │
                         ▼ Select Project
┌─────────────────────────────────────────────────────────────────┐
│                    PROJECT WORKSPACE                            │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  [← Back]  [ (Plans) | Activity ]          [ ⋯ Menu ]   │   │  Primary Nav
│  ├──────────────────────────────────────────────────────────┤   │
│  │  Riverside Apartments                                    │   │  Context Row
│  │  📍 123 Main St, Denver, CO                              │   │  (Sticky)
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌────────────────────────────────────────────┐                 │
│  │  [Plans View Content]                      │                 │
│  │   - PDF plan viewer                        │                 │
│  │   - Zoom, pan, marker overlay              │                 │
│  │                                             │                 │
│  │                              OR             │                 │
│  │                                             │                 │
│  │  [Activity View Content]                   │                 │
│  │   - Daily summary banner (subtle)          │                 │
│  │   - Chronological photo timeline           │                 │
│  │                                             │                 │
│  │                                    ┌─────┐ │                 │
│  │                                    │ 📷  │ │ ← FAB (56x56px) │
│  │                                    └─────┘ │                 │
│  └────────────────────────────────────────────┘                 │
└─────────────────────────────────────────────────────────────────┘
                         │
                         ▼ Tap FAB
┌─────────────────────────────────────────────────────────────────┐
│                    CAMERA MODAL                                 │
│  [Full-screen camera viewfinder]                                │
│  [Issue Toggle] [Shutter Button] [Gallery]                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Screen Specifications

### 3.1 Projects List (Home Screen)

**Route:** `/projects`
**Purpose:** Central hub for project access, global notifications, profile

#### Header Layout

```
┌────────────────────────────────────────────────────────┐
│  [🔔 48x48]        Projects         [👤 48x48]         │
└────────────────────────────────────────────────────────┘
```

#### Filter Chips (Redesigned for Glove Use)

```
┌────────────────────────────────────────────────────────┐
│  [ All (filled) ] [ Active ] [ Completed ] [ Archived ]│  ← 48px height
│  ← Spacing: 8px between chips                          │
└────────────────────────────────────────────────────────┘
```

**Filter Chip Specs:**

- Height: **48px** (was too small before)
- Padding: 16px horizontal, 12px vertical
- Border radius: 24px (full pill)
- Active state: Filled background (foreground color), text is background color
- Inactive state: Transparent background, text is muted-foreground
- Typography: 14px medium weight

#### Project List Item

```
┌────────────────────────────────────────────────────────┐
│  Riverside Apartments                       2h ago  >  │  ← 64px min height
│  📍 123 Main St, Denver, CO                            │
├────────────────────────────────────────────────────────┤  ← Separator
│  Downtown Office                           1 day ago > │
│  📍 456 Market St, San Francisco, CA                   │
└────────────────────────────────────────────────────────┘
```

**List Item Specs:**

- Min height: 64px
- Padding: 16px horizontal, 16px vertical
- Active state: `bg-muted/50`
- Typography:
  - Project name: 16px medium
  - Address: 14px regular, muted-foreground
  - Timestamp: 12px regular, muted-foreground

---

### 3.2 Project Workspace

**Route:** `/project/[id]/` (layout with view state)
**Purpose:** Unified workspace for viewing plans and activity within a project

#### Header Pattern (Two Rows)

**Row 1: Navigation & View Selector**

```
┌────────────────────────────────────────────────────────┐
│  [← Back]    [ (Plans) | Activity ]       [ ⋯ Menu ]   │  ← Sticky
└────────────────────────────────────────────────────────┘
```

**Component Specs:**

- Back button: 48x48px touch target, includes arrow + "Back" text
- Segmented control: 48px height, centered
  - Plans/Activity toggle
  - Selected state: Solid background
  - Unselected state: Transparent
- Menu (⋯): 48x48px touch target, opens project settings

**Row 2: Project Context**

```
┌────────────────────────────────────────────────────────┐
│  Riverside Apartments                                  │  ← Sticky
│  📍 123 Main St, Denver, CO                            │
└────────────────────────────────────────────────────────┘
```

**Context Row Specs:**

- Padding: 16px horizontal, 12px vertical
- Background: Subtle contrast from main content area
- Typography:
  - Project name: 16px semibold
  - Address: 14px regular, muted-foreground

#### Floating Action Button (FAB)

```
                                   ┌────────┐
                                   │   📷   │  ← 56x56px
                                   └────────┘
```

**FAB Specs:**

- Size: **56x56px** (exceeds 48px minimum)
- Position: Bottom-right, 16px from edges
- Elevation: 6dp shadow
- Background: Primary color
- Icon: Camera glyph, 24px
- Behavior:
  - Persistent across Plans and Activity views
  - Tapping opens camera modal
  - Optional: Fade to 60% opacity on scroll (keeps visible but less obtrusive)

---

### 3.3 Plans View (within Project Workspace)

**State:** Active when segmented control shows "Plans" selected
**Purpose:** View construction plans, place markers, zoom/pan

#### Layout

```
┌────────────────────────────────────────────────────────┐
│  [PDF Plan Viewer]                                     │
│   - Pinch to zoom                                      │
│   - Pan gesture                                        │
│   - Marker overlay (tappable pins)                     │
│                                                         │
│                                            ┌────────┐  │
│                                            │   📷   │  │  ← FAB
│                                            └────────┘  │
└────────────────────────────────────────────────────────┘
```

**Markers:**

- Size: 32x32px minimum (glove-friendly)
- Color coding: By discipline (from backend config)
- Tap behavior: Opens marker detail sheet

---

### 3.4 Activity View (within Project Workspace)

**State:** Active when segmented control shows "Activity" selected
**Purpose:** Unified timeline of photos/videos with voice notes, organized chronologically

#### Layout - Daily Summary Banner (Professional, Subtle)

```
┌────────────────────────────────────────────────────────┐
│  ✨ Today's Summary                        [↗ Share]   │  ← Banner, not card
│  ─────────────────────────────────────────────────────  │
│  AI-generated summary of today's progress goes here.   │
│  Includes photo count, issues detected, key activities.│
│  ─────────────────────────────────────────────────────  │
│                                  [✨ Generate Summary]  │
└────────────────────────────────────────────────────────┘
```

**Daily Summary Banner Specs:**

- **NOT a heavy card** - use subtle borders, minimal elevation
- Padding: 16px
- Background: Very subtle contrast (e.g., `bg-muted/20`)
- Border: 1px solid `border` color
- Collapsible: Can be collapsed to just the title bar
- Share button: Only appears when summary is generated
  - Icon: ↗ (share/external link)
  - Opens native share sheet
  - Shares summary as text

**States:**

1. **Empty state** (no summary):

   ```
   ✨ Today's Summary
   Generate an AI summary of today's progress and photos.
   [✨ Generate Summary]
   ```

2. **Loading state**:

   ```
   ✨ Today's Summary
   [Spinner] Generating summary...
   ```

3. **Generated state**:
   ```
   ✨ Today's Summary                        [↗ Share]
   Today's work at Riverside Apartments focused on electrical
   installations. 5 photos captured across 2 locations. 1 issue
   flagged requiring attention.
   ```

#### Layout - Photo Timeline

```
┌────────────────────────────────────────────────────────┐
│  ── Today ────────────────────────────────────────────  │  ← Date header
│                                                         │
│  📍 5/A7 - Electrical Junction (3 photos)              │  ← Marker group
│  ┌──────────────────────────────────────────────────┐  │
│  │ [Photo 1] [Photo 2] [Photo 3]                  > │  │  ← Horizontal scroll
│  │  5:40 PM   ❗5:10 PM  4:40 PM                     │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  📍 3/A2 - Panel Rough-in (2 photos)                   │
│  ┌──────────────────────────────────────────────────┐  │
│  │ [Photo 4🎤] [Photo 5]                          > │  │
│  │  4:10 PM    3:40 PM                              │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  ── Yesterday ────────────────────────────────────────  │
│                                                         │
│  📍 2/A1 - HVAC Duct (2 photos)                        │
│  ...                                                    │
│                                            ┌────────┐  │
│                                            │   📷   │  │  ← FAB
│                                            └────────┘  │
└────────────────────────────────────────────────────────┘
```

**Timeline Specs:**

**Date Headers:**

- Typography: 20px bold, foreground color
- Spacing: 24px top margin, 12px bottom margin
- Format: "Today", "Yesterday", or "October 25, 2023"

**Marker Groups:**

- Typography: 16px medium, foreground color
- Icon: 📍 (pin icon)
- Photo count: 14px regular, muted-foreground

**Photo Carousels:**

- Horizontal scrolling (FlatList with horizontal prop)
- Thumbnail size: 160x160px
- Spacing: 8px between thumbnails
- Timestamp overlay: Bottom-left, 12px regular, white text with dark shadow

**Photo Badges:**

- Issue badge (❗): Red circle, 20px, top-right corner
- Voice note badge (🎤): Blue circle, 20px, bottom-right corner

---

### 3.5 Notifications Screen

**Route:** `/notifications`
**Purpose:** Show user notifications with quick actions

#### Header & Bottom Sheet Pattern

```
┌────────────────────────────────────────────────────────┐
│  [← Back]      Notifications               [⚙️ Gear]   │
└────────────────────────────────────────────────────────┘
│                                                         │
│  John Doe added a photo to Riverside Apartments        │
│  2 hours ago                                            │
│  ───────────────────────────────────────────────────    │
│  New issue created in Downtown Office                  │
│  5 hours ago                                            │
│                                                         │
                         │
                         ▼ Tap Gear Icon
┌─────────────────────────────────────────────────────────┐
│                      ────                               │  ← Drag handle
│   Manage Notifications                                  │  ← Title
│  ──────────────────────────────────────────────────────  │
│  ⚙️  Notification settings                          >   │  ← 48px height
│  ──────────────────────────────────────────────────────  │
│  🗑️  Clear all notifications                            │  ← 48px, RED text
└─────────────────────────────────────────────────────────┘
```

**Bottom Sheet Specs:**

- Backdrop: Dim screen to 40% opacity
- Sheet background: Card background color
- Drag handle: 32px wide, 4px tall, centered
- Title: 18px semibold
- List items: 48px minimum height
- Destructive action ("Clear all"): Red text (#ef4444)
- Tap behavior on "Clear all": Shows confirmation dialog first

**Confirmation Dialog:**

```
┌────────────────────────────────────────────┐
│  Clear All Notifications                   │
│                                             │
│  Are you sure you want to clear all        │
│  notifications? This cannot be undone.     │
│                                             │
│           [Cancel]    [Clear All (RED)]    │
└────────────────────────────────────────────┘
```

---

### 3.6 Camera Modal

**Route:** Triggered by FAB, not a route
**Purpose:** Capture photos/videos with issue toggle

#### Layout (Full Screen)

```
┌────────────────────────────────────────────────────────┐
│  [✕ Close]                                  [Gallery]  │
│                                                         │
│                                                         │
│            [Live Camera Viewfinder]                    │
│                                                         │
│                                                         │
│  [Standard] [Issue]  ← Toggle (48px height)            │
│         [⚫ Shutter Button 72px]                        │
└────────────────────────────────────────────────────────┘
```

**Component Specs:**

- Close button: Top-left, 48x48px, "✕" icon
- Gallery button: Top-right, 48x48px, opens device gallery
- Issue toggle: Segmented control, 48px height
  - Standard: Default state
  - Issue: Red accent when selected
- Shutter button: 72x72px (large for gloved use), centered bottom

---

## 4. Component Hierarchy

### 4.1 Projects Screen Component Tree

```
ProjectsScreen
├── Stack.Screen (header config)
├── ProjectsHeader
│   ├── NotificationButton (→ /notifications)
│   └── ProfileButton (→ /settings)
├── FilterChips (48px height, horizontal scroll)
│   └── FilterChip (x4: All, Active, Completed, Archived)
├── ProjectList (FlatList)
│   └── ProjectListItem (x N)
│       ├── ProjectInfo (name, address)
│       ├── Timestamp
│       └── ChevronRight
└── CreateProjectModal (conditional)
```

### 4.2 Project Workspace Component Tree

```
ProjectWorkspaceLayout
├── WorkspaceHeader
│   ├── BackButton (→ /projects)
│   ├── SegmentedControl
│   │   ├── PlansTab
│   │   └── ActivityTab
│   └── ProjectMenuButton (⋯)
├── ProjectContext (sticky row)
│   ├── ProjectName
│   └── ProjectAddress
├── ViewContainer (switches between views)
│   ├── PlansView (when Plans selected)
│   │   └── PlanViewer (PDF + markers)
│   └── ActivityView (when Activity selected)
│       ├── DailySummaryBanner
│       │   ├── SummaryHeader (✨ + Share button)
│       │   ├── SummaryContent
│       │   └── GenerateButton (conditional)
│       └── PhotoTimeline (FlatList)
│           └── TimelineSection (x N, by date)
│               ├── DateHeader
│               └── MarkerGroup (x N)
│                   ├── MarkerHeader
│                   └── PhotoCarousel (horizontal FlatList)
│                       └── PhotoThumbnail (x N)
│                           ├── Image
│                           ├── Timestamp
│                           └── Badges (issue, voice note)
└── CameraFAB (persistent)
    └── CameraModal (triggered)
```

### 4.3 Notification Screen Component Tree

```
NotificationsScreen
├── NotificationsHeader
│   ├── BackButton
│   └── GearButton (opens bottom sheet)
├── NotificationList (FlatList)
│   └── NotificationItem (x N)
│       ├── Message
│       ├── Timestamp
│       └── Separator
└── NotificationActionsSheet (bottom sheet)
    ├── SheetHandle
    ├── SheetTitle
    ├── NotificationSettingsButton (→ /settings/notifications)
    └── ClearAllButton (shows confirmation)
```

---

## 5. Typography & Spacing

### Typography Scale

| Element            | Size | Weight   | Color            | Usage                            |
| ------------------ | ---- | -------- | ---------------- | -------------------------------- |
| **Screen Title**   | 20px | Bold     | foreground       | "Projects", "Notifications"      |
| **Section Header** | 20px | Bold     | foreground       | "Today", "Yesterday"             |
| **Card Title**     | 18px | Semibold | foreground       | Bottom sheet titles              |
| **Project Name**   | 16px | Semibold | foreground       | Project context row              |
| **Body Text**      | 16px | Medium   | foreground       | List item primary text           |
| **Label**          | 14px | Medium   | foreground       | Filter chip active state         |
| **Secondary Text** | 14px | Regular  | muted-foreground | Addresses, marker labels         |
| **Timestamp**      | 12px | Regular  | muted-foreground | Photo timestamps, relative times |
| **Caption**        | 12px | Regular  | muted-foreground | Photo counts, helper text        |

### Spacing System

| Token         | Value | Usage                                                  |
| ------------- | ----- | ------------------------------------------------------ |
| `spacing-xs`  | 4px   | Icon-to-text gap                                       |
| `spacing-sm`  | 8px   | Between filter chips, photo thumbnails                 |
| `spacing-md`  | 12px  | Internal component padding (context row vertical)      |
| `spacing-lg`  | 16px  | Standard padding (horizontal, vertical for list items) |
| `spacing-xl`  | 24px  | Section spacing (between date groups)                  |
| `spacing-2xl` | 32px  | Large gaps (not used often)                            |

### Touch Target Minimums

| Component             | Minimum Size | Actual Implementation          |
| --------------------- | ------------ | ------------------------------ |
| **Icon Buttons**      | 48x48px      | 48x48px                        |
| **Filter Chips**      | 48px height  | 48px height, variable width    |
| **List Items**        | 48px height  | 64px height (more comfortable) |
| **Segmented Control** | 48px height  | 48px height                    |
| **FAB**               | 48x48px      | 56x56px (exceeds minimum)      |
| **Shutter Button**    | 56x56px      | 72x72px (easier for gloves)    |

---

## 6. Motion & Animation

### Animation Principles

| Principle            | Application                                                                 |
| -------------------- | --------------------------------------------------------------------------- |
| **Fast & Snappy**    | Animations should feel instant, not sluggish. Max duration: 300ms.          |
| **Spring Physics**   | Use spring-based animations (damping: 20, stiffness: 200) for natural feel. |
| **Preserve Context** | When switching views, use cross-fade to maintain spatial awareness.         |
| **Minimize Motion**  | Respect device accessibility settings (reduce motion).                      |

### Specific Animations

#### Segmented Control Transition

```typescript
// When switching between Plans and Activity
Animated.spring(viewOpacity, {
  toValue: 1,
  useNativeDriver: true,
  damping: 20,
  stiffness: 200,
}).start()
```

- Duration: ~250ms
- Type: Cross-fade
- Easing: Spring (damping: 20, stiffness: 200)

#### FAB Scroll Behavior (Optional)

```typescript
// Fade to 60% opacity when scrolling down
Animated.timing(fabOpacity, {
  toValue: 0.6,
  duration: 150,
  useNativeDriver: true,
}).start()
```

#### Bottom Sheet Entrance

```typescript
// Slide up from bottom with backdrop fade
Animated.parallel([
  Animated.spring(sheetPosition, {
    toValue: 0,
    useNativeDriver: true,
    damping: 30,
  }),
  Animated.timing(backdropOpacity, {
    toValue: 0.4,
    duration: 200,
    useNativeDriver: true,
  }),
]).start()
```

#### Photo Thumbnail Tap

- Scale: 0.95 on press down, 1.0 on release
- Duration: 100ms
- Haptic feedback: Light impact

---

## 7. State Management Patterns

### View State (Plans vs Activity)

**Location:** Project workspace layout
**Pattern:** Local state (useState) with transition animation

```typescript
const [activeView, setActiveView] = useState<"plans" | "activity">("plans")

// No persistence needed - user can quickly switch
```

### Camera State Persistence

**Location:** Zustand store (`useCameraStore`)
**Pattern:** Persist issue toggle state across sessions

```typescript
interface CameraState {
  isIssueMode: boolean
  setIssueMode: (isIssue: boolean) => void
}

// Persisted to AsyncStorage
```

### Daily Summary State

**Location:** Hook (`useDailySummary`)
**Pattern:** Async state with loading/error handling

```typescript
interface SummaryState {
  summary: string | null
  isLoading: boolean
  error: Error | null
  generate: () => Promise<void>
  share: () => Promise<void>
}
```

### Photo Timeline Data

**Location:** Hook (`usePhotosTimeline`)
**Pattern:** LiveStore query with grouping logic

```typescript
// Query photos for project, group by date then marker
const sections = usePhotosTimeline(projectId)
// Returns: { title: string, data: MarkerGroup[] }[]
```

---

## 8. Implementation Guidelines

### Component Structure Best Practices

#### 1. Extract Business Logic

```typescript
// ❌ Bad: Logic in component
function ActivityView({ projectId }) {
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(false)

  const generateSummary = async () => {
    setLoading(true)
    // ... API call logic
    setLoading(false)
  }

  return <View>...</View>
}

// ✅ Good: Logic in hook
function ActivityView({ projectId }) {
  const { summary, isLoading, generate, share } = useDailySummary(projectId)

  return <View>...</View>
}
```

#### 2. Memoize List Items

```typescript
// Photo thumbnails in carousel
const PhotoThumbnail = React.memo(function PhotoThumbnail({ photo, onPress }) {
  return (
    <Pressable onPress={() => onPress(photo.id)}>
      {/* ... */}
    </Pressable>
  )
})
```

#### 3. Use useCallback for Event Handlers

```typescript
const handlePhotoPress = useCallback(
  (photoId: string) => {
    // Navigate to photo detail
    router.push(`/photo/${photoId}`)
  },
  [router],
)
```

#### 4. Optimize FlatList Rendering

```typescript
<FlatList
  data={photos}
  renderItem={({ item }) => <PhotoThumbnail photo={item} onPress={handlePhotoPress} />}
  keyExtractor={(item) => item.id}
  // Performance optimizations
  windowSize={5}
  maxToRenderPerBatch={10}
  updateCellsBatchingPeriod={50}
  removeClippedSubviews={true}
  getItemLayout={(data, index) => ({
    length: 160,
    offset: 160 * index,
    index,
  })}
/>
```

### File Organization

```
components/
├── workspace/
│   ├── workspace-header.tsx         # Back + Segmented Control + Menu
│   ├── project-context.tsx          # Project name + address row
│   ├── camera-fab.tsx               # Floating action button
│   └── segmented-control.tsx        # Reusable Plans/Activity toggle
├── activity/
│   ├── daily-summary-banner.tsx     # Subtle banner (not card)
│   ├── summary-header.tsx           # Title + share button
│   ├── summary-content.tsx          # Generated text
│   ├── photo-timeline.tsx           # Main timeline FlatList
│   ├── timeline-section.tsx         # Date group
│   ├── marker-group.tsx             # Photos grouped by marker
│   └── photo-thumbnail.tsx          # Individual thumbnail with badges
├── project/
│   ├── filter-chips.tsx             # 48px filter chips
│   ├── filter-chip.tsx              # Individual chip
│   ├── project-list.tsx             # FlatList of projects
│   └── project-list-item.tsx        # Project card item
├── notifications/
│   ├── notification-list.tsx
│   ├── notification-item.tsx
│   └── notification-actions-sheet.tsx  # Bottom sheet
└── ui/
    ├── bottom-sheet.tsx             # Reusable bottom sheet
    ├── icon.tsx
    ├── text.tsx
    └── ...
```

### Naming Conventions

- **Components:** PascalCase, descriptive (`ProjectListItem`, `DailySummaryBanner`)
- **Hooks:** camelCase, prefixed with `use` (`useDailySummary`, `usePhotosTimeline`)
- **Event handlers:** camelCase, prefixed with `handle` (`handlePhotoPress`, `handleGenerateSummary`)
- **Props interfaces:** PascalCase, suffixed with `Props` (`ProjectListItemProps`)

### Accessibility

- All interactive elements must have `accessibilityLabel`
- Use `accessibilityRole` appropriately (`button`, `header`, `image`)
- Provide `accessibilityHint` for non-obvious actions
- Support dynamic type scaling
- Test with VoiceOver/TalkBack

---

## Appendix: Design Decisions

### Why Remove Camera Tab?

**Problem:** Camera was a destination tab, requiring:

1. Tap project → 2. Land on default tab → 3. Tap Camera → 4. Take photo

**Solution:** Camera as a FAB (Floating Action Button)

1. Tap project → 2. Tap FAB → 3. Take photo

**Impact:**

- Reduces steps from 4 to 3
- FAB is persistent across Plans and Activity
- Ergonomically placed for one-handed, gloved operation
- Aligns with the principle of "camera is an action, not a destination"

### Why Segmented Control Over Swipeable Tabs?

**Wealthsimple uses horizontal swipe for multiple items (3+), but for just 2 items, a segmented control is superior:**

- **Clearer intent:** Tapping is more decisive than swiping
- **Faster:** Direct tap vs swipe gesture
- **Less error-prone:** With gloves, accidental swipes are common
- **Better visual feedback:** Selected state is immediately obvious

### Why Bottom Sheet for Notification Actions?

**Alternative considered:** Gear icon directly navigates to settings

**Bottom sheet is better because:**

- Groups related actions ("Settings" + "Clear all")
- "Clear all" is immediate (no extra navigation)
- Thumb-friendly zone (bottom of screen)
- Follows Wealthsimple pattern

### Why Sticky Project Context Row?

**Problem:** With segmented control in center, no room for project name in primary header

**Solution:** Dedicated second row for project name + address

**Benefits:**

- Always visible (sticky) as user scrolls
- Clear separation: Navigation (row 1) vs Context (row 2)
- Prevents user confusion about which project they're in
