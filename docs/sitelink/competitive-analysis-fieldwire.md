# Competitive UI/UX Analysis: Fieldwire vs SiteLink

**Date:** February 2026
**Status:** Internal — Product Team
**Evidence:** 24 Fieldwire screenshots (`tmp/fieldwire/screenshots/`), 16 SiteLink screenshots (`tmp/sitelink/screenshots/`)

---

## 1. Executive Summary

Fieldwire (by Hilti) is a mature, enterprise-grade construction management platform with a broad feature set spanning plans, tasks, forms, specifications, files, and team management. Its plan viewer includes a full markup suite (pen, shapes, ruler, text, eraser) built for manual annotation workflows. SiteLink is a focused, AI-first plan viewer that automatically extracts structured intelligence (schedules, notes, legends) from uploaded drawings and surfaces it through a discovery-oriented UI. Where Fieldwire asks workers to manually create and manage tasks on plans, SiteLink detects and presents what's already on the drawings. SiteLink's competitive advantage is clear in zero-effort data extraction and contextual plan intelligence, but it currently lacks the breadth of collaboration features, markup tools, and enterprise polish that Fieldwire offers.

---

## 2. Screen-by-Screen Comparison

### 2.1 Projects / Home

| Aspect | Fieldwire | SiteLink |
|--------|-----------|----------|
| **Screenshot** | `fieldwire-relaunched.png` | `01-projects-list.png` |
| **Navigation** | Hamburger drawer with 8 sections (Plans, Specifications, Tasks, Photos, Forms, Files, People, Settings) | Flat screen with pill filter tabs (All / Active / Completed / Archived) |
| **Project display** | Minimal list with crown icons (premium indicators), "PROJECTS ON DEVICE" label | Single project card with name, stats (sheets/photos/members), location, timestamp |
| **Actions** | Blue FAB (+), notification bell, search, overflow | White FAB (+), notification bell, profile icon, theme toggle |

**Observations:**

- **SiteLink's projects list is sparse** (`01-projects-list.png`). With only one project, the screen is 80% empty black space. There is no empty-state illustration, no onboarding hint, no "upload your first plans" prompt. Fieldwire shows a labeled section header ("PROJECTS ON DEVICE") that at least contextualizes the list.
- **SiteLink's filter pills** (All / Active / Completed / Archived) are premature for a single-project user. They add visual noise without utility at this stage.
- **Fieldwire's hamburger menu** (`hamburger-menu.png`) reveals significant feature breadth — Plans, Specifications, Tasks, Photos, Forms (locked/premium), Files, People, Settings — plus a task subsection (My Tasks / Watched Tasks / All Tasks / Create category). This is enterprise-level IA. SiteLink intentionally avoids this complexity with its 3-tab model (Plans / Media / Activity).
- **SiteLink's theme toggle** (sun icon in header) is a nice touch Fieldwire lacks. Construction workers move between bright outdoor sites and dark interiors — this is a genuine usability win.

### 2.2 Plans / Sheets List

| Aspect | Fieldwire | SiteLink |
|--------|-----------|----------|
| **Screenshot** | `plans-list.png` | `02-sheets-list.png`, `15-grid-view.png` |
| **Layout** | 2-column grid with real plan thumbnails | List view (default) or grid view with placeholder thumbnails |
| **Search** | "Search plans" with QR code scanner icon | "Search plans" with expand icon, grid/list toggle |
| **Organization** | Folders ("Unfiled plans, 4 plans"), collapse arrows | Folders ("4-Structural-Drawings, 4 plans"), collapse arrows |
| **Unique element** | QR code scanner in search bar | PLAN INTELLIGENCE section with badge count "7" |

**Observations:**

