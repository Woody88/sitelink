# SiteLink Design System & Frontend Guidelines

**Version:** 1.0  
**Last Updated:** January 3, 2026  
**Context:** Mobile Application (Expo / React Native)

---

## 1. Design Philosophy & Inspiration

Our primary design inspiration is **Wealthsimple**. While we are a construction app, we aim to mimic their trust-inducing, minimalist, and highly readable aesthetic.

### Core Visual Traits:
- **Radical Cleanliness:** Generous whitespace. Content is never cramped.
- **Card-Based Layouts:** Distinct separation of content using cards with subtle borders (`border-border`) and soft shadows.
- **Typography-First:** Hierarchy is established through font weight and size, not just color.
- **High Contrast:** Text is sharp (`text-foreground`) against backgrounds (`bg-background`). Secondary text is clearly muted (`text-muted-foreground`).
- **Professional Polish:** Rounding is consistent (`rounded-xl` for cards, `rounded-full` for buttons/badges).

---

## 2. Architectural Principles

To ensure scalability and maintainability, we adhere to the following strict code principles:

### A. Component Hierarchy (Composition > Monoliths)
If a component exceeds ~150 lines, break it down.
*   **Bad:** A single `ProjectScreen.tsx` containing the list, the card render logic, and the filter modal.
*   **Good:** 
    *   `ProjectScreen.tsx` (Orchestrator)
    *   `ProjectList.tsx` (Layout)
    *   `ProjectCard.tsx` (Item)
    *   `ProjectFilters.tsx` (Interaction)

### B. Separation of Concerns
*   **UI Primitives (`components/ui`):** Dumb components. No business logic. Just style. (e.g., `Card`, `Badge`, `Button`).
*   **Feature Components (`components/<feature>`):** Components aware of domain objects (e.g., `ProjectCard` knows what a `Project` interface looks like).
*   **Screens (`app/(tabs)/...`):** Connect data to components. Manage state (like `filterVisible`).

---

## 3. Component Standards

### The "Card" Pattern
We use a compound component pattern inspired by `shadcn/ui`.
```tsx
<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
    <CardDescription>Subtitle</CardDescription>
  </CardHeader>
  <CardContent>
    {/* Main body */}
  </CardContent>
  <CardFooter>
    {/* Actions or metadata */}
  </CardFooter>
</Card>
```
*   **Styling:** `bg-card`, `border-border`, `border`, `rounded-xl`, `shadow-sm`.

### The "Badge" / Status Indicator
Used for states (Active, Completed, Archived).
*   **Shape:** `rounded-full`.
*   **Size:** `px-2.5 py-0.5`.
*   **Variants:** 
    *   `default` (Solid color, e.g., Active)
    *   `secondary` (Subtle gray, e.g., Completed)
    *   `outline` (Border only, e.g., Unselected filter)

### Headers & Navigation
*   **Native First:** Use `Tabs.Screen` or `Stack.Screen` for the main header. Do not build custom View headers unless absolutely necessary for animation.
*   **Action Buttons:** Use `Button` with `variant="ghost"` or `size="icon"` inside `headerRight`.
*   **Placement:** Title on the left (native default) or center. Actions on the right.

### Modals & Sheets (Filters)
For filtering and complex options, use a **Bottom Sheet** pattern.
*   **Behavior:** Slide up from bottom.
*   **Overlay:** Dimmed background (`bg-black/50`).
*   **Dismissal:** Tap backdrop or 'X' icon.
*   **Content:** Large touch targets. Chips/Badges for selection.

---

## 4. Typography & Spacing

### Typography (`components/ui/text.tsx`)
We use `lucide-react-native` for icons and standard system fonts via `Text` variants.

| Variant | Usage | Tailwind Class |
| :--- | :--- | :--- |
| `h1` | Page Titles | `text-4xl font-extrabold` |
| `h2` | Section Headers | `text-3xl font-semibold` |
| `h3` | Card/Modal Titles | `text-2xl font-semibold` |
| `large` | Primary Info | `text-lg font-semibold` |
| `default` | Body Text | `text-base` |
| `muted` | Metadata/Secondary | `text-sm text-muted-foreground` |

### Spacing
*   **Page Padding:** `px-4` or `px-6` (consistent horizontal gutters).
*   **Section Gap:** `gap-4` or `space-y-4`.
*   **Internal Card Padding:** `p-6`.

---

## 5. Directory Structure

```
apps/mobile/
├── components/
│   ├── ui/               # REUSABLE PRIMITIVES (Card, Badge, Text)
│   ├── project/          # DOMAIN SPECIFIC (ProjectCard, ProjectFilter)
│   └── ...
├── app/
│   └── (tabs)/
│       └── project.tsx   # SCREEN (State holder)
└── lib/
    └── utils.ts          # HELPERS (cn, clsx)
```

---

## 6. Motion & Interaction (Goals)
*   **Touch Feedback:** All interactive elements must have `Pressable` states or standard button feedback.
*   **Transitions:** Modals should slide. Lists should render smoothly.
*   **Hit Slop:** Minimum touch target size of 44px for all buttons.

---

## 7. Implementation Example: Project Screen
*   **List:** `FlatList` with `contentContainerClassName="py-4"` to ensure cards don't touch edges.
*   **Cards:** Display specific high-level stats (Sheets, Members).
*   **Filters:** "Filter" icon in header -> Opens Bottom Sheet -> User selects Badge -> List filters.

**Instruction for Future Agents:**
When adding a new screen (e.g., Plans), consult this document. Copy the `Card` pattern. Use the `Text` variants. **Do not invent new styles.** Reuse `components/ui` primitives.
