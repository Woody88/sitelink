# Decision: Navigation Pattern - Bottom Tabs vs. Drawer

## Status
Proposed (2025-12-30)

## Context
SiteLink currently uses a custom bottom tab navigation for the plan viewer and project views. We need to evaluate if this is the optimal pattern or if a drawer-based navigation would better serve our users, particularly construction field workers.

### Current Implementation
- **Component**: Custom `BottomTabs` in `packages/mobile/components/plans/bottom-tabs.tsx`
- **Sections**: Plans, Camera, Projects, More
- **Usage**: Displayed at the bottom of the screen in most main views.

## Evaluation

### 1. Construction Site UX
*   **One-Handed Use**: Field workers often have one hand occupied (holding a tool, leaning against a wall). Bottom tabs are easily reachable with the thumb. Drawers typically require a reach to the top-left (hamburger menu), which is difficult on modern large devices.
*   **Touch Targets**: Both can have large touch targets. Bottom tabs provide 48-60px height naturally.
*   **Visibility**: Bottom tabs provide instant visual confirmation of the current section and available alternatives. A drawer hides this information.

### 2. Screen Real Estate
*   **Plan Viewer**: The plan viewer is the most critical part of the app. Every pixel counts. Bottom tabs take up ~60-80px of vertical space.
*   **Mitigation**: The plan viewer already uses a "Minimal UI" approach. We could implement "hide on scroll" for bottom tabs or a "fullscreen mode" that overlays the viewer over the tabs.

### 3. Industry Standards
*   **Fieldwire**: Uses bottom tabs (Plans, Tasks, Photos, Files, More).
*   **Procore**: Uses bottom tabs (Projects, Tools, Notifications, etc.).
*   **Plangrid**: Uses bottom tabs.
*   **Standard Mobile Design**: Bottom tabs are the primary navigation pattern for modern iOS and Android apps with 3-5 main sections.

### 4. Scalability
*   **Bottom Tabs**: Limited to 5 items maximum. "More" tab handles overflow.
*   **Drawer**: Can scale to many more items (10+).

## Recommendation: Retain Bottom Tabs

We recommend **retaining the Bottom Tab navigation** as the primary pattern for SiteLink.

### Rationale
1.  **Accessibility**: Critical for one-handed use on construction sites.
2.  **Consistency**: Matches industry leaders (Fieldwire, Procore), reducing the learning curve for workers switching from other tools.
3.  **Frequency**: Users switch between "Plans" and "Camera" frequently; having these a single tap away is significantly more efficient than a drawer.

### Proposed Improvements
1.  **Auto-hide**: Implement logic to hide the bottom tabs when the user is actively zooming or panning in the Plan Viewer to maximize real estate.
2.  **Translucency**: Use a blurred/translucent background for the tab bar to maintain a sense of space.
3.  **Active Indicators**: Improve the visual distinction of the active tab for better visibility in bright sunlight.

## Alternatives Considered
*   **Drawer Only**: Rejected due to poor one-handed reach and increased "taps-to-action".
*   **Hybrid (Tabs + Drawer)**: Keep tabs for core field actions (Plans, Camera) and move administrative/less frequent tasks (Settings, Org Management) to a "More" tab that opens a full-screen menu or drawer. This is our current "More" tab strategy.

## Implementation Plan
1.  Update `BottomTabs` component to use translucent backgrounds.
2.  Add animation to hide tabs when "focus mode" is toggled in the Plan Viewer.
