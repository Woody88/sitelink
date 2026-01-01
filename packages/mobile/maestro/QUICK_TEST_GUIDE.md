# Quick Test Guide: High-Res Plan Viewer

## Prerequisites

1. Backend running on port 8788
2. Expo dev server running
3. Android emulator (emulator-5554) running
4. **At least one plan with processed sheets** (high-res JPEGs in R2)

## Check Prerequisites

```bash
# 1. Check backend
ps aux | grep 8788

# 2. Check Expo
cd /home/woodson/Code/projects/sitelink/packages/mobile
bun expo start

# 3. Check emulator
adb devices
# Should show: emulator-5554    device

# 4. Check test data (verify plans have sheets)
# Open mobile app → Plans screen → Should see "X Sheets" (not "0 Sheets")
```

## Run Maestro Test

```bash
cd /home/woodson/Code/projects/sitelink/packages/mobile

# Execute the high-res plan viewer test
maestro test maestro/expo_dev_build/logged_in/plan_viewer_highres.yml
```

## Expected Output

The test will:
1. Login (if needed)
2. Navigate to a plan with sheets
3. Test first-time download (cache miss)
4. Test cached load (cache hit)
5. Test marker interactions
6. Test multi-sheet navigation
7. Capture 10 screenshots

## Screenshots Location

Screenshots will be saved in:
```
~/.maestro/tests/{timestamp}/
```

Look for files named:
- `plan_viewer_01_plans_screen.png`
- `plan_viewer_02_download_progress.png`
- `plan_viewer_03_highres_loaded.png`
- `plan_viewer_04_marker_modal.png`
- `plan_viewer_05_marker_adjustment.png`
- `plan_viewer_06_cache_instant_load.png`
- `plan_viewer_07_sheet_navigation.png`
- `plan_viewer_08_cached_sheet_reload.png`
- `plan_viewer_09_marker_navigation.png`
- `plan_viewer_10_final_state.png`

## Review Results

1. **Check screenshots** for visual correctness
2. **Check Maestro output** for any failures
3. **Update test results document** with findings:
   ```
   packages/mobile/maestro/TEST_RESULTS_PLAN_VIEWER_HIGHRES.md
   ```

## Common Issues

### "Element not found"
- Test data missing (no plans with sheets)
- UI changed (element IDs/text different)
- App not on correct screen

### "Timeout"
- Download taking too long (increase timeout in YAML)
- Network issues
- Backend not responding

### "No device connected"
- Emulator not running
- Run: `adb devices` to check

## Manual Testing Alternative

If automated test fails, use the manual guide:
```
packages/mobile/maestro/TEST_RESULTS_PLAN_VIEWER_HIGHRES.md
Section: "Manual Testing Guide"
```

## Quick Validation Checklist

After running test, verify:
- [ ] Download progress shown on first load
- [ ] High-res image loads correctly
- [ ] Cached load is instant (no progress bar)
- [ ] Markers are visible and interactive
- [ ] Sheet navigation works
- [ ] All 10 screenshots captured

## Report Issues

Document any issues found in:
```
packages/mobile/maestro/TEST_RESULTS_PLAN_VIEWER_HIGHRES.md
Section: "Issues Discovered"
```

Include:
- Issue description
- Steps to reproduce
- Expected vs actual behavior
- Screenshots
- Device/environment info
