# Expo & Mobile Engineering Core

## Framework: Expo (Managed Workflow)
- **Routing**: Use `expo-router`. File-based navigation in `app/`.
- **Config**: Settings live in `app.json`. Use `bunx expo` for CLI commands.
- **Components**: Prefer `react-native-reusables` (Radix primitives).

## Styling: NativeWind
- **Syntax**: Use `className="..."` with Tailwind utility classes.
- **Merge**: Use `cn()` utility to merge classes safely.
- **Safe Area**: Always wrap screen content in `<SafeAreaView className="flex-1">`.

## Testing: Maestro (Visual Verification)
- **Selectors**:
  - `testID="login-btn"` (React Native) -> `id: login-btn` (Maestro).
  - `accessibilityLabel="Submit"` -> `text: Submit`.
- **POM Strategy**:
  - Define selectors in `.maestro/elements/<ScreenName>.js`.
  - Export as `output.elementName = "testID"`.
- **Debugging**:
  - If a test fails, run `maestro hierarchy` to check visibility.
  - Use `maestro screenshot` to verify layout against design.