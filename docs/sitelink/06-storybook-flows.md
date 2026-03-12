# Storybook Flow Audit & Progress Tracker

Last updated: 2026-03-12

---

## Existing Flows (24 built)

- [x] 1. **Onboarding** `flows/onboarding.stories.tsx` — splash → welcome → trial → signup → create-project → upload → processing → reveal
- [x] 2. **Plan Navigation** `flows/plan-navigation.stories.tsx` — browsing → marker-selected → navigating → destination → schedule-drawer → report-wrong → region-overlays → project-selector
- [x] 3. **Field Capture** `flows/field-capture.stories.tsx` — viewfinder → preview → linking → recording → rfi-prompt → camera-first → general-photo → OCR-detection → voice-error
- [x] 4. **Schedule & Notes** `flows/schedule-notes.stories.tsx` — browse → schedule → row-detail → notes → legend
- [x] 5. **Search** `flows/search.stories.tsx` — search → result-view
- [x] 6. **Daily Reporting** `flows/daily-reporting.stories.tsx` — prompt → generating → report → edit → share-options → share-confirm → ai-error-retry
- [x] 7. **RFI Generation** `flows/rfi.stories.tsx` — context → generating → draft → editing → sent → ai-error-retry
- [x] 8. **Project Management** `flows/project-management.stories.tsx` — projects → create → workspace
- [x] 9. **Team Management** `flows/team-management.stories.tsx` — settings → members → invite → pending
- [x] 10. **Notifications** `flows/notifications.stories.tsx` — list → detail → deep-link-navigation
- [x] 11. **Settings** `flows/settings.stories.tsx` — profile → notifications → offline → subscription
- [x] 12. **Subscription** `flows/subscription.stories.tsx` — trial-banner → plans → checkout → success → expired
- [x] 13. **Video Capture** `flows/video-capture.stories.tsx` — viewfinder → recording → preview (issue mode)
- [x] 14. **Share Project** `flows/share-project.stories.tsx` — project-detail → share-options → link-copied → recipient-view
- [x] 15. **Offline & Sync** `flows/offline-sync.stories.tsx` — online → offline-browsing → offline-capture → sync-queue → syncing → sync-complete → conflict-resolution
- [x] 16. **Photo Timeline** `flows/photo-timeline.stories.tsx` — callout-sheet → timeline → photo-detail → issue-photo → empty
- [x] 17. **Cross-Flow Bridges** `flows/cross-flow-bridges.stories.tsx` — P0-2: plan → callout → camera → preview; P0-3: issue capture → RFI prompt → context → generating → draft
- [x] 18. **Subscription Expired** `flows/subscription-expired.stories.tsx` — photo-blocked → project-limit → member-limit
- [x] 19. **Help & Support** `flows/help-support.stories.tsx` — help-home → contact-support
- [x] 20. **Onboarding Edge Cases** `flows/onboarding-edge-cases.stories.tsx` — oauth-loading → oauth-error → welcome-with-demo
- [x] 21. **Feature Requests** `flows/feature-request.stories.tsx` — submit → popular → upvote
- [x] 22. **Permission States** `flows/permission-states.stories.tsx` — viewer-no-photos → viewer-no-invite → admin-full-access
- [x] 23. **Loading States** `flows/loading-states.stories.tsx` — sheet-list-skeleton → project-list-skeleton → photo-timeline-skeleton

**Total: 23 flows, 120+ stories**

---

## P0: Critical Gaps

### P0-1: Share Project via Link Flow
> Core value prop for Sarah (GC Owner) and Danny (Sub). Viral growth mechanism.
> PRD: 4.4, 8.1-8.4

- [x] **`app/flows/share-project.stories.tsx`** ✅ DONE
  - [x] Project Detail → Tap Share button
  - [x] Generate shareable link (view-only, no account required)
  - [x] Copy link / send via text/WhatsApp/email share sheet
  - [x] Recipient opens link → view-only plan viewer
  - [x] Optional sign-up CTA for recipient
  - [x] Link expiry settings

### P0-2: Plan Navigation → Field Capture Transition
> Most important user journey: "see callout → take photo" is currently split across two isolated flows.
> PRD: 4.2