- **Fieldwire's plan thumbnails are real rendered images** of the drawings (`plans-list.png`). You can see A2.01-1 (Building 1 Floor Plan), A2.03-1 (Building 1 Ceiling Plan), etc. with actual plan content visible. **SiteLink's grid view** (`15-grid-view.png`) shows blank gray placeholder boxes with only the sheet number and title below. This is a significant visual quality gap — Fieldwire's thumbnails let users visually identify sheets at a glance.
- **SiteLink's PLAN INTELLIGENCE section** (`02-sheets-list.png`, `03-plan-intelligence-expanded.png`) is the standout differentiator. The collapsed state shows a stacked-layers icon + "PLAN INTELLIGENCE" label + badge "7" + chevron. When expanded (`03-plan-intelligence-expanded.png`), it lists all 7 detected items: Footing Schedule (S0.0), Pier Schedule (S0.0), General Notes (S0.0), Foundation Notes (S1.0), Framing Notes (S3.0), Slab & Deck Legend (S0.0), Foundation Legend (S1.0). Each item shows the source sheet and a disclosure chevron. **Fieldwire has absolutely no equivalent.**
- **SiteLink's list view** (`02-sheets-list.png`) uses document icons next to sheet entries (S0.0, S1.0, S2.0, S3.0) with sheet number in bold and description in gray below. Clean but unremarkable — no photo counts, no issue badges, no visual differentiation between sheets.
- **Fieldwire's "All tasks on plans" subtitle** under the "Plans" heading signals deep plan-task integration. SiteLink has no task concept.

### 2.3 Plan Viewer

| Aspect | Fieldwire | SiteLink |
|--------|-----------|----------|
| **Screenshot** | `plan-viewer-toolbar-expanded.png` | `06-plan-viewer-full.png`, `16-plan-viewer-markers-s1.png` |
| **Toolbar** | Right-side vertical: pin, hyperlink, pen, shape, ruler, text, eraser, color picker + move, undo, delete below | Right-side vertical: 100%, zoom in/out, fit, region overlays toggle, add marker (+), schedule drawer |
| **Bottom bar** | Version date "2025-12-09" + up/down arrows for version/toolbar toggle | Sheet switcher (layers icon + S0.0 / Cover & Schedules + chevron) + marker badge (pin + count) |
| **Header** | Back arrow + "A2.01-1" + "Building 1 Flo..." + eye toggle + search + overflow | X close button (black circle, top-left) |
| **Content on plan** | Red dashed rectangles (task markup), callout symbols | Blue square markers (91 on S1.0), auto-detected by YOLO |

**Observations:**

- **Fieldwire has 11 toolbar buttons** (`plan-viewer-toolbar-expanded.png`): pin, hyperlink, pen, shapes, ruler, text, eraser, color picker (red circle), move/pan, undo, delete (trash, red). The toolbar is divided into upper creation tools and lower editing tools. This is a full annotation suite. **SiteLink has 6 toolbar buttons** (`06-plan-viewer-full.png`): zoom percentage, zoom in, zoom out, fit-to-screen, region overlays toggle/add marker, and schedule drawer. The tools are fundamentally different — Fieldwire is for manual creation, SiteLink is for AI-assisted browsing.
- **SiteLink's viewer on S1.0** (`16-plan-viewer-markers-s1.png`) shows **91 auto-detected markers** as blue squares densely overlaid on the Foundation Plan. The bottom-right badge shows "91" next to a pin icon. This is visually impressive — the markers are clearly visible and demonstrate the AI detection capability. Fieldwire's plan shows only a few red dashed rectangles (manual task markups).
- **Fieldwire's bottom bar** shows "2025-12-09" — plan version dating. This is a critical field workflow feature (tracking plan revisions) that SiteLink lacks entirely.
- **Fieldwire's overflow menu** (`plan-viewer-overflow.png`) is a well-designed bottom sheet with 4 action buttons in a row (Share link, Export PDF, Share crop plan, QR code) followed by list items (Plan details, Tasklist, Delete plan). The "Share crop plan" action is clever — crop a region of the plan and share it as an image. SiteLink has no sharing capabilities from the viewer.
- **Fieldwire's search icon** in the plan viewer header enables OCR-based text search within the drawing. SiteLink doesn't have this yet but it's in the PRD.
- **SiteLink's "100%" zoom badge** at the top of the right toolbar is a nice touch — it shows the current zoom level clearly, which Fieldwire lacks.

### 2.4 Plan Intelligence vs Tasks

| Aspect | Fieldwire Tasks | SiteLink Plan Intelligence |
|--------|----------------|---------------------------|
| **Screenshot** | `hamburger-menu.png` (task section), `tasks-current-state.png` | `03-plan-intelligence-expanded.png`, `04-schedule-detail.png`, `05-schedule-row-detail.png` |
| **Data source** | Manually created by users | Automatically extracted by AI from drawings |
| **Organization** | My Tasks / Watched Tasks / All Tasks / Categories | Schedules / Notes / Legends grouped by type |
| **Integration** | Tasks pinned to plan locations | AI-detected regions linked to source sheets |

