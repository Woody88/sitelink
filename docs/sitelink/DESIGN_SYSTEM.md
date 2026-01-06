# SiteLink Design System & Frontend Guidelines

**Version:** 1.1  
**Last Updated:** January 5, 2026  
**Context:** Mobile Application (Expo / React Native / Tailwind / Uniwind)

---

## 1. Design Philosophy & Inspiration

Our design is heavily inspired by the **Wealthsimple** mobile app. It balances professional reliability (construction focus) with high-end financial cleanliness.

Visual references and inspiration screenshots can be found in `docs/design/inspiration`.

### Core Visual Traits:

- **High Contrast & Clarity:** Deep blacks, crisp whites, and vibrant reds for action/warning states.
- **Elevation through Blur:** Use of `backdrop-blur` for overlays and top/bottom bars to maintain context while focusing attention.
- **Physics-Based Motion:** All transitions use `spring` physics instead of linear timing for a premium, responsive feel.
- **Modular Logic:** Complex UI (like the Camera) is broken into small, single-responsibility components and specialized hooks (`useCameraState`, `useAudioRecorder`).

---

## 2. Color Palette (Wealthsimple Inspired)

We use a semantic color system defined in our CSS variables.

| Variable           | Usage                           | Hex (approx)                         |
| :----------------- | :------------------------------ | :----------------------------------- |
| `background`       | Primary screen surface          | `#FFFFFF` (Light) / `#121212` (Dark) |
| `foreground`       | Primary text                    | `#000000` (Light) / `#FFFFFF` (Dark) |
| `primary`          | Call to action / Selection      | `#2563EB` (Blue)                     |
| `destructive`      | Issues / Warnings / Red shutter | `#EF4444` (Red)                      |
| `muted`            | Secondary UI elements           | `#F3F4F6` (Gray-100)                 |
| `muted-foreground` | Secondary/placeholder text      | `#6B7280` (Gray-500)                 |
| `border`           | Thin separators / Outlines      | `#E5E7EB` (Gray-200)                 |
| `black/40`         | Overlay button backgrounds      | `rgba(0,0,0,0.4)`                    |
| `black/60`         | Floating pill backgrounds       | `rgba(0,0,0,0.6)`                    |

---

## 3. Typography

Standardized variants available in `components/ui/text.tsx`.

| Variant   | Class                           | Usage                          |
| :-------- | :------------------------------ | :----------------------------- |
| `h1`      | `text-4xl font-extrabold`       | Hero titles                    |
| `h3`      | `text-2xl font-semibold`        | Section/Modal titles           |
| `large`   | `text-lg font-semibold`         | Feature headers                |
| `default` | `text-base font-normal`         | Body text                      |
| `muted`   | `text-sm text-muted-foreground` | Secondary info                 |
| `detail`  | `text-xs font-medium`           | Timestamps / Small labels      |
| `header`  | `text-lg font-bold`             | Main Screen / Workspace Titles |

---

## 4. Spacing & Layout

- **Base Unit:** 4px (All margins/paddings should be multiples of 4).
- **Page Gutter:** `px-4` (Standard) or `px-6` (Focused content).
- **Stacking:** Use `gap-4` for vertical elements.
- **Touch Targets:** Minimum **44px x 44px**. Most action buttons are **48px** or **56px**.
- **Safe Areas:** Always use `useSafeAreaInsets()` to position overlays (e.g., `top: insets.top + 12`).

---

## 5. Motion & Interaction

### Haptic Feedback (`expo-haptics`)

- **Light:** Toggles, tab switches.
- **Medium:** Success actions, opening modals.
- **Heavy:** Photo capture, error states.

### Animation Patterns

- **Springs:** `damping: 20, stiffness: 200` for general movement. `damping: 15, stiffness: 300` for press effects.
- **Scale:** Interactive buttons should scale to `0.95` or `0.9` on press.
- **Fades:** Use `fade` animation for full-screen modals to avoid jarring motion.

---

## 6. Standardized Components

### A. Buttons (`components/ui/button.tsx`)

- **Primary:** Filled with `primary` color.
- **Outline:** Transparent with `border`.
- **Destructive:** Filled with `destructive` (Red).
- **Icon:** Circular buttons (`rounded-full`) with `black/40` background and blur.

### B. Sheets, Modals & Filters

- **Standard Modal:** Use `presentationStyle="pageSheet"` for slide-up screens (e.g., `PlanSelector`).
- **Full Screen:** For immersive experiences (e.g., `CameraScreen`).
- **Filters:** Use a "Filter Pill" or "Badge" pattern. Active filters should use the `primary` background, while inactive filters use an outline or `muted` background. Filter selection should typically happen within a `pageSheet` or a dedicated collapsible section.

### C. Input Fields (`components/ui/input.tsx`)

- **Search:** `rounded-xl`, `bg-muted/20`, with `lucide-react-native` icons.

---

## 7. Feature Specifics: Camera UI

### Viewfinder Overlays (Positioning Logic)

Overlays must be positioned relative to safe areas to avoid notches:

- **Top Bar:** `top: insets.top + 8`.
- **Issue Banner:** `top: insets.top + 60`.
- **Link Pill:** `top: insets.top + 120`.
- **Shutter:** Centered at the bottom with `insets.bottom` spacing.

### Shutter Button

- **Standard:** White ring with gray inner circle.
- **Issue Mode:** Red ring with red inner circle.
- **Feedback:** Scale bounce on press; Heavy haptic on release.

---

## 8. Directory & Maintainability

Follow this structure when adding new components:

```
components/
├── ui/                 # Reusable Primitives (Text, Button, Card, Icon)
├── camera/             # Feature: Camera (Shutter, Viewfinder, Banners)
├── plans/              # Feature: Plan Management (Selector, FolderList)
├── activity/           # Feature: Project Timeline
└── workspace/          # Project-level Layout Elements (Header, FAB)
```

### Pro-Tip for Future Agents:

- **Reuse the PlanSelector:** It is a modular component (`components/plans/plan-selector.tsx`) that can be embedded in any `Modal` or `Sheet`.
- **Check `useCameraState`:** Don't duplicate camera logic. Extend the hook if you need more states.
- **Respect the Blur:** If placing text over an image (like photo preview), use a `black/80` backdrop or `backdrop-blur-md` for legibility.
