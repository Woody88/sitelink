# Storybook for SiteLink Mobile

Browser-based component development environment using Storybook 10 with `@storybook/react-native-web-vite`.

## Quick Start

```bash
cd apps/mobile
bun run storybook
# Opens at http://localhost:6006
```

## How It Works

The setup bridges React Native components to the browser via three layers:

1. **`@storybook/react-native-web-vite`** - Storybook framework that uses `vite-plugin-rnw` to alias `react-native` to `react-native-web`
2. **Uniwind web shims** (`uniwind/dist/module/components/web/`) - Wrapper components that translate Uniwind's `$css` className system into actual CSS class names on DOM elements
3. **`@tailwindcss/vite`** - Processes Tailwind v4 directives and generates utility classes

### The Transform Plugin

The core challenge: `vite-plugin-rnw` sets `resolve.alias: { "react-native": "react-native-web" }` at the config level, which runs before any plugin hooks. We need components to import from Uniwind's web shims instead.

The `uniwindRewritePlugin()` in `main.ts` solves this with a `transform` hook that rewrites `from "react-native"` to the absolute path of Uniwind's web components **before** Vite analyzes imports. This bypasses the alias entirely.

The transform only applies to:
- App source files (under `apps/mobile/`, excluding `node_modules/`)
- `@rn-primitives` packages (which also import from `react-native`)

### CSS Theme

`storybook.css` provides the Tailwind v4 theme. Colors **must** be in the `@theme` block (not `@layer theme { :root {} }`) for Tailwind v4 to generate utility classes like `bg-primary`.

This file mirrors `global.css` but without:
- `@import "uniwind"` (handled by the transform plugin)
- `hairlineWidth()` custom function (LightningCSS-specific, not available in browser)
- Dark mode overrides (avoided to prevent invisible text on white Storybook background)

## Writing Stories

Stories go in the same directory as the component with a `.stories.tsx` suffix.

```tsx
// components/ui/badge.stories.tsx
import type { Meta, StoryObj } from "@storybook/react";
import { View } from "react-native";
import { Badge } from "./badge";
import { Text } from "./text";

const meta: Meta<typeof Badge> = {
  title: "UI/Badge",
  component: Badge,
  decorators: [
    (Story) => (
      <View style={{ padding: 16, gap: 12 }}>
        <Story />
      </View>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof Badge>;

export const Default: Story = {
  render: () => (
    <Badge>
      <Text>Badge</Text>
    </Badge>
  ),
};
```

Key points:
- Import `View`, `Text`, `Pressable` etc. from `react-native` as usual - the transform plugin handles the rewrite
- Use the same component APIs as in the real app
- Story files are auto-discovered from `components/**/*.stories.tsx`

## Architecture

```
.storybook/
  main.ts           # Vite config: transform plugin + tailwindcss + @ alias
  preview.ts        # Imports storybook.css, sets layout
  storybook.css     # Tailwind v4 theme (light mode only)
components/
  ui/
    button.tsx          # Component
    button.stories.tsx  # Stories
```

## Known Limitations

- **Light mode only** - Dark mode CSS is excluded to avoid rendering issues on the white Storybook canvas
- **No `hairlineWidth()`** - This Uniwind/LightningCSS custom function isn't available; use `1px` or `border` utilities instead
- **No native modules** - Components that depend on native APIs (camera, file system, etc.) need mocks
- **No LiveStore** - Components that use `useQuery`/`useStore` need mock data providers or storybook decorators