**Observations:**

- **This is SiteLink's core differentiator.** Fieldwire requires users to manually create tasks, assign them, categorize them, and pin them to plan locations. SiteLink automatically detects and extracts structured data from the drawings themselves — footing schedules with dimensions and rebar specs, general notes with code references, legend regions.
- **The schedule detail flow** is well-executed: Plan Intelligence list (`03-plan-intelligence-expanded.png`) → Footing Schedule (`04-schedule-detail.png`) → F3 row detail (`05-schedule-row-detail.png`). The row detail bottom sheet shows SIZE (2500 x 2500 x 500), REINFORCING (8-N20 E.W.), CONCRETE (40 MPa), COVER (75mm), NOTES (Step down 300mm at grid line 4), SOURCE (Footing Schedule, Sheet S0.0), and Confidence (91% in green). Every screen has "View on Sheet" for context navigation.
- **Fieldwire's task system** is more mature as a collaboration tool — it supports assignment, priority, categories, watching. But it requires manual effort for every data point. SiteLink delivers comparable information with zero manual effort.

### 2.5 Schedule / Notes / Legend Detail

These screens are SiteLink-only — Fieldwire has no equivalent.

**Schedule Detail** (`04-schedule-detail.png`):
- Clean table layout with MARK / SIZE / REINFORCING columns
- Header: "Footing Schedule" + "View on Sheet" link
- Metadata: "Sheet S0.0" + green badge "92% High confidence"
- 6 rows (F1-F6) with structural data
- Footer prompt: "Tap a row for full details"
- Full-width "View on Sheet" CTA button at bottom

**Schedule Row Detail** (`05-schedule-row-detail.png`):
- Bottom sheet with F3 header + X close
- Properties in uppercase label / large value pairs: SIZE, REINFORCING, CONCRETE, COVER, NOTES
- Source attribution with confidence percentage
- "View on Sheet" button

**Notes Detail** (`09-notes-detail.png`):
- "General Notes" header with copy icon (top-right)
- Amber badge "89% Medium confidence"
- 7 numbered structural notes with sub-bullets for item 3 (cover requirements)
- Clean, readable typography
- "View on Sheet" CTA

**Legend Detail** (`10-legend-detail.png`):
- "Slab & Deck Legend" header with "View on Sheet"
- Green badge "91% High confidence"
- **BROKEN EMPTY STATE**: Center of screen shows a broken-image icon with "Legend image not available" text. This is the worst empty state in the app — a user navigated here expecting to see a legend, found the confidence badge says 91%, but there's nothing to show. The entire middle of the screen is wasted black space.

**Schedule Drawer** (`07-schedule-drawer-on-viewer.png`):
- Opens as bottom sheet overlay on plan viewer
- Header: "Schedules" + "2 schedules . 10 entries" + X close
- Footing Schedule expanded with badge "6" and "S0.0"
- F1-F6 rows with mark + size + reinforcing inline
- Each row has disclosure chevron

**Observations:**

- The schedule → row detail → view on sheet flow is the single strongest UX path in SiteLink. It solves a real problem (finding footing specs) in 15 seconds vs 5-8 minutes of manual sheet hunting.
- The notes detail is clean and functional. The copy icon is a thoughtful touch for workers who need to paste specs into messages.
- The legend empty state is a significant UX failure that needs immediate attention.
- The schedule drawer overlay on the plan viewer is excellent — it lets users browse schedule data while keeping the drawing visible behind the sheet.

### 2.6 Media / Photos

| Aspect | Fieldwire | SiteLink |
|--------|-----------|----------|
| **Screenshot** | `photos.png` (Specifications empty state shown, Photos section in drawer) | `11-media-tab.png`, `12-media-tab-scrolled.png` |
| **Organization** | Photos section accessible from drawer | Media tab with time grouping ("Today") and marker grouping |
| **Unique features** | 360 photos, video support | Voice note transcription, "Generate RFI" button, issue flagging |

**Observations:**

