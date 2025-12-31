# SiteLink Mobile UI Design Brief

## Project Overview

**SiteLink** is a professional construction plan management application that allows field workers to:
1. View high-resolution construction plans with deep zoom capability
2. Navigate detected callout markers on plans
3. Review and adjust AI-detected marker positions
4. Capture and sequence photos/videos at marker locations to document work progress

**Target Users**: Construction field workers, foremen, and site supervisors working outdoors on active job sites.

---

## Design System Requirements

### Technical Framework
- **Platform**: React Native with Expo
- **Styling**: NativeWind (Tailwind CSS for React Native)
- **Component Library**: React Native Reusables (shadcn/ui-inspired)
- **Navigation**: Side drawer navigation (already implemented)
- **Icons**: Lucide React Native

### Color Palette Structure (Tailwind CSS Semantic Tokens)

Design the color palette using these semantic token names. Provide HSL values that can be easily swapped:

```
Primary Colors:
- primary           → Main brand/action color
- primary-foreground → Text on primary

Secondary:
- secondary          → Secondary actions
- secondary-foreground

Neutral/Muted:
- background        → App background
- foreground        → Primary text
- muted             → Muted backgrounds
- muted-foreground  → Secondary text

Borders & Input:
- border            → Border color
- input             → Input borders
- ring              → Focus ring

Accents:
- accent            → Hover states, highlights
- accent-foreground

Semantic Status Colors:
- destructive       → Errors, delete actions
- destructive-foreground
- success           → Complete states (custom)
- warning           → In-progress, attention (custom)
- info              → Informational (custom)

Cards:
- card              → Card backgrounds
- card-foreground
```

**Considerations**:
- High contrast for outdoor sunlight readability
- Professional, trustworthy feel (construction industry)
- Clear status differentiation (Ready/Processing/Failed/Pending)

---

## Typography System

Define a typography scale for:

1. **Display/Hero** - App name, empty states
2. **H1** - Screen titles
3. **H2** - Section headers
4. **H3** - Card titles
5. **Body** - Primary content (minimum 16px for outdoor readability)
6. **Body Small** - Secondary information
7. **Caption** - Metadata, timestamps
8. **Button** - Button labels
9. **Badge** - Status labels

**Font Recommendations**:
- System fonts for performance (San Francisco iOS, Roboto Android)
- Consider font weight hierarchy (Regular, Medium, Semibold, Bold)
- Letter spacing for legibility

---

## Motion & Animation Guidelines

Define animation principles for:

### Micro-interactions
- Button press feedback
- Toggle/switch animations
- Loading states
- Success/error feedback

### Navigation Transitions
- Screen transitions (push, pop)
- Drawer open/close
- Tab switching
- Modal presentation

### Content Animations
- List item stagger
- Pull-to-refresh
- Skeleton loading
- Progress indicators

### Gesture Feedback
- Drag operations (marker repositioning)
- Swipe actions
- Pinch-to-zoom feedback
- Long-press indicators

**Technical Note**: Use `react-native-reanimated` for all animations. Keep animations fast (200-300ms) for responsiveness.

---

## Construction Site UX Requirements

### Physical Environment
- **Outdoor sunlight**: High contrast, no subtle grays
- **Gloved hands**: Minimum 48x48px touch targets (prefer 56x56px)
- **Dirty screens**: Large, obvious interactive elements
- **Intermittent connectivity**: Clear sync status, offline indicators

### Workflow Optimization
- Minimal text input (use selection, toggles, voice where possible)
- One-handed operation for common tasks
- Quick camera access (1-2 taps max from any screen)
- Clear visual hierarchy for scanning

### Status Communication
- Always-visible sync indicator
- Offline mode visual treatment
- Upload progress for media
- Clear error states with recovery actions

---

## Feature Designs Required

### 1. Plan Upload Flow

**User Story**: As a foreman, I want to upload new construction plans (PDF) to my project so my team can view them.

**Screens to Design**:
1. **Upload Trigger** - Button/FAB placement on Plans List
2. **File Picker** - Native file selection with preview
3. **Upload Progress** - Progress bar with percentage, cancel option
4. **Processing Status** - Show PDF → Tile generation → Marker detection phases
5. **Success State** - Plan ready to view
6. **Error State** - Upload/processing failure with retry