- [x] **`app/flows/cross-flow-bridges.stories.tsx`** ✅ DONE
  - [x] Add callout action sheet with "Take Photo" button to Plan Navigation flow
  - [x] Transition into camera viewfinder (linked to callout)
  - [x] Cross-flow story: Plan View → Callout Selected → Camera Linked → Capture Preview → Done

### P0-3: Field Capture → RFI Generation Handoff
> Issue documentation currently dead-ends. Need explicit bridge.
> PRD: Flow doc #5 step 6

- [x] **`app/flows/cross-flow-bridges.stories.tsx`** ✅ DONE
  - [x] "Generate RFI from this issue?" prompt after issue photo capture
  - [x] Tapping "Generate RFI Draft" transitions into RFI Generation flow context screen
  - [x] Issue photo + voice note context carries through to RFI draft

### P0-4: Offline Mode States
> 40%+ of job sites have poor/no connectivity. #1 differentiator vs competitors.
> PRD: 5.1-5.3

- [x] **`app/flows/offline-sync.stories.tsx`** ✅ DONE
  - [x] Offline indicator badge on plan viewer
  - [x] Degraded feature states (AI features unavailable)
  - [x] Photo/voice capture queued for sync
  - [x] Sync queue status UI ("3 photos, 1 voice note pending")
  - [x] Sync complete confirmation
  - [x] Conflict resolution (if applicable)

---

## P1: Important Gaps

### P1-5: Photo Timeline per Callout
> Per-location photo history. Evidence layer for Rosa (Inspector) and Sarah (Owner).
> PRD: 3.2.6

- [x] **`app/flows/photo-timeline.stories.tsx`** ✅ DONE
  - [x] From callout action sheet → "View All Photos"
  - [x] Photo timeline grouped by time (15-minute clusters)
  - [x] Issue photos with red badges
  - [x] Voice transcription shown inline with play button
  - [x] "Generate RFI" button when issue photos present
  - [x] Empty state (no photos for this callout)

### P1-6: Camera-First Capture (distinct from plan-first)
> Workers open camera tab directly and link to plan later.
> PRD: 4.3, flow doc #4

- [x] **Added to `app/flows/field-capture.stories.tsx`** ✅ DONE
  - [x] Camera tab opens unlinked
  - [x] "Link to Plan" bottom sheet with callout search + recent callouts
  - [x] Select callout → camera updates with linked pill
  - [x] "General photo — no callout link" option
  - [x] Capture → preview → done (unlinked path)

### P1-7: Daily Reporting Share/Export
> Flow currently ends at "report". PRD specifies full share capabilities.
> PRD: 3.4.3-3.4.4

- [x] **Added to `app/flows/daily-reporting.stories.tsx`** ✅ DONE
  - [x] Edit mode for generated report text
  - [x] Share options sheet (copy text, share link, PDF download, email, WhatsApp)
  - [x] Link with expiry settings
  - [x] Send confirmation

### P1-8: On-Sheet Region Overlays
> Purple dashed rectangles for schedule/notes/legend regions on sheets.
> PRD: 3.2.11

- [x] **Added to `app/flows/plan-navigation.stories.tsx`** ✅ DONE
  - [x] Region overlay rectangles visible on sheet viewer
  - [x] Tap region → opens schedule/notes/legend detail
  - [x] Toggle regions on/off

### P1-9: AI Error States
> No representation of network failures during AI features.
> PRD: 5.1

- [x] ✅ DONE
- [x] Add error stories to Daily Reporting (generation failed → retry)
- [x] Add error stories to RFI Generation (generation failed → retry)
- [x] Add error state to voice transcription (transcription pending/failed)

### P1-10: Subscription Expired Read-Only Experience
> What happens when you try to use features while expired?
> PRD: 7.4

- [x] **`app/flows/subscription-expired.stories.tsx`** ✅ DONE
  - [x] Try to take photo → upgrade prompt modal
  - [x] Try to create project → upgrade prompt modal
  - [x] Tier limit hit (Starter: 1 project, 3 members) → upgrade prompt

---

## P2: Nice-to-Have

### P2-11: Onboarding Edge Cases
- [x] **`app/flows/onboarding-edge-cases.stories.tsx`** ✅ DONE
- [x] OAuth loading state (spinner during redirect)
- [x] OAuth error state (failed sign-in)
- [x] Demo project branch ("Or explore the demo project")