- **SiteLink's Media tab** (`11-media-tab.png`) has a genuinely innovative organization model: photos are grouped by their associated plan marker (e.g., "5/A7 - Electrical Junction (3 photos)"), then by time ("Today"). This contextual grouping makes it easy to find photos for a specific location.
- **Voice note integration** is visible inline — a microphone icon with "0:15" duration and the full transcription text: *"Junction box needs to move about six inches to the left to clear the conduit run"* with a play button. This is field-worker-friendly UX.
- **"Generate RFI" button** appears as a pill below the marker header. This AI feature turns field documentation into formal documents — a workflow Fieldwire cannot automate.
- **Issue flagging** is visible as a red exclamation badge on one photo thumbnail.
- **Camera FAB** (bottom-right) for quick capture is well-positioned.
- Note: The demo photos are stock images (yellow building, brutalist architecture) which slightly undermine the construction context. Real app data would be more convincing.

### 2.7 Activity / Overview

| Aspect | Fieldwire | SiteLink |
|--------|-----------|----------|
| **Screenshot** | (Not captured — Fieldwire has no visible activity screen) | `13-activity-tab.png`, `14-activity-tab-scrolled.png` |

**Observations:**

- **SiteLink's Activity tab** (`13-activity-tab.png`) has several strong elements:
  - **"Today's Summary" card** with AI sparkle icon, counts (0 photos / 0 voice notes / 0 issues), and "Generate Summary" button
  - **Quick Actions**: Share and Offline buttons side-by-side
  - **Team Members** section with avatar initials (JS, MC, SJ), names, roles (Owner/Member), and "Manage" link
- The "Today's Summary" card shows "Default summary" label and "0 photos captured / 0 voice notes / 0 issues flagged" — this is the zero-activity empty state and it's handled well, showing what *would* be summarized.
- **Fieldwire has no comparable activity dashboard** visible in the captured screens. Their People section is in the drawer but no activity feed was found.

---

## 3. Design & UX Audit (SiteLink)

### Rating Scale: 1 = Poor, 2 = Below Average, 3 = Adequate, 4 = Good, 5 = Excellent

| Dimension | Rating | Observations |
|-----------|--------|--------------|
| **Visual hierarchy** | 3.5 / 5 | Schedule detail screens are well-structured with clear label/value pairs and uppercase section headers. PLAN INTELLIGENCE section uses good visual hierarchy (icon + all-caps label + count badge). However, the projects list and sheets list lack visual weight differentiation — everything is the same size white text on black. The plan viewer toolbar buttons are all identical gray circles, making it hard to distinguish functions at a glance. |
| **Navigation clarity** | 4 / 5 | The 3-tab model (Plans / Media / Activity) is immediately understandable. The Plan Intelligence → Schedule → Row Detail drill-down is intuitive. "View on Sheet" as a consistent escape hatch to source context is excellent. The plan viewer's X close button placement (top-left black circle) is standard. The sheet switcher at the bottom of the viewer is discoverable. One weakness: the settings gear icon on the project header is non-functional in the current build. |
| **Information density** | 3 / 5 | The schedule detail table (`04-schedule-detail.png`) has good density — 6 rows of data visible without scrolling. But the projects list (`01-projects-list.png`) is far too sparse — one project card in a sea of black. The legend detail screen (`10-legend-detail.png`) is nearly empty. The notes detail (`09-notes-detail.png`) could show more — the bottom half of the screen is unused. The plan viewer itself has appropriate density with controls tucked to the right side. |
| **Consistency** | 4 / 5 | Strong consistency in the detail screens: all use the same pattern of header + sheet source + confidence badge + content + "View on Sheet" CTA. The confidence badge system (green = high, amber = medium) is consistent across schedules and notes. The pill tab pattern (Plans / Media / Activity) is used consistently. One inconsistency: the plan viewer uses X to close, but detail screens use a back arrow. |
| **Empty states** | 2 / 5 | **This is SiteLink's weakest area.** The legend detail (`10-legend-detail.png`) shows a broken-image icon + "Legend image not available" — no explanation, no fallback, no suggestion. The projects list with one project has no visual warmth. The grid view (`15-grid-view.png`) shows blank gray boxes instead of thumbnails. Compare to Fieldwire's Specifications empty state (`photos.png`) which has a warm illustration, clear explanation ("View all the most up-to-date project specifications on the go"), and a helpful hint ("To upload specifications, use Fieldwire on the web"). |
| **Feedback & affordance** | 3 / 5 | The schedule rows have disclosure chevrons indicating tappability. The "Tap a row for full details" prompt is explicit. Confidence badges are tappable-looking (pill shape). The FAB (+) button is clear. However, the plan viewer toolbar buttons lack labels or tooltips — a new user wouldn't know what the grid icon or the double-rectangle icon does. The PLAN INTELLIGENCE section chevron (expand/collapse) is small and could be missed. |
| **Typography & spacing** | 4 / 5 | Good hierarchy in schedule row detail: uppercase gray labels (SIZE, REINFORCING, CONCRETE) with large white values below. The Plan Intelligence list has comfortable spacing between items. The 3-tab pill control is well-proportioned. The notes detail text (`09-notes-detail.png`) is readable with good line spacing and bullet indentation. One issue: the schedule table columns (MARK / SIZE / REINFORCING) clip the "REINFORCING" header — it shows as "REINFO..." which is sloppy. |