**Considerations**:
- Large PDF files (50-200MB common)
- Multi-page plans (each page becomes a "sheet")
- Background upload capability
- Resume interrupted uploads

---

### 2. Marker Review Interface

**User Story**: As a field worker, I want to review AI-detected markers and adjust their positions if they're incorrect, so the team has accurate marker locations.

**Context**:
- AI detects circle/triangle callout markers on plans (currently ~80% accurate)
- Markers have confidence scores (0-100%)
- Markers below 70% confidence need human review
- Each marker has: shape, detail number, sheet reference, position coordinates

**Screens to Design**:

#### 2a. Review Queue List
- List of markers needing review
- Sort by: confidence (low first), sheet, marker type
- Show: thumbnail, marker ID, confidence %, sheet name
- Bulk selection capability
- Filter controls

#### 2b. Marker Detail Review
- Plan view zoomed to marker location
- Current marker overlay (circle/triangle shape)
- Drag-to-reposition interaction
- Before/After position comparison
- **Actions**: Confirm, Reject, Skip, Adjust Position
- Confidence indicator
- OCR-detected text display

#### 2c. Position Adjustment Mode
- Zoomed view of marker area
- Draggable marker overlay
- Grid/snap guides (optional)
- Undo capability
- Save changes

#### 2d. Bulk Actions
- Multi-select markers
- Bulk confirm (accept AI positions)
- Bulk reject (mark as false positives)
- Progress indicator for bulk operations

**Micro-interactions**:
- Drag feedback with haptics
- Position change animation
- Confidence badge updates
- Success/error toast notifications

---

### 3. Media Capture & Sequencing

**User Story**: As a field worker, I want to capture photos/videos at marker locations to document the work state, so we have a visual record of progress.

**Context**:
- Each marker can have multiple media captures over time
- Media is tagged with a "state": Start, In Progress, Issue, Complete
- Creates a timeline showing work progression
- Offline capture with background upload

**Screens to Design**:

#### 3a. Marker Media Entry Point
- From plan viewer: tap marker → quick camera action
- From marker list: camera icon per marker
- Clear indication of existing media count

#### 3b. Camera Capture Screen
- Full-screen camera preview
- **State Selector**: 4 prominent buttons for state selection
  - Start (blue/neutral)
  - In Progress (yellow/amber)
  - Issue (red/warning)
  - Complete (green/success)
- Photo/Video toggle
- Flash control
- Capture button (extra large, 72px+)
- Gallery/recent media preview
- Marker context (which marker this is for)

#### 3c. Preview & Confirm
- Full-screen media preview
- Retake option
- State confirmation
- Optional notes input
- Save/Upload action
- Discard option

#### 3d. Media Timeline View
- Marker detail with media history
- Timeline layout (vertical, chronological)
- State color coding
- Thumbnail grid or list view
- Date/time stamps
- Full-screen viewer on tap

#### 3e. Timeline Filtering
- Filter by state (All, Start, In Progress, Issue, Complete)
- Filter by date range
- Filter by capture user

#### 3f. Upload Status
- Upload queue indicator
- Individual item progress
- Retry failed uploads
- Offline pending indicator

**Interactions**:
- Quick capture mode (minimal taps)
- Swipe between media in full-screen
- Pinch-to-zoom on photos
- Video playback controls
- Long-press for options (delete, re-tag state)

---

### 4. Side Drawer Navigation

**Current Implementation** (enhance this):
```
┌─────────────────────────────┐
│ [SiteLink Logo/Brand]       │
│ [User Avatar + Name]        │
│ [Organization Name]         │
├─────────────────────────────┤
│ 🏗️ Projects                 │  ← Active item highlight
│ ⚙️ Settings                  │
├─────────────────────────────┤
│ [Sync Status Indicator]     │
│ [Offline Mode Badge]        │
├─────────────────────────────┤
│ [Sign Out]                  │
└─────────────────────────────┘
```

**Design Requirements**:
- Brand identity at top
- User/org context
- Clear active state
- Sync status always visible
- Offline mode indicator
- Professional, not cluttered

---

### 5. Core Component Designs

Design these reusable components in the system:

