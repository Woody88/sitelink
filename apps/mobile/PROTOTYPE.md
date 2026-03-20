# Prototype Mode

Prototype mode runs the mobile app with mock data and no backend/auth dependencies. It's enabled by setting `EXPO_PUBLIC_PROTOTYPE_MODE=true`.

## Running

```bash
cd apps/mobile
EXPO_PUBLIC_PROTOTYPE_MODE=true bun run dev
```

## Secret Triggers

| Trigger                   | Action                                            | How to execute via ADB                                                |
| ------------------------- | ------------------------------------------------- | --------------------------------------------------------------------- |
| 5-tap on "Projects" title | Launch onboarding flow (Welcome → Trial → Signup) | `for i in 1 2 3 4 5; do adb shell input tap 540 160; sleep 0.2; done` |

## Screen Inventory

All prototype screens use `isPrototypeMode()` to switch between mock and live implementations.

### Navigation Map

```
Projects Screen (/) ─────────────────────────────────────────────
  ├── Bell icon → Notifications (/notifications)
  ├── User icon → Settings/Profile (/settings)
  │     └── Subscription → /subscription
  ├── 5-tap title → Onboarding (/(onboarding)/welcome)
  │     └── Welcome → Trial → Signup → /projects
  └── Tap project → Workspace (/project/[id]/)
        ├── Plans tab
        │     ├── Search plans (local filter)
        │     ├── Grid/List view toggle
        │     └── Tap sheet → Fullscreen plan viewer (S0.0-S3.0 have real images)
        ├── Media tab
        │     ├── Photos grouped by marker (horizontal scroll, 160x160 thumbnails)
        │     ├── Voice note cards with transcripts
        │     ├── Generate RFI → /project/[id]/rfi
        │     └── Tap photo → Photo detail modal (voice notes, navigation, issue badges)
        ├── Activity tab (no FAB)
        │     ├── Daily Summary banner → Generate Summary → /daily-summary
        │     ├── Quick Actions: Share Report, Offline
        │     ├── Team Members list
        │     └── Recent Activity timeline
        ├── Gear icon → Project Settings (/project/[id]/settings)
        │     └── Members → /project/[id]/members
        └── Camera FAB → Camera (/project/[id]/camera)
              └── Viewfinder, Issue mode, Voice recording, Sheet linking
```

### Mock Data

All mock data lives in `lib/mock-data.ts`:

- `MOCK_PROJECTS` — 4 construction projects
- `MOCK_FOLDERS` / sheets — 3 folders, 12 sheets
- `MOCK_MARKERS` — 5 callout markers with positions
- `MOCK_REGIONS` — 4 plan regions (schedules, notes, legend)
- `MOCK_TIMELINE_PHOTOS` — 12 photos across 3 days with seeds for picsum images
- `MOCK_NOTIFICATIONS` — 10 notifications
- `MOCK_TEAM_MEMBERS` — 5 team members
- `MOCK_SCHEDULE_GROUPS` — Footing + Pier schedules
- `MOCK_SEARCH_RESULTS` — 6 search results
- `MOCK_RFI_CONTENT` — RFI letter content
- `MOCK_REPORT_TEXT` — Daily report content

### Demo Plan Images

Real structural drawings bundled in `assets/demo/`:

- `sheet-s1.png` → S0.0 Cover & Schedules
- `sheet-s2.png` → S1.0 Foundation Plan (91 markers)
- `sheet-s3.png` → S2.0 Foundation Details
- `sheet-s4.png` → S3.0 Second Floor Framing Plan

### Storybook

Storybook runs on web with `bun run storybook` (port 6006). Stories are in `app/**/*.stories.tsx` and `app/flows/*.stories.tsx`. See `.storybook/README.md` for setup details.