**Overall SiteLink Design Score: 3.4 / 5**

---

## 4. Feature Gap Analysis

### Must-Have Gaps (Fieldwire has it, SiteLink needs it)

| Feature | Fieldwire | SiteLink | Priority | Notes |
|---------|-----------|----------|----------|-------|
| Plan markup/annotation tools | Full suite: pen, shapes, text, ruler, eraser, color picker | None | **HIGH** | Core field workflow. Workers need to mark up plans during inspections, walkthroughs, and punch lists. Without this, SiteLink is view-only. |
| Plan versioning | Date-based versions visible in viewer ("2025-12-09") | Not implemented | **HIGH** | Construction plans get revised constantly. Workers must know they're looking at the latest version. Critical for liability. |
| Plan text search (OCR within viewer) | Search icon in viewer header, keyboard input with @ and # shortcuts | Not implemented (in PRD) | **MEDIUM** | Useful but SiteLink's AI extraction partially solves the same problem from a different angle. |
| Export/share from viewer | Share link, Export PDF, Share crop plan, QR code | None | **MEDIUM** | "Share crop plan" is particularly useful — crop a region to send to a sub. |
| Real plan thumbnails | Actual rendered plan images in grid view | Gray placeholder boxes | **MEDIUM** | Significant visual quality gap. Makes sheet identification harder. |

### Nice-to-Have Gaps

| Feature | Fieldwire | SiteLink | Priority | Notes |
|---------|-----------|----------|----------|-------|
| QR code plan lookup | QR scanner in search bar, QR code generator in viewer | None | LOW | Physical-digital bridge. Interesting but niche. |
| Specifications viewer | Dedicated section (even if web-upload only) | None | LOW | SiteLink's notes extraction partially covers this need. |
| Forms module | Premium/locked feature in drawer | None | LOW | Enterprise feature outside SiteLink's target market. |
| Files section | Generic file storage | None | LOW | Not core to plan viewing workflow. |
| Task management system | Full system with priority, assignment, categories, watching | Markers only (basic) | LOW | Intentionally excluded from SiteLink. Photos and voice notes serve as documentation instead. |
| Cross-sheet hyperlinks | Manual hyperlink tool in viewer | Auto-detected callout links | N/A | SiteLink's approach (automatic) is superior. |
| Measurement tool | Ruler/dimension tool in viewer | None | MEDIUM | Field workers frequently need to measure on plans. Consider for Phase 3. |

### SiteLink Advantages to Protect

| Feature | Fieldwire | SiteLink | Moat Strength |
|---------|-----------|----------|---------------|
| AI schedule extraction | Manual data entry only | Automatic via YOLO + Gemini Flash (92% confidence) | **STRONG** — Hard to replicate, requires trained models |
| AI notes extraction | Manual reading required | Automatic text extraction with structured parsing | **STRONG** — Same pipeline advantage |
| Plan Intelligence discovery UI | No equivalent | Collapsible section with 7-item browse + detail drill-down | **STRONG** — Novel UX pattern for the industry |
| Voice note transcription | Not available | Audio recording + AI transcription inline | **MODERATE** — Commodity API but excellent integration |
| AI confidence badges | N/A | Green/amber/orange badges on all extracted data | **MODERATE** — Builds trust, unique in construction apps |
| Generate RFI from photos | Not available | AI-generated RFI drafts from field documentation | **MODERATE** — Valuable but not yet core workflow |
| AI daily summary | Not available | Activity digest with photo/voice/issue aggregation | **MODERATE** — Differentiator for reporting workflow |
| Dark/light theme toggle | Dark only | User-selectable | **WEAK** — Easy to copy but still a current advantage |
| Schedule drawer on viewer | No equivalent | Bottom sheet overlaying plan with schedule data | **STRONG** — Contextual AI data while viewing drawing |