#### Cards
- Project Card (name, description, plans count, status)
- Plan Card (name, sheets count, status, date)
- Marker Card (thumbnail, ID, confidence, actions)
- Media Card (thumbnail, state badge, timestamp)

#### Status Badges
- Processing (animated)
- Ready
- Failed
- Pending
- Offline
- Syncing

#### Confidence Indicators
- High confidence (70-100%) - green
- Medium confidence (40-70%) - yellow
- Low confidence (0-40%) - red
- Visual: badge, progress bar, or icon

#### Action Buttons
- Primary (filled)
- Secondary (outlined)
- Destructive (delete, reject)
- Ghost (subtle actions)
- FAB (floating action button for key actions)

#### Empty States
- No projects
- No plans in project
- No markers to review
- No media captured
- Offline with pending sync

#### Loading States
- Screen skeleton
- List item skeleton
- Image loading placeholder
- Overlay spinner

---

## Current Screens (For Reference)

These screens exist and should inform the design system:

1. **Login/Signup** - Email + password forms, clean centered layout
2. **Projects List** - Card-based list with pull-to-refresh
3. **Plans List** - Similar to projects, with status badges
4. **Plan Viewer** - Full-screen OpenSeadragon, sheet selector overlay

---

## Deliverables Requested

Please provide:

1. **Color Palette**
   - Complete HSL values for all semantic tokens
   - Light mode (primary focus)
   - Dark mode consideration (optional but valuable for indoor use)

2. **Typography Scale**
   - Font sizes, weights, line heights
   - Usage guidelines

3. **Spacing & Layout**
   - Spacing scale (consistent with Tailwind: 4, 8, 12, 16, 20, 24, 32, 48, 64)
   - Screen padding standards
   - Card padding standards
   - List gap standards

4. **Component Specifications**
   - Visual designs for all listed components
   - States: default, hover/pressed, disabled, loading, error
   - Touch target sizes noted

5. **Screen Mockups**
   - Plan Upload flow (3-4 screens)
   - Marker Review flow (4-5 screens)
   - Media Capture flow (4-5 screens)
   - Updated drawer navigation

6. **Animation Specifications**
   - Timing curves (ease-in-out recommended)
   - Duration guidelines
   - Key interaction animations described

7. **Iconography**
   - Recommended Lucide icons for actions
   - Custom icon needs (if any)

---

## Brand Personality

**SiteLink should feel**:
- Professional and trustworthy
- Efficient and no-nonsense
- Modern but not trendy
- Robust and reliable
- Approachable but not playful

**Avoid**:
- Overly corporate/sterile
- Childish or gamified
- Overly decorative
- Low contrast or subtle aesthetics

---

## Technical Implementation Notes

The designs will be implemented using:

```tsx
// Example component pattern
import { View, Text, Pressable } from 'react-native';
import { cn } from '@/lib/utils';

export function ProjectCard({ project, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      className={cn(
        "bg-card rounded-xl p-4 border border-border",
        "active:bg-accent active:scale-[0.98]",
        "transition-transform duration-150"
      )}
    >
      <Text className="text-lg font-semibold text-card-foreground">
        {project.name}
      </Text>
      <Text className="text-sm text-muted-foreground mt-1">
        {project.description}
      </Text>
    </Pressable>
  );
}
```

Designs should translate naturally to Tailwind utility classes.

---

## Questions to Consider

1. Should the app support dark mode? (Lower priority but good for indoor use)
2. Any specific brand colors to incorporate? (Currently using deep blue #1a1f3a)
3. Logo design needed or just typographic treatment?
4. Should we use system fonts or a custom typeface?
5. Any specific accessibility requirements beyond standard WCAG?

---

## Reference Links

- [React Native Reusables](https://rnr-docs.vercel.app/)
- [Tailwind CSS Colors](https://tailwindcss.com/docs/customizing-colors)
- [Lucide Icons](https://lucide.dev/icons/)
- [NativeWind Documentation](https://www.nativewind.dev/)
- [Construction App UX Best Practices](https://www.nngroup.com/articles/mobile-ux/)

---

*Please create a comprehensive UI design system and screen mockups based on this brief. Focus on practical, implementable designs that prioritize construction site usability.*
