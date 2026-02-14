# SiteLink Product Specification

**Version:** 1.0
**Date:** January 2026
**Document Type:** Product Specification

---

## Table of Contents

1. [Overview](#1-overview)
2. [App Structure & Navigation](#2-app-structure--navigation)
3. [Screen Specifications](#3-screen-specifications)
4. [Core Workflows](#4-core-workflows)
5. [Offline Mode](#5-offline-mode)
6. [Notifications](#6-notifications)
7. [Subscription & Payment](#7-subscription--payment)
8. [Share & Collaboration](#8-share--collaboration)
9. [Design System](#9-design-system)
10. [Feature Matrix](#10-feature-matrix)
11. [MVP Scope & Phasing](#11-mvp-scope--phasing)

---

## 1. Overview

This document specifies the product features, screens, and user experience for SiteLink. For market context, see [01-vision.md](./01-vision.md). For user personas and workflows, see [02-users.md](./02-users.md). For technical architecture, see [04-architecture.md](./04-architecture.md).

### 1.1 Core Value Proposition

SiteLink delivers five features exceptionally well:

| Feature | Description |
|---------|-------------|
| **Auto-linking** | 91.5% recall on callout detection, no manual setup |
| **Photo documentation** | Timeline-based capture organized by plan location |
| **Voice notes** | Hands-free documentation with transcription |
| **Offline-first** | Full operation in areas with poor connectivity |
| **Daily summaries** | AI-generated reports from photos and voice notes |

### 1.2 What SiteLink is NOT

- Task management system (photos ARE the documentation)
- RFI/submittal workflow tool
- Budget/cost tracker
- Enterprise compliance platform
- BIM viewer

---

## 2. App Structure & Navigation

### 2.1 Information Architecture

```
SiteLink App
+-- Onboarding (first-time only)
|   +-- Welcome
|   +-- OAuth Sign-in
|   +-- Trial Start
|   +-- First Project Setup
|
+-- Main App (4-tab navigation)
|   +-- Plans Tab (default)
|   |   +-- Sheet List
|   |   +-- Sheet Viewer
|   |   |   +-- Pan/Zoom
|   |   |   +-- Callout Markers
|   |   |   +-- Callout Action Sheet
|   |   +-- Search (text search across plans)
|   |   +-- Sheet Filters (by discipline)
|   |
|   +-- Camera Tab
|   |   +-- Camera Viewfinder
|   |   +-- Photo Preview
|   |   +-- Voice Note Recording
|   |   +-- Photo Timeline (by callout)
|   |
|   +-- Projects Tab
|   |   +-- Project List
|   |   +-- Project Detail
|   |   |   +-- Activity Summary
|   |   |   +-- Team Members
|   |   |   +-- Share Settings
|   |   |   +-- Plan Management
|   |   +-- Create Project
|   |   +-- Upload Plans
|   |
|   +-- More Tab
|       +-- Profile
|       +-- Subscription
|       +-- Notifications Settings
|       +-- Offline Downloads
|       +-- Help & Support
|       +-- Feature Request
|       +-- Sign Out
|
+-- Overlays/Modals
|   +-- Polar Checkout
|   +-- Share Sheet
|   +-- Daily Summary
|   +-- Photo Full-screen Viewer
|
+-- Shared via Link (no auth required)
    +-- View-only Plans
    +-- Daily Report View
    +-- Sign-up CTA
```

### 2.2 Bottom Tab Navigation

```
+-------------------------------------------------------------+
|                                                             |
|                    [Screen Content]                         |
|                                                             |
+-------------------------------------------------------------+
|                                                             |
|   +---------+  +---------+  +---------+  +---------+       |
|   |  Plans  |  | Camera  |  |Projects |  |  More   |       |
|   +---------+  +---------+  +---------+  +---------+       |
|                                                             |
+-------------------------------------------------------------+

Tab Bar Specifications:
- Height: 83pt (iOS) / 80dp (Android) including safe area
- Icon size: 24pt / 24dp
- Label size: 10pt / 10sp
- Active color: #2563EB (Primary Blue)
- Inactive color: #6B7280 (Gray-500)
- Background: #FFFFFF with top border #E5E7EB
```

### 2.3 Navigation Patterns

| Pattern | When Used | Example |
|---------|-----------|---------|
| Tab switch | Moving between main sections | Plans -> Camera |
| Push (stack) | Drilling into detail | Project List -> Project Detail |
| Modal (bottom sheet) | Quick actions | Callout tap -> Action Sheet |
| Full-screen modal | Focused tasks | Photo capture, Checkout |
| Overlay | Non-blocking info | Toast notifications |

### 2.4 Header Patterns

**Standard Header (most screens)**
```
+-------------------------------------------------------------+
| < Back          Screen Title              [Action Button]   |
+-------------------------------------------------------------+
```

**Plans Tab Header (includes project selector + segmented control)**
```
+-------------------------------------------------------------+
| Riverside Apartments v                         [Search] [=] |
| ----------------------------------------------------------- |
| [  Sheets  ] [ Plan Info ]            <- Segmented control    |
| ----------------------------------------------------------- |
| [ARCH] [ELEC] [STRC] [MECH] [PLMB] [ALL]   <- Discipline    |
+-------------------------------------------------------------+
```

> **Plan Info segment** shows extracted plan intelligence (schedules, notes, legends). Discipline filter chips only appear when "Sheets" segment is active. See Section 3.2.7.

**Camera Header (minimal)**
```
+-------------------------------------------------------------+
| X                                                    [F][C] |
|                                              (flash)(flip)  |
+-------------------------------------------------------------+
```

---

## 3. Screen Specifications

### 3.1 Onboarding & Authentication

#### 3.1.1 Welcome Screen (First Launch)

**Visual Layout:**
- Logo: 80pt height, centered
- Tagline: "The plan viewer that links itself." - 24pt, Semi-bold, Gray-700
- OAuth buttons: 56pt height, full-width minus 24pt padding
- Button text: 16pt, Medium weight
- Legal text: 12pt, Gray-500, tappable links

**Actions:**
- "Continue with Google" - OAuth flow
- "Continue with Microsoft" - OAuth flow
- "Continue with Email" - Email/password flow

**Acceptance Criteria:**
- [ ] All OAuth providers configured and functional
- [ ] Legal links navigate to Terms and Privacy pages
- [ ] Loading states shown during OAuth redirect
- [ ] Error handling for failed OAuth attempts

#### 3.1.2 Trial Start Screen (After OAuth)

**Content:**
```
Welcome to SiteLink!
Your 14-day Pro trial has started.

What's included:
* Unlimited sheets
* Auto-linking callouts
* Voice notes with transcription
* Plan text search
* Daily summary generation
* Share with unlimited collaborators

[Upload Your First Plans]

Or explore the demo project
```

**Behavior:**
- "Upload Your First Plans" -> Create Project flow
- "explore the demo project" -> Opens pre-loaded demo project
- Demo project contains: 5 sample sheets with working callout links

**Acceptance Criteria:**
- [ ] Trial duration displayed accurately
- [ ] Feature list matches Pro tier
- [ ] Demo project loads immediately
- [ ] Skip option clearly visible

#### 3.1.3 Create First Project

**Fields:**
| Field | Required | Validation |
|-------|----------|------------|
| Project Name | Yes | 1-100 characters |
| Address | No | Used for weather in daily reports |

**Acceptance Criteria:**
- [ ] Keyboard dismisses on tap outside
- [ ] Create button disabled until name entered
- [ ] Address field shows autocomplete (optional enhancement)

#### 3.1.4 Upload Plans

**Supported Formats:**
- Multi-page PDFs up to 500 pages
- Maximum file size: 200MB

**Upload Flow:**
1. Tap to browse or drag-drop (on capable devices)
2. Show file list with page counts and sizes
3. "Remove" option for each file
4. "+ Add more files" option
5. "Upload X Pages" button shows total

**Acceptance Criteria:**
- [ ] File picker opens to appropriate location
- [ ] Progress shown during file selection
- [ ] Multiple files can be selected
- [ ] Total page count calculated and displayed

#### 3.1.5 Processing Plans (Progress Screen)

**Processing Steps:**
1. Splitting PDF pages (~5 seconds)
2. Generating high-res tiles (~30 sec/page)
3. Extracting sheet metadata (~10 sec/page)
4. Detecting callout markers (~5 sec/page)

**Behavior:**
- User can navigate away; processing continues
- Push notification when complete
- If user stays, auto-navigates to Plans tab when done

**Acceptance Criteria:**
- [ ] Progress bar updates smoothly
- [ ] Step indicators show completion
- [ ] Estimated time shown
- [ ] Background processing works reliably
- [ ] Notification sent on completion

---

### 3.2 Plans Tab

#### 3.2.1 Sheet List

**Layout Elements:**
- Project selector (dropdown in header)
- Search icon (opens plan text search)
- Download icon (opens offline download manager)
- Discipline chips (horizontally scrollable)
- Sheet list grouped by discipline

**Sheet List Item:**
```
+--------+  A-101 Floor Plan - Level 1
| thumb  |  First Floor Layout
+--------+  [camera] 12 photos
```

**Specifications:**
- Thumbnail: 60x60pt, rounded corners
- Sheet number: 16pt, Semi-bold
- Sheet title: 14pt, Regular, Gray-600
- Photo count: 12pt, Gray-500
- Issue badge: Red dot + count

**Acceptance Criteria:**
- [ ] Project selector shows all projects
- [ ] Discipline chips filter sheets correctly
- [ ] Photo counts accurate and updated live
- [ ] Issue badges visible on affected sheets
- [ ] Pull-to-refresh updates sheet list

#### 3.2.2 Project Selector (Bottom Sheet)

**Layout:**
- Current project marked with checkmark
- Project name, sheet count, last updated
- "+ Create New Project" at bottom

**Acceptance Criteria:**
- [ ] Swipe down to dismiss
- [ ] Tap outside to dismiss
- [ ] Selection updates immediately
- [ ] Most recently updated projects at top

#### 3.2.3 Plan Text Search

**Behavior:**
- Debounced search (300ms after typing stops)
- Shows snippet with match highlighted
- Tap result -> opens sheet with match highlighted
- Empty state: "Search for text on your plans"

**Results Format:**
```
Found on 3 sheets:

E-401 Electrical Plan
"PANEL E-4" found 4 times
"...circuit from PANEL E-4 to junction..."
```

**Acceptance Criteria:**
- [ ] Search works offline if OCR text synced
- [ ] Results sorted by relevance
- [ ] Match highlighting visible
- [ ] Navigation to match location works

#### 3.2.4 Sheet Viewer

**Interactions:**
| Gesture | Action |
|---------|--------|
| Pinch | Zoom (25% to 400%) |
| Double-tap | Toggle fit-to-width and 100% |
| Drag | Pan |
| Tap callout | Open action sheet |

**Callout Markers:**
- Blue circles, 32pt diameter, semi-transparent
- Tap target: 48pt (larger than visual for easy tapping)
- Show confidence indicator if < 90%

**Header Shows:**
- Back button
- Sheet number and title
- Photo count for this sheet
- Overflow menu (Download sheet, View all photos, Report issue)

**Acceptance Criteria:**
- [ ] Smooth 60fps pan and zoom
- [ ] Callout markers positioned accurately
- [ ] Markers visible at all zoom levels (scale appropriately)
- [ ] Sheet navigation (swipe or arrows) between sheets

#### 3.2.5 Callout Action Sheet (Bottom Sheet)

**Content:**
```
5/A7
Electrical Junction Detail
Links to: Sheet E-402
Confidence: 94%
-------------------------------------------
[Photo]  [Video]

[-> Go to Detail (E-402)]
-------------------------------------------
Photos at this callout (7):
[thumb] [thumb] [thumb] [thumb] [thumb] [+2]
9:15am  11:30   11:31   2:47pm  2:48

[View All Photos]
```

**Actions:**
| Button | Behavior |
|--------|----------|
| Photo | Opens camera with callout pre-linked |
| Video | Opens camera in video mode with callout pre-linked |
| Go to Detail | Navigates to linked sheet |
| Photo thumbnail | Opens full-screen viewer |
| View All Photos | Opens photo timeline for this callout |

**Acceptance Criteria:**
- [ ] Swipe down to dismiss
- [ ] Correct target sheet identified
- [ ] Photo thumbnails load quickly
- [ ] Haptic feedback on button tap

#### 3.2.6 Photo Timeline (Per Callout)

**Layout:**
- Header shows callout reference and sheet info
- Photos grouped by time (cluster within 15 minutes)
- Issue photos have red background badge
- Voice transcription shown inline with play button

**Acceptance Criteria:**
- [ ] Chronological order (newest first or oldest first option)
- [ ] Issue photos clearly marked
- [ ] Voice notes playable inline
- [ ] Generate RFI button shown if issue photos present

#### 3.2.7 Plan Info View (Extracted Intelligence)

> Accessible via "Plan Info" segment in Plans tab workspace header.

**Purpose:** Surface extracted plan intelligence (schedules, notes, legends) in a browseable discovery interface. Replaces manual hunting through sheets for this information.

**Layout:**
```
+-------------------------------------------------------------+
| Riverside Apartments v                         [Search] [=] |
| ----------------------------------------------------------- |
| [  Sheets  ] [● Plan Info ]                                  |
+-------------------------------------------------------------+
|                                                             |
|  SCHEDULES (4)                                              |
|  +-------------------------------------------------------+  |
|  |  Footing Schedule                          S0.0   >  |  |
|  |  Pier Schedule                             S0.0   >  |  |
|  |  Beam Schedule                             S5.0   >  |  |
|  |  Column Schedule                           S5.0   >  |  |
|  +-------------------------------------------------------+  |
|                                                             |
|  NOTES (2)                                                  |
|  +-------------------------------------------------------+  |
|  |  General Notes                             S0.0   >  |  |
|  |  Concrete Notes                            S0.1   >  |  |
|  +-------------------------------------------------------+  |
|                                                             |
|  LEGENDS (2)                                                |
|  +-------------------------------------------------------+  |
|  |  Slab & Deck Legend                        S0.0   >  |  |
|  |  Symbol Legend                             S0.1   >  |  |
|  +-------------------------------------------------------+  |
|                                                             |
+-------------------------------------------------------------+
```

**Sections:**
- **Schedules**: Detected schedule tables with extracted structured data. Tap to view parsed rows.
- **Notes**: Detected notes sections with extracted text content. Tap to read.
- **Legends**: Detected legend regions shown as high-res image crops. Tap to view zoomed.

**Empty State:**
```
Plan Info

No plan intelligence detected yet.

This project's plans haven't been processed
for schedules, notes, and legends.

[Processing happens automatically on upload]
```

**Acceptance Criteria:**
- [ ] Sections show count badges
- [ ] Items show source sheet number
- [ ] Sections collapse if empty
- [ ] Pull to refresh
- [ ] Works offline (data synced via LiveStore)

#### 3.2.8 Schedule Detail Screen

**Layout:**
```
+-------------------------------------------------------------+
| < Plan Info     Footing Schedule              [View Source]  |
| ----------------------------------------------------------- |
| Sheet S0.0 · 94% confidence                                 |
|                                                             |
| +------+--------------+----------------+---+                |
| | Mark | Size         | Reinforcing    | > |                |
| +------+--------------+----------------+---+                |
| |  F1  | 1500x1500x300| 4-15M E.W.    | > |                |
| |  F2  | 2000x2000x400| 6-20M E.W.    | > |                |
| |  F3  | 1200x1200x250| 4-15M E.W.    | > |                |
| +------+--------------+----------------+---+                |
|                                                             |
| Tap a row for full details                                  |
|                                                             |
| [View on Sheet]                                             |
+-------------------------------------------------------------+
```

**Row Detail (Bottom Sheet):**
```
+-------------------------------------------------------------+
|  Footing F2                                                 |
|  -----------------------------------------------------------+
|  Size: 2000 x 2000 x 400 mm                                |
|  Reinforcing: 6-20M E.W.                                   |
|  Top of Footing: -1200                                      |
|  Notes: Provide dowels per detail 3/S5.0                    |
|                                                             |
|  Source: Footing Schedule, Sheet S0.0                       |
|  Confidence: 94%                                            |
|                                                             |
|  [View on Sheet]                                            |
+-------------------------------------------------------------+
```

**Actions:**
| Button | Behavior |
|--------|----------|
| View Source (header) | Navigate to sheet, zoom to schedule region, highlight |
| Row tap | Open row detail bottom sheet |
| View on Sheet (row detail) | Navigate to sheet, zoom to specific row |

**Acceptance Criteria:**
- [ ] Table renders with correct columns from LLM extraction
- [ ] Confidence indicator shown (green >=90%, yellow 80-89%, orange <80%)
- [ ] "View on Sheet" navigates and highlights source region
- [ ] Works offline

#### 3.2.9 Notes Detail Screen

**Layout:**
```
+-------------------------------------------------------------+
| < Plan Info     General Notes                 [View Source]  |
| ----------------------------------------------------------- |
| Sheet S0.0                                                   |
|                                                             |
| 1. All concrete shall be 4000 PSI minimum 28-day            |
|    strength unless noted otherwise.                         |
|                                                             |
| 2. Reinforcing steel shall be ASTM A615 Grade 60.          |
|                                                             |
| 3. Minimum concrete cover: 3" for footings, 1.5" for       |
|    columns and beams.                                       |
|                                                             |
| 4. All splices shall be 40 bar diameters minimum            |
|    unless noted otherwise.                                  |
|                                                             |
| [View on Sheet]                                             |
+-------------------------------------------------------------+
```

**Acceptance Criteria:**
- [ ] Text renders with numbered list formatting
- [ ] Scrollable for long notes sections
- [ ] "View on Sheet" navigates and highlights source region
- [ ] Copy text action available

#### 3.2.10 Legend Detail Screen

**Layout:**
```
+-------------------------------------------------------------+
| < Plan Info   Slab & Deck Legend              [View Source]  |
| ----------------------------------------------------------- |
| Sheet S0.0                                                   |
|                                                             |
| +-------------------------------------------------------+   |
| |                                                       |   |
| |  [High-resolution image crop of legend region]        |   |
| |                                                       |   |
| |  Pinch to zoom · Double-tap to fit                    |   |
| |                                                       |   |
| +-------------------------------------------------------+   |
|                                                             |
| [View on Sheet]                                             |
+-------------------------------------------------------------+
```

**Acceptance Criteria:**
- [ ] High-res crop loads from R2
- [ ] Pinch-to-zoom and double-tap zoom supported
- [ ] "View on Sheet" navigates and highlights source region
- [ ] Image cached for offline access

#### 3.2.11 On-Sheet Region Overlays

When viewing a sheet that contains detected layout regions (schedules, notes, legends), tappable region overlays appear alongside existing callout markers.

**Visual Distinction from Callout Markers:**
| Element | Callout Markers | Region Overlays |
|---------|-----------------|-----------------|
| Shape | Solid circle (32pt) | Dashed rectangle |
| Color | Blue (#2563EB) | Purple (#8B5CF6) at 15% opacity |
| Border | None | 2pt dashed purple |
| Tap target | 48pt | Full region bbox |
| Label | Callout reference | Region type ("Schedule", "Notes") |

**Behavior:**
- Tap region overlay → bottom sheet with extracted content (same as Plan Info detail)
- Region overlays visible at zoom levels where the region is large enough to tap (>40pt)
- Can be toggled on/off via viewer controls

**Acceptance Criteria:**
- [ ] Region overlays visually distinct from callout markers
- [ ] Tap opens bottom sheet with content
- [ ] Overlays scale appropriately with zoom
- [ ] Toggle available in viewer controls

---

### 3.3 Camera Tab

#### 3.3.1 Camera - Not Linked State

**Layout:**
```
+-------------------------------------------------------------+
| X                                                    [F][C] |
+-------------------------------------------------------------+
|                                                             |
|                                                             |
|                   [Camera Viewfinder]                       |
|                                                             |
|                                                             |
+-------------------------------------------------------------+
| [pin] Not linked to a callout         [Link to Plan]        |
+-------------------------------------------------------------+
|                                                             |
|                        ( O )                                |
|                      [shutter]                              |
|                                                             |
|                    [! Issue]                                |
+-------------------------------------------------------------+
```

**Behavior:**
- X closes camera, returns to previous tab
- Flash toggles (off/on/auto)
- Flip camera (front/back)
- "Link to Plan" opens sheet selector to pick a callout
- Photos taken without link go to "General" project photos

#### 3.3.2 Camera - Linked to Callout

**Changes from unlinked:**
- Status shows: "[pin] Linked to: 5/A7 - Electrical Junction [Change]"
- All photos auto-tagged with callout reference

#### 3.3.3 Camera - Issue Mode Active

**Visual Changes:**
- Red banner in viewfinder: "! ISSUE MODE"
- Shutter button fills red
- Issue toggle shows checkmark, red background

**Behavior:**
- Haptic feedback on toggle (short vibrate)
- After taking photo, issue mode auto-resets to OFF

**Button Specifications:**
- Shutter button: 72pt diameter, white fill, 2pt gray border
- Issue toggle: 48pt height, 140pt width, gray background

#### 3.3.4 Photo Preview (After Capture)

**Content:**
```
[Captured Photo]

Saved to 5/A7
Jan 2, 2026 2:47 PM

Text detected:
"SIEMENS Model: 5SY4-106-7 240V 6A"
                         [Copy] [Edit]

[Add Voice]    [Done]

Swipe down to take another
```

**Behavior:**
- "Retake" (X in header) discards photo, returns to camera
- "Add Voice" starts voice recording
- "Done" returns to camera for more photos
- Swipe down returns to camera
- OCR text shown if detected (async, may appear after slight delay)

#### 3.3.5 Voice Recording Overlay

**Recording State:**
```
[red dot]
Recording...
0:03
[waveform visualization]

Tap anywhere to stop
```

**After Stopping:**
```
Voice note saved (0:05)
Transcribing...

[Play]  [Delete]  [Done]
```

**Specifications:**
- Max recording: 60 seconds
- Format: m4a (iOS) / webm (Android)
- Transcription: Async via Whisper API
- Transcription appears on photo timeline when complete

---

### 3.4 Projects Tab

#### 3.4.1 Projects List

**Project Card:**
```
+-------------------------------------------------------------+
|  Riverside Apartments                                       |
|  47 sheets - 84 photos - Updated 2h ago                     |
|  [people] 5 members                                         |
|  -----------------------------------------------------------+
|  Today: 12 photos, 1 issue                                  |
+-------------------------------------------------------------+
```

**Behavior:**
- Tap project -> Opens Project Detail
- [+] button -> Create New Project
- Projects sorted by last updated
- Demo project always shown at bottom (can be hidden)

#### 3.4.2 Project Detail

**Sections:**

**Activity Summary:**
```
Today, Jan 2
[camera] 12 photos captured
[mic] 3 voice notes
[!] 1 issue flagged

[View Photos]  [Generate Daily Summary]
```

**Quick Actions:**
```
[Plans]     [Share]     [Offline]
47 sheets   5 members   Download
```

**Team Members:**
```
[person] John Smith (you)    Owner
[person] Mike Chen           Member
[person] Sarah Johnson       Member
[link] View-only link        12 views
                            [Manage]
```

**Recent Activity:**
```
| 2:47 PM  Mike flagged issue at 5/A7
| 11:30 AM Sarah added 3 photos to 3/A2
| 9:15 AM  John added photo to 5/A7
```

**Overflow Menu:**
- Edit Project Details
- Upload More Plans
- Export All Photos
- Archive Project
- Delete Project

#### 3.4.3 Daily Summary Generation

**Step 1: Generating**
```
Analyzing 12 photos and 3 voice notes...
[progress bar]
```

**Step 2: Summary Ready**

**Report Format:**
```
DAILY CONSTRUCTION REPORT
=========================

Project: Riverside Apartments
Date: January 2, 2026
Weather: Clear, 45F
Report By: John Smith

WORK PERFORMED
--------------
- Electrical rough-in at Detail 5/A7 (junction installation)
- Conduit run from Panel E-4 to junction
- Fire alarm conduit completed at 7/E-102

ISSUES / DELAYS
---------------
[!] Junction box at 5/A7 requires relocation (~6" left)
    to clear conduit routing.
    "Junction box needs to move about six inches
     to the left to clear the conduit"

PHOTOS (12)
-----------
[thumbnails]

Generated by SiteLink | sitelink.app
```

**Actions:**
- Edit (modify text)
- Copy Text
- Share (opens share options)
- Download PDF
- Regenerate

#### 3.4.4 Share Daily Summary

**Share Options:**
```
Shareable Link
sitelink.app/r/ABC123XYZ                    [Copy Link]

Anyone with this link can view the report.
Link expires in: [30 days v]

-------------------------------------------
Send directly:
[Email]  [WhatsApp]  [Messages]

-------------------------------------------
[Download PDF]
```

---

### 3.5 More Tab

#### 3.5.1 More Tab - Main Menu

**Layout:**
```
Profile Section:
[avatar] John Smith
         john@contractor.com
         Pro Plan - 12 days left in trial

Account:
[person] Profile                        >
[card] Subscription                     >
[bell] Notifications                    >

App:
[download] Offline Downloads            >
[?] Help & Support                      >
[lightbulb] Request a Feature           >
[doc] Terms of Service                  >
[lock] Privacy Policy                   >

[exit] Sign Out

Version 1.0.0 (build 42)
```

#### 3.5.2 Profile Screen

**Fields:**
| Field | Editable | Notes |
|-------|----------|-------|
| Photo | Yes | Change Photo button |
| Name | Yes | Text input |
| Email | No | Managed by OAuth provider |
| Company | Yes | Optional |
| Phone | Yes | Optional |

**Actions:**
- Save (in header)
- Delete Account (destructive, confirmation required)

#### 3.5.3 Subscription Screen

**Current Plan Section:**
```
[tag] Pro Trial

Your trial ends in 12 days (Jan 14, 2026)

* 5 projects
* 15 team members
* Unlimited sheets
* Voice notes + transcription
* Daily summaries
* Plan text search
```

**Choose a Plan Section:**
```
Starter                               $29/mo
1 project - 3 members - Core features
                                    [Select]

Pro                    [BEST]        $79/mo
5 projects - 15 members - AI features
                                    [Select]

Business                            $149/mo
Unlimited - Priority support - API
                                    [Select]

All plans billed monthly. Cancel anytime.
```

**After Trial Expires (if not subscribed):**
- Projects become read-only
- Can still view plans and photos
- Cannot add new photos or projects
- Data retained for 30 days

#### 3.5.4 Notifications Settings

**Push Notifications:**
| Setting | Default | Description |
|---------|---------|-------------|
| Plan processing complete | ON | When uploaded plans are ready |
| Team activity | ON | When team members add photos or flag issues |
| Issues flagged | ON | When someone flags an issue on your project |
| Daily summary reminder | OFF | Reminder at 5 PM to generate daily summary |

**Email Notifications:**
| Setting | Default | Description |
|---------|---------|-------------|
| Weekly project summary | OFF | Summary of all project activity each Monday |
| Trial ending reminder | ON | Reminder before trial expires |
| Product updates | OFF | New features and improvements |

#### 3.5.5 Offline Downloads

**Layout:**
```
Downloaded projects are available without internet.

Downloaded (2)
-------------------------------------------
[check] Riverside Apartments
        47 sheets - 156 MB
        Last synced: 2 hours ago    [Update] [X]

[check] Downtown Office Remodel
        23 sheets - 78 MB
        Last synced: 1 day ago      [Update] [X]

Available to Download (1)
-------------------------------------------
Demo Project
5 sheets - ~12 MB                  [Download]

-------------------------------------------
Storage Used: 234 MB

[Clear All Downloaded Data]
```

**Download Includes:**
- All plan sheet tiles (PMTiles format)
- All existing photos for this project
- All voice notes (audio files)
- Marker/callout metadata
- Sheet metadata

#### 3.5.6 Help & Support

**Sections:**
- Search help articles
- Popular Topics (5-6 items)
- Contact Us
  - Chat with Support (typically < 2 hours response)
  - Email: support@sitelink.app
- Report a Bug

#### 3.5.7 Feature Request Screen

**Layout:**
```
Help us build what you need!

What would you like to see?
[textarea]

Category: [Select a category... v]
- Plan viewing
- Photo documentation
- Sharing & team
- Offline mode
- Reports
- Other

[Submit Request]

-------------------------------------------
Popular Requests:
Mark photos as "Complete"     47 votes  [^]
PDF annotation tools          32 votes  [^]
Integration with QuickBooks   28 votes  [^]
Apple Watch support           19 votes  [^]
```

**Behavior:**
- Submit creates feature request in backlog
- Popular requests sorted by vote count
- User can upvote existing requests (one vote per request)

---

## 4. Core Workflows

### 4.1 First-Time Setup

```
Welcome Screen -> OAuth Sign-in -> Trial Start -> Create Project -> Upload Plans
                                                                         |
                                                                         v
Plans Tab <--- Success Screen <--- Processing Plans <------------------+

Total time: ~90 seconds (excluding plan processing)
Processing time: 1-3 minutes depending on plan count
```

### 4.2 Plan-First Photo Capture

```
Viewing Sheet -> Tap Callout -> Action Sheet -> Camera Opens
                               (tap "Photo")   (linked to callout)
                                                      |
                                                      v
Photo Timeline <--- Preview + OCR <--- Tap Shutter <--- Issue Mode (optional)
(or continue)                                |
      ^                                      v
      +----------------------- Voice Note (optional)
```

### 4.3 Camera-First Photo Capture

```
Open Camera Tab -> Take Photo -> Preview Screen
(unlinked)                             |
     |                                 v
     v                          Link to Callout (optional)
Link to Callout                        |
(before capture)                       v
                                Saved to Project or Callout
```

### 4.4 Share Project with Subcontractor

```
OWNER                                    SUBCONTRACTOR (no account)
  |
Project Detail -> Share Button                    |
                      |                           |
                      v                           |
              Generate Link -----------------> Opens in Browser
                 (send via text)                  |
                                                  v
                                           View-only Plans
                                           (no sign-in)
                                                  |
                                                  v
                                           Optional: Sign up CTA
```

### 4.5 Generate and Share Daily Summary

```
Project Detail -> "Generate Summary" -> Processing (LLM) -> Summary Ready
                                                                |
                         +------------------+-------------------+
                         |                  |                   |
                         v                  v                   v
                      Edit             Copy Link            Download PDF
                   (modify)                |
                                    +------+------+
                                    |             |
                                    v             v
                                  Send        Copy Link
                              (email/WhatsApp)
```

### 4.6 Upgrade from Trial

**Trigger:** Trial ending (Day 12) OR "Upgrade" tapped

```
Trial Warning Banner -> Choose Plan -> Polar Checkout -> Success Screen
                                       (embedded)             |
                                                              v
                                                       Full Access Unlocked
```

**If Trial Expires Without Subscription:**
```
Trial Expired Banner -> Projects Read-only -> Upgrade Required to Edit
                       (can still view)     (shown when trying to add)
```

---

## 5. Offline Mode

### 5.1 Feature Availability

| Feature | Offline Support | Notes |
|---------|-----------------|-------|
| View downloaded plans | FULL | Tiles stored locally |
| Pan/zoom plans | FULL | |
| Tap callout markers | FULL | Links work within downloaded sheets |
| Take photos | FULL | Stored locally, queued for upload |
| Record voice notes | FULL | Stored locally, queued for transcription |
| View existing photos | DOWNLOADED ONLY | Only photos included in download |
| Search plans | PARTIAL | If OCR text synced, works locally |
| Generate daily summary | NO | Requires LLM API |
| Upload new plans | NO | Requires server processing |
| Share project | NO | Requires server |

### 5.2 Offline Indicator

When offline, show in header:
```
< Sheets    A-101 Floor Plan    [Offline]    [camera] 12
```

`[Offline]` = Gray badge indicating offline mode
Tapping shows: "You're offline. Some features unavailable."

### 5.3 Sync Status UI

```
+-------------------------------------------------------------+
|  Syncing...                                            [X]  |
|  ---------------------------------------------------------- |
|  Uploading 5 photos taken offline                           |
|  [============........]  3 of 5                             |
+-------------------------------------------------------------+
```

**Sync Priority:**
1. Events (lightweight, instant)
2. Photos (larger files)
3. Voice notes (audio files)

---

## 6. Notifications

### 6.1 Push Notification Types

| Notification | Trigger | Content |
|--------------|---------|---------|
| Plan processing complete | Plans finished processing | "Your plans are ready! 47 sheets processed." |
| Issue flagged | Team member flags issue | "Mike flagged an issue at 5/A7" |
| Team activity | Photos added by others | "Sarah added 5 photos to Riverside Apartments" |
| Daily summary reminder | 5 PM local time (if enabled) | "Ready to generate today's summary? 12 photos captured." |
| Trial ending | 3 days before trial ends | "Your trial ends in 3 days. Upgrade to keep your projects." |
| Trial expired | Day trial ends | "Your trial has ended. Upgrade to continue editing." |
| Subscription renewed | Monthly renewal | "Your Pro subscription renewed. Thanks for using SiteLink!" |
| Subscription failed | Payment failed | "Payment failed. Update your card to keep Pro features." |

### 6.2 Notification Deep Links

| Notification | Deep Link Target |
|--------------|------------------|
| Plan processing complete | Plans Tab (project auto-selected) |
| Issue flagged | Photo Timeline for that callout |
| Team activity | Project Detail |
| Daily summary reminder | Project Detail |
| Trial ending/expired | Subscription screen |
| Subscription issues | Subscription screen |

### 6.3 In-App Notification Center

**NOT IMPLEMENTED IN MVP**

Future consideration: Bell icon in header showing notification history. For MVP: Push notifications only, no in-app notification center.

---

## 7. Subscription & Payment

### 7.1 Pricing Tiers

| Tier | Price | Projects | Users | Sheets | Features |
|------|-------|----------|-------|--------|----------|
| **Starter** | $29/mo | 1 | 3 | 500 | Core (no AI) |
| **Pro** | $79/mo | 5 | 15 | Unlimited | + Voice, Search, Summaries |
| **Business** | $149/mo | Unlimited | Unlimited | Unlimited | + RFI, API, Priority Support |

### 7.2 Feature Availability by Tier

| Feature | Starter | Pro | Business |
|---------|:-------:|:---:|:--------:|
| Plan viewing + callout linking | Y | Y | Y |
| Photo capture + timeline | Y | Y | Y |
| Voice notes (audio only) | Y | Y | Y |
| Share view-only links | Y | Y | Y |
| Offline downloads | Y | Y | Y |
| Voice transcription | - | Y | Y |
| Plan text search | - | Y | Y |
| Photo text extraction (OCR) | - | Y | Y |
| Daily summary generation | - | Y | Y |
| RFI draft generation | - | - | Y |
| API access | - | - | Y |
| Priority support | - | - | Y |
| Custom report branding | - | - | Y |

### 7.3 Trial Details

- **Duration:** 14 days
- **Features:** Full Pro access
- **Credit card:** Not required to start
- **Limits:** Same as Pro tier
- **At expiration:** Projects become read-only (not deleted)
- **Grace period:** 30 days before data deletion warning

### 7.4 Upgrade Prompts

**Soft prompts (non-blocking):**
- Trial ending banner (day 12, day 13, day 14)
- "Upgrade for AI features" tooltip on locked features
- Monthly usage report with upgrade CTA

**Hard prompts (blocking):**
- Trial expired: Can view but not add content
- Project limit hit: Must upgrade or archive project
- Sheet limit hit: Must upgrade to upload more

---

## 8. Share & Collaboration

### 8.1 Share Types

| Share Type | Who Can View | Auth Required | Expires |
|------------|--------------|---------------|---------|
| Project (view-only) | Anyone with link | No | Never (until revoked) |
| Daily Report | Anyone with link | No | 30 days (configurable) |
| Full Project Access | Invited members | Yes (account required) | Never |

### 8.2 View-Only Project Share

**What shared users CAN do:**
- View all plan sheets
- Navigate via callout links
- View photos (but not add)
- Download sheets for offline

**What shared users CANNOT do:**
- Add photos
- Record voice notes
- Generate summaries
- Invite others
- Modify project

### 8.3 Team Member Roles

| Role | Permissions |
|------|-------------|
| **Owner** | Full access, billing, can delete project |
| **Admin** | Full access except billing |
| **Member** | View plans, add photos, generate summaries |
| **Viewer** | View only (same as share link, but tracked) |

### 8.4 Shared Report Page (Web)

URL: `sitelink.app/r/{report_id}`

**Elements:**
- Header with SiteLink logo, Download button, Sign Up button
- Full report content with photos
- Download PDF button
- Footer: "Powered by SiteLink - The simple plan viewer"
- "Try Free for 14 Days" CTA

**Brand Exposure:**
- Logo in header
- "Sign Up" button
- "Try Free" CTA in footer
- PDF includes SiteLink footer

---

## 9. Design System

### 9.1 Colors

**Primary:**
```
Blue-600:    #2563EB  (Primary actions, links)
Blue-700:    #1D4ED8  (Pressed state)
Blue-100:    #DBEAFE  (Backgrounds, highlights)
```

**Semantic:**
```
Red-500:     #EF4444  (Issues, errors, destructive)
Red-100:     #FEE2E2  (Issue backgrounds)
Green-500:   #22C55E  (Success, complete)
Yellow-500:  #F59E0B  (Warnings)
```

**Neutral:**
```
Gray-900:    #111827  (Primary text)
Gray-700:    #374151  (Secondary text)
Gray-500:    #6B7280  (Tertiary text, icons)
Gray-300:    #D1D5DB  (Borders)
Gray-100:    #F3F4F6  (Backgrounds)
White:       #FFFFFF  (Cards, surfaces)
```

**Discipline Badges:**
```
ARCH:        #3B82F6  (Blue)
ELEC:        #F59E0B  (Amber)
STRC:        #8B5CF6  (Purple)
MECH:        #10B981  (Emerald)
PLMB:        #06B6D4  (Cyan)
SITE:        #84CC16  (Lime)
```

### 9.2 Typography

**Font Family:**
- iOS: SF Pro (system)
- Android: Roboto (system)

**Sizes:**
| Style | Size | Line Height | Weight |
|-------|------|-------------|--------|
| Heading 1 | 28pt | 34pt | Bold |
| Heading 2 | 22pt | 28pt | Semi-bold |
| Heading 3 | 18pt | 24pt | Semi-bold |
| Body | 16pt | 24pt | Regular |
| Body Small | 14pt | 20pt | Regular |
| Caption | 12pt | 16pt | Regular |
| Label | 10pt | 12pt | Medium, uppercase |

### 9.3 Spacing

**Base Unit:** 4pt

| Token | Value | Usage |
|-------|-------|-------|
| XS | 4pt | Tight spacing within components |
| S | 8pt | Between related elements |
| M | 16pt | Between sections |
| L | 24pt | Major sections, screen padding |
| XL | 32pt | Hero spacing |
| XXL | 48pt | Page-level separation |

**Standards:**
- Screen padding: 16pt horizontal
- Card padding: 16pt all sides
- List item height: 56pt minimum (touch target)

### 9.4 Components

**Primary Button:**
```
Height: 56pt
Radius: 12pt
Background: Blue-600
Text: White, 16pt Semi-bold
Pressed: Blue-700
```

**Secondary Button:**
```
Height: 56pt
Radius: 12pt
Background: White
Border: 1pt Gray-300
Text: Gray-900, 16pt Medium
Pressed: Gray-100 background
```

**Text Button:**
```
Height: 44pt
Text: Blue-600, 16pt Medium
Pressed: Blue-700
```

**Destructive Button:**
```
Same as Primary but Red-500/Red-600
```

**Text Input:**
```
Height: 52pt
Radius: 8pt
Border: 1pt Gray-300
Focus border: 2pt Blue-600
Padding: 16pt horizontal
Text: 16pt Gray-900
Placeholder: 16pt Gray-500
```

**Card:**
```
Background: White
Radius: 12pt
Shadow: 0 1pt 3pt rgba(0,0,0,0.1)
Padding: 16pt
```

### 9.5 Touch Targets

**Follow platform guidelines:**
- iOS: 44pt minimum (Apple Human Interface Guidelines)
- Android: 48dp minimum (Material Design Guidelines)

**For construction/gloved use, prefer larger targets:**
- Primary buttons: 56pt height
- List items: 56pt height
- Icon buttons: 48pt
- Shutter button: 72pt diameter

---

## 10. Feature Matrix

### 10.1 In Scope (MVP)

| Category | Features |
|----------|----------|
| **Plan Viewing** | Sheet list, pan/zoom viewer, callout markers, callout navigation, discipline filters, Plan Info (schedules, notes, legends) |
| **Photo Documentation** | Capture with callout link, issue toggle, photo timeline per callout |
| **Voice Notes** | Recording, playback, transcription (Pro+) |
| **Search** | Plan text search (Pro+), sheet filtering |
| **AI Features** | Daily summary generation (Pro+), photo OCR (Pro+) |
| **Sharing** | View-only links, team member roles, shared reports |
| **Offline** | Downloaded projects, offline photo capture, sync queue |
| **Account** | OAuth (Google, Microsoft, Email), profile management |
| **Subscription** | Trial, three tiers, Polar integration |

### 10.2 Out of Scope (MVP)

| Feature | Reason |
|---------|--------|
| Task management | Intentionally excluded - photos ARE documentation |
| RFI/submittal workflows | Enterprise feature - not for target market |
| Budget/cost tracking | Different domain - not core value prop |
| BIM viewer | Specialized technology - users receive 2D PDFs |
| PDF annotation tools | Consider for Phase 3 |
| In-app notification center | Phase 3 |
| API access | Business tier, Phase 3 |
| Apple Watch support | User-requested, evaluate priority |
| QuickBooks integration | User-requested, evaluate priority |

### 10.3 Priority Matrix

| Priority | Features | Phase |
|----------|----------|-------|
| P0 (Must Have) | Plan viewing, callout navigation, photo capture, offline viewing | Phase 1 |
| P1 (Should Have) | Voice notes, text search, daily summaries, sharing | Phase 2 |
| P2 (Nice to Have) | RFI generation, team management, notifications | Phase 3 |
| P3 (Future) | PDF annotations, revision comparison, API | Post-MVP |

---

## 11. MVP Scope & Phasing

### 11.1 Phase 1: Core MVP (Weeks 1-4)

**Foundation (Week 1):**
- [ ] LiveStore + Expo integration
- [ ] LiveStore sync backend on Cloudflare
- [ ] Domain package with events, tables, materializers
- [ ] Biometric offline auth

**Core Features (Weeks 2-4):**
- [ ] OAuth sign-in (Google, Microsoft)
- [ ] Project creation
- [ ] Plan upload + processing pipeline
- [ ] Sheet viewer with callout markers
- [ ] Callout navigation (sheet-to-sheet linking)
- [ ] Camera with callout linking
- [ ] Issue toggle on camera
- [ ] Photo timeline per callout
- [ ] Voice note recording (audio only, no transcription)
- [ ] Basic project sharing (view-only link)
- [ ] Offline sheet viewing
- [ ] Polar payment integration
- [ ] Basic subscription management

**Out of scope for Phase 1:**
- Voice transcription
- Plan text search
- Daily summary generation
- RFI generation
- Team member management (beyond owner)
- Notification system
- Feature request system

### 11.2 Phase 2: AI Features (Weeks 5-8)

- [ ] Voice note transcription (Whisper)
- [ ] Plan text search (full-text index)
- [ ] Photo text extraction (OCR on photos)
- [ ] Daily summary generation (LLM)
- [ ] Share daily report (hosted page + PDF)

### 11.3 Phase 3: Polish & Growth (Weeks 9-12)

- [ ] Team member invitation
- [ ] Role-based permissions
- [ ] Notification system (push)
- [ ] RFI draft generation
- [ ] Feature request screen
- [ ] Analytics integration (PostHog)
- [ ] Performance optimization
- [ ] LiveStore devtools integration

### 11.4 Success Metrics for MVP

| Metric | Target | Measurement |
|--------|--------|-------------|
| Signup to first upload | >50% | Analytics |
| Day 7 retention | >30% | Analytics |
| Photos per active user per day | >3 | Analytics |
| Trial-to-paid conversion | >10% | Polar |
| NPS | >40 | In-app survey |
| Support tickets per user | <0.5/month | Support system |

---

## Document History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | Jan 2026 | Initial product specification extracted from comprehensive PRD |

---

## Cross-References

- **Market & Vision:** [01-vision.md](./01-vision.md)
- **User Research & Personas:** [02-users.md](./02-users.md)
- **Technical Architecture:** [04-architecture.md](./04-architecture.md)
- **AI Features Specification:** 05-ai-features.md (planned)

---

*End of Document*