---

## 5. Specific UX Improvement Recommendations

### 5.1 Fix Legend Empty State (Critical)

- **What**: Replace "Legend image not available" with either (a) the actual legend crop image, or (b) a "View on Sheet" fallback that navigates to the legend region on the plan with a zoom/highlight
- **Why**: Users navigated here because the PLAN INTELLIGENCE section told them a legend exists with 91% confidence. Showing a broken image icon is a trust-destroying experience. It's the worst screen in the app.
- **Where**: `10-legend-detail.png` — Legend detail screen
- **Effort**: S — The detection data exists, just need to wire up the R2 image crop URL or provide the fallback navigation
- **Reference**: `tmp/sitelink/screenshots/10-legend-detail.png`

### 5.2 Generate Real Plan Thumbnails

- **What**: Render actual plan sheet thumbnails for the grid view instead of empty gray placeholder boxes
- **Why**: Fieldwire's grid view (`plans-list.png`) shows real plan content, making visual sheet identification instant. SiteLink's gray boxes (`15-grid-view.png`) provide zero visual information — the grid view is currently worse than the list view.
- **Where**: Sheet list grid view (`15-grid-view.png`)
- **Effort**: M — Need to generate and cache thumbnail images during plan processing pipeline, or extract them from the PMTiles at zoom level 0

### 5.3 Add Toolbar Labels/Tooltips

- **What**: Add text labels below or beside the plan viewer toolbar icons, at least on first use or via long-press tooltip
- **Why**: The current toolbar (`06-plan-viewer-full.png`) has 6 identical gray circular buttons. A new user cannot distinguish "region overlays toggle" from "fit to screen" from "add marker" without trial and error. Fieldwire's toolbar is similarly icon-only but their tools are more standard (pen, text, eraser are universal).
- **Where**: Plan viewer right-side toolbar
- **Effort**: S — Add small text labels below each icon button

### 5.4 Fix Schedule Table Column Clipping

- **What**: Ensure all column headers in schedule tables are fully visible or properly abbreviated
- **Why**: The "REINFORCING" column header clips to "REINFO..." in the schedule detail (`04-schedule-detail.png`). This looks unfinished. Use "REINF." or make the table horizontally scrollable with a scroll indicator.
- **Where**: Schedule detail screen
- **Effort**: S — CSS/layout adjustment

### 5.5 Add Plan Version Tracking

- **What**: Show version date/number in the plan viewer and support multiple versions per sheet
- **Why**: Fieldwire shows "2025-12-09" in the plan viewer bottom bar. Construction plans get revised constantly — workers need confidence they're viewing the latest revision. This is also a liability concern (building from outdated plans).
- **Where**: Plan viewer bottom bar (next to sheet switcher) and sheet list (version indicator per sheet)
- **Effort**: L — Requires backend schema changes, upload workflow changes, and UI for version comparison

### 5.6 Improve Projects List Empty/Sparse State

- **What**: When the user has 0-1 projects, show an onboarding-style layout: illustration, "Upload your first plans" CTA, or quick-start tips. Remove the filter pills (All/Active/Completed/Archived) when there are fewer than 2 projects.
- **Why**: The current projects screen (`01-projects-list.png`) with one project is 80% empty black space. First impressions matter — this screen should inspire confidence, not feel barren.
- **Where**: Projects list screen
- **Effort**: S — Conditional rendering based on project count
- **Reference**: Fieldwire's Specifications empty state (`photos.png`) is a good example with its illustration and explanatory text

### 5.7 Add Sharing/Export from Plan Viewer