### P2-12: Help & Support Flow
> PRD: 3.5.6
- [x] **`app/flows/help-support.stories.tsx`** ✅ DONE
- [x] Search help articles
- [x] Popular topics list
- [x] Contact support (chat, email)

### P2-13: Feature Request Flow
> PRD: 3.5.7
- [x] **`app/flows/feature-request.stories.tsx`** ✅ DONE
- [x] Submit feature request (textarea + category)
- [x] View popular requests sorted by votes
- [x] Upvote existing requests

### P2-14: Notification Deep-Link Navigation
- [x] **Added to `app/flows/notifications.stories.tsx`** ✅ DONE
- [x] Tap notification → navigate to destination screen (Plans, Photo Timeline, Subscription)

### P2-15: OCR Text Detection on Photo Preview
> PRD: 3.3.4
- [x] **Added to `app/flows/field-capture.stories.tsx`** ✅ DONE
- [x] After capture, detected text card ("SIEMENS Model: 5SY4-106-7")
- [x] Tap to copy extracted text

### P2-16: Loading/Skeleton States
- [x] **`app/flows/loading-states.stories.tsx`** ✅ DONE
- [x] Sheet list skeleton
- [x] Project list skeleton
- [x] Photo timeline skeleton

### P2-17: Project Selector Bottom Sheet
> PRD: 3.2.2
- [x] **Added to `app/flows/plan-navigation.stories.tsx`** ✅ DONE
- [x] Bottom sheet for switching between projects from Plans tab

### P2-18: Permission-Gated UI States
> PRD: 8.3
- [x] **`app/flows/permission-states.stories.tsx`** ✅ DONE
- [x] Viewer role: cannot add photos, cannot invite members
- [x] Admin role: full access
- [x] Show disabled states with "Contact admin" prompts

---

## Cross-Flow Transition Gaps

| From | To | Status | Notes |
|------|----|--------|-------|
| Plan Navigation | Field Capture | ✅ Done | Callout action sheet → Camera (cross-flow-bridges) |
| Field Capture (Issue) | RFI Generation | ✅ Done | "Generate RFI?" → RFI context → Draft (cross-flow-bridges) |
| Plan Navigation | Schedule & Notes | ⚠️ Weak | Plan Info tab switch not shown |
| Daily Reporting | Share/Export | ✅ Done | Report → Edit → Share options → Confirmation |
| Search | Result Navigation | ⚠️ Weak | Tap result → Navigate to sheet |
| Notifications | Deep Link Target | ✅ Done | Tap → Destination screen |
| Subscription Expired | Read-Only States | ✅ Done | Expired → Photo/Project/Member blocking prompts |
| Onboarding | Demo Project | ✅ Done | Welcome → "Explore demo" branch |

---

## Persona Coverage

| Persona | Core Job | Coverage |
|---------|----------|----------|
| **Carlos (Rebar Foreman)** | Find specs, offline access, voice notes | ✅ Full — offline sync + conflict resolution |
| **Mike (Electrician)** | Tap callout → detail, camera auto-organizes, search, voice notes | ✅ Full — camera-first + OCR detection |
| **Rosa (Inspector)** | Quick verification with provenance, photo documentation | ✅ Full — photo timeline + permission states |
| **Sarah (GC Owner)** | Daily reports, share with clients, manage subscription | ✅ Full — share/export + subscription expired |
| **Danny (Plumber/Sub)** | View plans via link without account | ✅ Full — share project flow |

---

## Design Principles (reference)

- Dark theme = field default (true black #121212, cards #1c1c1c)
- 48-56px touch targets for glove-friendly field use
- Discipline colors: purple=#a855f7, yellow=#eab308, teal=#06b6d4
- Single dominant CTA per screen
- Generous whitespace, no grey divider lines
- Compact pills for contextual info
- Frosted glass: `rgba(0,0,0,0.72)` with borderRadius
- Bottom sheet: `rgba(0,0,0,0.78)`, borderTopLeftRadius: 24
- GlassCircle: 48px, `rgba(0,0,0,0.4)`
- ShutterButton: 88px outer / 74px inner, 3px border
