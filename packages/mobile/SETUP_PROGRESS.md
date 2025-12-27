# SiteLink Mobile App Setup Progress

**Date:** December 26, 2024
**Status:** Core Features Complete ✅

## Completed Tasks ✅

### 1. Minimal Expo App Setup ✅
- Expo SDK 54 with expo-router
- expo-dev-client for development builds
- Successfully builds and runs on Android emulator

### 2. NativeWind/Tailwind Setup ✅
- NativeWind ^4.2.1
- Tailwind CSS ^3.4.17 (v3 required, NOT v4)
- Config files: `tailwind.config.js`, `babel.config.js`, `metro.config.js`, `global.css`

### 3. React Native Reusables ✅
- Components in `components/ui/`: button.tsx, text.tsx, input.tsx
- Dependencies: class-variance-authority, clsx, tailwind-merge, lucide-react-native
- CLI: `bunx --bun @react-native-reusables/cli@latest add [component]`

### 4. Drawer Navigation ✅
- `@react-navigation/drawer` ^7.7.10
- Auth flow: `(auth)/login.tsx`, `(auth)/signup.tsx`
- Main app: Drawer with Projects & Settings

### 5. OpenSeadragon DOM Component ✅
- Expo DOM Components with `'use dom'` directive
- `components/plan-viewer/OpenSeadragonViewer.tsx`
- Dependencies: `openseadragon`, `react-native-webview`, `@types/openseadragon`
- Test DZI: `https://openseadragon.github.io/example-images/duomo/duomo.dzi`

### 6. Authentication (better-auth) ✅
- `better-auth` client in `lib/auth.ts`
- `expo-secure-store` for secure token storage
- AuthProvider context in `lib/auth-context.tsx`
- Login/Signup screens with form validation
- Session-based navigation guards
- Backend CORS configured for mobile origins

### 7. Effect-TS API Client ✅
- Shared types package: `packages/shared-types`
- Effect-based API client: `lib/api/client.ts`
- React hooks for data fetching: `lib/api/hooks.ts`
- Type-safe schema validation with Effect Schema
- Projects and Plans screens connected to real API

## Current File Structure

```
packages/mobile/
├── app/
│   ├── _layout.tsx              # Root layout with AuthProvider
│   ├── index.tsx                # Entry/redirect
│   ├── (auth)/
│   │   ├── _layout.tsx
│   │   ├── login.tsx            # Login screen with form
│   │   └── signup.tsx           # Signup screen with form
│   └── (main)/
│       ├── _layout.tsx          # Drawer navigator
│       ├── projects/
│       │   ├── index.tsx        # Projects list (real API)
│       │   └── [projectId]/plans/
│       │       ├── index.tsx    # Plans list (real API)
│       │       └── [planId].tsx # Plan viewer with OpenSeadragon
│       └── settings/
│           └── index.tsx        # Settings with sign out
├── components/
│   ├── ui/
│   │   ├── button.tsx
│   │   ├── text.tsx
│   │   ├── input.tsx
│   │   └── index.ts
│   └── plan-viewer/
│       └── OpenSeadragonViewer.tsx
├── lib/
│   ├── utils.ts                 # cn() helper
│   ├── auth.ts                  # better-auth client
│   ├── auth-context.tsx         # AuthProvider + hooks
│   └── api/
│       ├── index.ts             # API exports
│       ├── config.ts            # API URL config
│       ├── client.ts            # Effect-based API client
│       └── hooks.ts             # React hooks for API
├── tailwind.config.js
├── babel.config.js
├── metro.config.js
├── global.css
├── nativewind-env.d.ts
└── .env                         # EXPO_PUBLIC_API_URL
```

## Shared Types Package

```
packages/shared-types/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts
    └── schemas/
        ├── projects.ts          # Project schemas
        ├── plans.ts             # Plan schemas
        ├── sheets.ts            # Sheet schemas
        └── markers.ts           # Marker/Hyperlink schemas
```

## Pending Tasks

### Next Steps
- [ ] Complete plan viewer integration with real DZI tiles
- [ ] Add sheet navigation within plans
- [ ] Add marker overlay on plan viewer
- [ ] Add offline support with AsyncStorage
- [ ] Add photo/media capture and upload
- [ ] Add project creation form

## Commands

```bash
# Start dev server
bun start

# Build for Android
bun run android

# Clean rebuild (required after adding native modules)
rm -rf android ios .expo node_modules/.cache
bun run prebuild
bun run android

# Add RNR components
bunx --bun @react-native-reusables/cli@latest add [component]
```

## Key Dependencies

```json
{
  "@sitelink/shared-types": "workspace:*",
  "@react-navigation/drawer": "^7.7.10",
  "better-auth": "^1.4.9",
  "effect": "^3.19.13",
  "@effect/platform": "^0.94.0",
  "expo-secure-store": "^15.0.8",
  "nativewind": "^4.2.1",
  "tailwindcss": "^3.4.17",
  "expo-router": "~6.0.0",
  "expo-dev-client": "~6.0.20",
  "lucide-react-native": "^0.562.0",
  "openseadragon": "^5.0.1"
}
```

## API Endpoints Used

```
GET  /api/projects/organizations/{orgId}/projects  - List projects
GET  /api/projects/{id}                            - Get project
POST /api/projects/                                - Create project
GET  /api/projects/{projectId}/plans               - List plans
GET  /api/plans/{id}                               - Get plan
GET  /api/plans/{planId}/sheets                    - List sheets
GET  /api/plans/{planId}/sheets/{sheetId}/dzi      - Get DZI for OpenSeadragon
GET  /api/plans/{planId}/sheets/{sheetId}/tiles    - Get tiles
GET  /api/plans/{planId}/sheets/{sheetId}/markers  - Get markers
```

## Resources

- [React Native Reusables](https://reactnativereusables.com/docs)
- [NativeWind v4](https://www.nativewind.dev/docs)
- [Expo DOM Components](https://docs.expo.dev/guides/dom-components/)
- [Expo Router](https://docs.expo.dev/router/introduction/)
- [better-auth Expo](https://github.com/expo/examples/tree/master/with-better-auth)
- [Effect-TS](https://effect.website)