- **What**: Add overflow menu to plan viewer with: Share link, Export PDF, Share crop (region screenshot)
- **Why**: Fieldwire's overflow menu (`plan-viewer-overflow.png`) offers Share link, Export PDF, Share crop plan, and QR code. The "Share crop plan" feature is particularly useful — a super taps a region, crops it, and sends it to a sub via text. SiteLink has no way to share anything from the viewer.
- **Where**: Plan viewer header (add overflow/3-dot menu)
- **Effort**: M — Share link and export PDF are straightforward; crop-and-share requires screenshot + crop UI

### 5.8 Add Measurement Tool to Viewer

- **What**: Scale-aware measurement tool that lets users tap two points and see the real-world distance
- **Why**: Fieldwire has a ruler tool in the viewer toolbar. Field workers constantly need to measure distances, verify dimensions, and check clearances on plans. This is one of the most-requested features in construction apps.
- **Where**: Plan viewer toolbar
- **Effort**: L — Requires scale calibration UI, gesture handling, and distance calculation

### 5.9 Make Settings Gear Functional

- **What**: Wire up the settings gear icon visible on the project header or remove it
- **Why**: The gear icon appears in `02-sheets-list.png` but is currently non-functional. Having a visible but non-functional control is worse than not showing it — it trains users not to trust the interface.
- **Where**: Project detail header (top-right gear icon)
- **Effort**: S — Either implement project settings (rename, archive, share) or hide the icon until ready

### 5.10 Improve Confidence Badge Design

- **What**: Add a brief explanation of what confidence means (tooltip or first-time explanation), and differentiate the visual treatment more strongly between green (>=90%), amber (80-89%), and orange (<80%)
- **Why**: The confidence badges ("92% High confidence", "89% Medium confidence") are visible in `04-schedule-detail.png` and `09-notes-detail.png`. They're a differentiator but could confuse users. What does 89% vs 92% mean practically? Should they trust the data or not? The amber badge on the notes screen doesn't tell the user what to do differently.
- **Where**: All Plan Intelligence detail screens
- **Effort**: S — Add "Why?" tappable link or tooltip explaining what the score means and when to verify manually

### 5.11 Group Plan Intelligence by Type

- **What**: In the expanded PLAN INTELLIGENCE list, add section headers (SCHEDULES, NOTES, LEGENDS) instead of a flat list of all 7 items
- **Why**: The expanded Plan Intelligence (`03-plan-intelligence-expanded.png`) shows all 7 items in a flat list: Footing Schedule, Pier Schedule, General Notes, Foundation Notes, Framing Notes, Slab & Deck Legend, Foundation Legend. Without section headers, users must read each item to find what they need. The PRD spec (Section 3.2.7) shows the intended design with SCHEDULES (4), NOTES (2), LEGENDS (2) section headers — the current implementation doesn't match.
- **Where**: Plan Intelligence expanded list in sheets list screen
- **Effort**: S — Add section headers with count badges to the existing FlatList

### 5.12 Add Annotation Visibility Toggle

- **What**: An "eye" toggle to show/hide all markers and overlays on the plan viewer
- **Why**: Fieldwire has this as the "Plan eye" button in the viewer header. With 91 markers on S1.0 (`16-plan-viewer-markers-s1.png`), the markers can visually overwhelm the underlying drawing. Users need to toggle them off to read the plan clearly, then back on to navigate.
- **Where**: Plan viewer toolbar or header
- **Effort**: S — Toggle visibility state for all marker overlays

---

## 6. Strategic Positioning

### SiteLink's Defensible Moat

SiteLink's moat is the **AI extraction pipeline**: dual YOLO models (callout detection at 96.5% mAP50 + DocLayout detection at 96.8% mAP50) running in parallel, followed by Gemini Flash LLM extraction for structured data. This pipeline required:
- Custom training datasets (507+ annotated construction drawings)
- Domain-specific annotation guidelines for schedules, notes, and legends
- Validated LLM prompts for 6 schedule types with 100% row extraction accuracy
- A 150 DPI extraction workflow tuned for speed/quality tradeoff

Fieldwire would need to invest 6-12 months of ML engineering to replicate this. The Plan Intelligence discovery UI and the schedule drawer overlay on the viewer are novel UX patterns that don't exist in any construction app today.

### Where SiteLink Should NOT Compete

1. **Full task management** — Fieldwire has years of iteration on task creation, assignment, priority, categories, and watching. SiteLink's philosophy (photos ARE documentation) is correct for its target market (small-to-mid contractors). Do not add a task system.

2. **Enterprise compliance features** — Forms, specifications, file management, multi-role permissions. These serve large GCs and are table stakes for Fieldwire's enterprise pricing. SiteLink should stay focused on the 1-15 person crew.

3. **Full markup/annotation suite** — Adding pen, shapes, text, eraser, and color picker is a major engineering investment and Fieldwire has 10+ years of refinement. Instead, consider a lightweight markup approach (Phase 3): simple pen tool + photo annotation, not a full drawing suite.

### AI-First Features to Double Down On

1. **Schedule-to-element linking** (Phase 2) — Tap "F2" on the plan drawing, see the schedule entry popup. This closes the loop between the physical drawing and extracted data. No competitor has this.

2. **Grid coordinate queries** (Phase 2) — "What's at F/5?" returning aggregated data from schedules, elements, and notes. This transforms the plan from a static document into an interactive knowledge base.

3. **Cross-sheet intelligent navigation** — Not just "go to sheet A7" but "go to detail 3 on sheet A7 and show the relevant schedule data in a bottom sheet." Multi-source data aggregation at a single plan location.

4. **Voice-first field workflow** — Voice note recording + AI transcription + contextual RFI generation. This targets the core user (worker with dirty gloves and a hard hat) better than any typing-based workflow.

5. **Automated daily summaries** — The "Generate Summary" feature in the Activity tab is underexplored. This should become the default end-of-day workflow: open SiteLink → one tap → daily report sent to the PM.

6. **Proactive intelligence alerts** — "3 schedule entries have low confidence (<80%) — review recommended" or "New plan revision detected — 2 schedule entries may have changed." Move from passive browsing to active notifications.

---

## Appendix: Screenshot Reference

### Fieldwire Screenshots (`tmp/fieldwire/screenshots/`)

| Filename | Content |
|----------|---------|
| `plans-list.png` | Plans grid with real thumbnails, folder structure |
| `plans-expanded.png` / `plans-expanded2.png` / `plans-expand3.png` | Folder expansion states |
| `plan-viewer.png` / `plan-viewer-open.png` | Plan viewer basic state |
| `plan-viewer-toolbar-expanded.png` | Full markup toolbar (11 tools) |
| `plan-viewer-overflow.png` | Overflow menu: Share, PDF, Crop, QR, Details, Tasklist, Delete |
| `plan-viewer-tapped.png` / `plan-viewer-attempt2.png` | Viewer interaction states |
| `hamburger-menu.png` | Drawer navigation: Plans, Specs, Tasks, Photos, Forms, Files, People, Settings |
| `hamburger-from-plans.png` / `hamburger-from-specs.png` | Drawer from different contexts |
| `photos-screen.png` / `photos.png` | Photos section / Specifications empty state |
| `tasks-current-state.png` / `back-from-task.png` | Task management screens |
| `fieldwire-relaunched.png` | App relaunch / project selection |

### SiteLink Screenshots (`tmp/sitelink/screenshots/`)

| Filename | Content |
|----------|---------|
| `01-projects-list.png` | Projects screen with single project, filter pills |
| `02-sheets-list.png` | Sheets list view with PLAN INTELLIGENCE collapsed |
| `03-plan-intelligence-expanded.png` | PLAN INTELLIGENCE expanded (7 items) |
| `04-schedule-detail.png` | Footing Schedule table (F1-F6) |
| `05-schedule-row-detail.png` | F3 row detail bottom sheet |
| `06-plan-viewer-full.png` | Plan viewer S0.0 with toolbar |
| `07-schedule-drawer-on-viewer.png` | Schedule drawer overlay on viewer |
| `08-schedule-drawer-scrolled.png` | Schedule drawer scrolled state |
| `09-notes-detail.png` | General Notes detail with extracted text |
| `10-legend-detail.png` | Legend detail with broken empty state |
| `11-media-tab.png` | Media tab with marker-grouped photos |
| `12-media-tab-scrolled.png` | Media tab scrolled |
| `13-activity-tab.png` | Activity tab with summary card, team members |
| `14-activity-tab-scrolled.png` | Activity tab scrolled |
| `15-grid-view.png` | Sheet grid view with placeholder thumbnails |
| `16-plan-viewer-markers-s1.png` | Plan viewer S1.0 with 91 markers |
