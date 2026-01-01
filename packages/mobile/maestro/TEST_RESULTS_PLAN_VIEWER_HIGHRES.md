# High-Resolution Plan Viewer Testing Results

**Test Date:** 2026-01-01
**Environment:** Android Emulator (Pixel 9 Pro - emulator-5554)
**Backend:** http://10.0.2.2:8788
**Mobile App:** Expo Dev Build
**Test Type:** Maestro Automated + Manual Testing Guide

---

## Executive Summary

**Status:** Test flow created but **not executed** due to missing test data.

**Issue:** All plans in the test database show "0 Sheets", meaning no PDFs have been processed into high-resolution JPEG images. The plan viewer requires processed sheets with high-res images to test the caching and loading behavior.

**Recommendation:** Set up proper test data with processed plans before executing the full test suite.

---

## Test Environment Status

### Backend (Port 8788)
- **Status:** Running
- **Process ID:** 98824
- **API Endpoint:** http://10.0.2.2:8788 (Android emulator)

### Mobile App
- **Status:** Running (Expo dev server active)
- **Device:** emulator-5554 (Pixel 9 Pro, Android)
- **App State:** Logged in to "Test Project"
- **Plans Available:** 6 plans (sample-A6-plan, Test Plan 8-12)
- **Sheets Available:** 0 (no processed sheets)

### Test Data Gap
All plans show:
- 0 Sheets
- 0 Markers
- Status: PENDING or DRAFT

This indicates PDFs have not been uploaded/processed through the queue system to generate:
1. High-res JPEG images
2. DZI tiles (legacy)
3. Marker detection data

---

## Maestro Test Flow Created

**File Location:** `/home/woodson/Code/projects/sitelink/packages/mobile/maestro/expo_dev_build/logged_in/plan_viewer_highres.yml`

### Test Coverage

The automated test flow includes comprehensive scenarios:

#### Scenario A: First-Time Load (Cache Miss)
- Navigate to plan viewer
- Verify download progress indicator (0-100%)
- Verify high-res image loads after download
- Screenshot: `plan_viewer_02_download_progress.png`
- Screenshot: `plan_viewer_03_highres_loaded.png`

#### Scenario B: Second Load (Cache Hit)
- Navigate back to plans list
- Re-open same plan
- Verify instant loading (no progress bar)
- Verify image renders from cache
- Screenshot: `plan_viewer_06_cache_instant_load.png`

#### Scenario C: Marker Functionality
- **Marker Tap:** Opens MarkerDetailsModal
  - Screenshot: `plan_viewer_04_marker_modal.png`
- **Marker Long-Press:** Adjustment mode (pulsing border)
  - Screenshot: `plan_viewer_05_marker_adjustment.png`
- **Go to Sheet Navigation:** Target sheet loads with highlighted marker
  - Screenshot: `plan_viewer_09_marker_navigation.png`

#### Scenario D: Multi-Sheet Navigation
- Navigate between sheets using sheet selector
- Verify first view shows download progress
- Verify cached sheets load instantly
- Screenshot: `plan_viewer_07_sheet_navigation.png`
- Screenshot: `plan_viewer_08_cached_sheet_reload.png`

### Expected Screenshots (10 Total)
1. `plan_viewer_01_plans_screen` - Initial plans list
2. `plan_viewer_02_download_progress` - First load with progress UI
3. `plan_viewer_03_highres_loaded` - High-res image after download
4. `plan_viewer_04_marker_modal` - Marker details modal
5. `plan_viewer_05_marker_adjustment` - Marker in adjustment mode
6. `plan_viewer_06_cache_instant_load` - Second load from cache
7. `plan_viewer_07_sheet_navigation` - Multi-sheet navigation
8. `plan_viewer_08_cached_sheet_reload` - Cached sheet reload
9. `plan_viewer_09_marker_navigation` - Target sheet after "Go to Sheet"
10. `plan_viewer_10_final_state` - Final state verification

---

## Manual Testing Guide

Since automated testing requires processed plan data, use this manual guide to test the high-res plan viewer once test data is available.

### Prerequisites

1. **Upload and Process a Test Plan**
   ```bash
   # Use a sample PDF with multiple sheets
   # Ensure the queue system processes it fully:
   # Queue 1: R2 Upload → PDF Processing
   # Queue 2: PDF → Tiles (TileJob)
   # Queue 3: Tiles → Metadata (MetadataExtractionJob)
   # Queue 4: Metadata → Marker Detection (MarkerDetectionJob)
   ```

2. **Verify Plan Has Sheets**
   - Check database: `plans` table should have `sheet_count > 0`
   - Check R2 storage: High-res JPEGs should exist at `plans/{planId}/sheets/{sheetId}/high-res.jpg`
   - Check mobile app: Plan card should show "X Sheets" (not "0 Sheets")

### Test Procedure

#### Test 1: Cache Miss - First-Time Download

1. **Clear App Cache** (optional, ensures clean test)
   - Settings → Clear cache
   - Or: Reinstall app

2. **Navigate to Plan Viewer**
   - Open a project with plans
   - Tap on a plan with sheets (e.g., "sample-A6-plan")
   - Tap on first sheet

3. **Verify Download Progress**
   - [ ] Progress indicator appears (0% → 100%)
   - [ ] Progress bar or percentage text visible
   - [ ] UI is responsive during download
   - [ ] Download completes without errors

4. **Verify High-Res Image**
   - [ ] Image loads after download completes
   - [ ] Image quality is high (300 DPI)
   - [ ] Image fills viewport correctly
   - [ ] Pan and zoom work smoothly
   - [ ] No tile-fetching network requests (check logs)

5. **Take Screenshots**
   - Screenshot during download (progress bar visible)
   - Screenshot after load (high-res image displayed)

#### Test 2: Cache Hit - Instant Load

1. **Navigate Away**
   - Back to sheets list
   - Or: Back to plans list

2. **Re-Open Same Sheet**
   - Tap on the same sheet again

3. **Verify Instant Load**
   - [ ] No progress indicator appears
   - [ ] Image renders immediately
   - [ ] Load time < 500ms (instant)
   - [ ] Image quality matches first load

4. **Take Screenshot**
   - Screenshot showing instant load (no progress UI)

#### Test 3: Marker Interactions

**Prerequisite:** Sheet must have detected markers (callouts)

1. **Marker Tap**
   - Tap on a marker (circle or triangle)
   - [ ] MarkerDetailsModal opens
   - [ ] Modal shows marker metadata (detail number, sheet reference)
   - [ ] Modal has "Go to Sheet" button (if applicable)
   - [ ] Close button works

2. **Marker Long-Press**
   - Long-press on a marker (hold for 1-2 seconds)
   - [ ] Marker enters adjustment mode
   - [ ] Pulsing border or visual indicator appears
   - [ ] Marker can be dragged (position adjustment)
   - [ ] Tap elsewhere to exit adjustment mode

3. **Go to Sheet Navigation**
   - Open a marker with a sheet reference (e.g., "5/A7" = Detail 5 on Sheet A7)
   - Tap "Go to Sheet" button in modal
   - [ ] App navigates to target sheet (A7)
   - [ ] Target marker (Detail 5) is highlighted (green glow)
   - [ ] Target sheet loads (from cache or downloads)
   - [ ] Viewport centers on target marker

4. **Take Screenshots**
   - Marker modal open
   - Marker in adjustment mode
   - Target sheet with highlighted marker

#### Test 4: Multi-Sheet Navigation

1. **Navigate to Next Sheet**
   - Use sheet selector or navigation buttons
   - Tap "Next Sheet" or select Sheet 2 from list

2. **Verify Loading Behavior**
   - **First view of sheet:**
     - [ ] Download progress shows (if not cached)
     - [ ] High-res image loads after download
   - **Subsequent views:**
     - [ ] Instant load from cache
     - [ ] No progress indicator

3. **Navigate Between Sheets**
   - Switch between Sheet 1, Sheet 2, Sheet 3
   - [ ] First sheet loads from cache (instant)
   - [ ] New sheets download with progress
   - [ ] All cached sheets load instantly

4. **Take Screenshots**
   - Sheet navigation UI
   - Different sheets loaded

#### Test 5: Cache Persistence

1. **Close and Reopen App**
   - Kill app process
   - Reopen app
   - Navigate to same plan/sheet

2. **Verify Cache Persistence**
   - [ ] Previously viewed sheets load instantly
   - [ ] No re-download required
   - [ ] Cache survives app restart

---

## Performance Benchmarks

### Target Metrics

| Metric | Target | Notes |
|--------|--------|-------|
| **First Load (Download)** | < 5s for 300 DPI JPEG | Depends on image size and network |
| **Cached Load** | < 500ms | Should be near-instant |
| **Progress UI Update** | 60 FPS | Smooth percentage updates |
| **Pan/Zoom Performance** | 60 FPS | OpenSeadragon rendering |
| **Marker Tap Response** | < 200ms | Modal opens immediately |

### Actual Results

*To be filled after testing with real data*

| Metric | Result | Pass/Fail |
|--------|--------|-----------|
| First Load (Download) | - | - |
| Cached Load | - | - |
| Progress UI Update | - | - |
| Pan/Zoom Performance | - | - |
| Marker Tap Response | - | - |

---

## Verification Checklist

### Core Functionality

- [ ] Download progress shows correctly (0-100%)
- [ ] High-res image loads after download
- [ ] Cache hit loads instantly (no progress)
- [ ] Image quality is high (300 DPI)
- [ ] No tile-fetching network requests (verified in logs)

### Marker Functionality

- [ ] Markers are visible and positioned correctly
- [ ] Marker tap opens modal
- [ ] Marker long-press enables adjustment mode
- [ ] Marker navigation works (Go to Sheet)
- [ ] Target marker highlights with green glow

### Multi-Sheet Behavior

- [ ] Sheet selector/navigation works
- [ ] First view of new sheet shows download progress
- [ ] Cached sheets load instantly
- [ ] No regressions in sheet switching

### Cache Behavior

- [ ] Cache persists across app restarts
- [ ] Cache directory is accessible (`expo-file-system`)
- [ ] Cache files are named correctly (planId-sheetId.jpg)
- [ ] Old cache files are cleaned up (if applicable)

### Edge Cases

- [ ] Offline mode (cached sheets work, uncached fail gracefully)
- [ ] Network errors during download (error message shown)
- [ ] Large images (> 10 MB) download without issues
- [ ] Rapid sheet switching (no race conditions)

---

## Issues Discovered

*To be filled during testing*

### Blockers

- **Missing Test Data:** No plans with processed sheets/images in database

### Critical Issues

*None yet*

### High Priority

*None yet*

### Medium Priority

*None yet*

### Low Priority / Enhancements

*None yet*

---

## Test Data Setup Instructions

To properly test the high-res plan viewer, you need to set up test data with processed plans.

### Option 1: Use Sample Plan

1. **Upload Sample PDF**
   ```bash
   # Upload a sample construction plan PDF (multi-page)
   # Via mobile app: Camera → Upload Plan
   # Or via API: POST /api/plans
   ```

2. **Verify Queue Processing**
   ```bash
   # Check queue status
   # Ensure all 4 queues process successfully:
   # - R2Notification
   # - TileJob
   # - MetadataExtractionJob
   # - MarkerDetectionJob
   ```

3. **Verify High-Res Images**
   ```bash
   # Check R2 storage for high-res JPEGs
   # Path: plans/{planId}/sheets/{sheetId}/high-res.jpg
   ```

### Option 2: Use Existing Plan (If Available)

1. Check if any plans in production/staging have processed sheets
2. Export database and import to dev environment
3. Sync R2 storage (copy high-res images)

### Option 3: Mock Data (Quick Test)

1. Create mock high-res images (300 DPI JPEGs)
2. Upload directly to R2 at correct paths
3. Insert sheet records in database
4. Bypass queue processing (for quick testing only)

---

## Recommendations

### Immediate Actions

1. **Set Up Test Data**
   - Upload at least 1 sample plan with 3-5 sheets
   - Ensure full queue processing completes
   - Verify high-res images exist in R2

2. **Execute Maestro Test Flow**
   ```bash
   cd /home/woodson/Code/projects/sitelink/packages/mobile
   maestro test maestro/expo_dev_build/logged_in/plan_viewer_highres.yml
   ```

3. **Review Screenshots**
   - Compare screenshots against expected behavior
   - Document any visual regressions

### Future Improvements

1. **Automated Test Data Seeding**
   - Create script to seed test database with processed plans
   - Include sample high-res images in test fixtures

2. **E2E Testing Pipeline**
   - Integrate Maestro tests into CI/CD
   - Run tests on every PR that touches plan viewer code

3. **Performance Monitoring**
   - Add instrumentation to track download times
   - Monitor cache hit/miss ratios
   - Alert on performance regressions

4. **Network Condition Testing**
   - Test on slow 3G networks
   - Test with intermittent connectivity
   - Test offline behavior

---

## Files Created

### Test Flows
- `/home/woodson/Code/projects/sitelink/packages/mobile/maestro/expo_dev_build/logged_in/plan_viewer_highres.yml`
  - Comprehensive automated test flow (10 screenshots)

### Documentation
- `/home/woodson/Code/projects/sitelink/packages/mobile/maestro/TEST_RESULTS_PLAN_VIEWER_HIGHRES.md`
  - This document

---

## Next Steps

1. **Set up test data** with processed plans and high-res images
2. **Execute Maestro test flow** to capture all 10 screenshots
3. **Review results** against verification checklist
4. **Document any issues** in the "Issues Discovered" section
5. **Update performance benchmarks** with actual results
6. **Create follow-up tasks** for any bugs or improvements found

---

## Appendix: Technical Details

### High-Res Endpoint
```
GET /api/plans/{planId}/sheets/{sheetId}/high-res.jpg
```

### Cache Location
```
expo-file-system cacheDirectory
Path: {cacheDirectory}/plans/{planId}-{sheetId}.jpg
```

### Implementation Files
- `packages/mobile/components/plan-viewer/PlanViewer.tsx` - Main viewer component
- `packages/mobile/components/plan-viewer/OpenSeadragonViewer.tsx` - OpenSeadragon integration
- `packages/mobile/hooks/useCachedImage.ts` - Cache-first image loading (likely)
- `packages/backend/src/features/plans/api.ts` - High-res endpoint handler

### Expected Behavior
1. **First load:** Download high-res JPEG from backend → Save to cache → Display
2. **Subsequent loads:** Load from cache immediately (no network request)
3. **Progress UI:** Show percentage during download (0-100%)
4. **OpenSeadragon:** Render single image (not DZI tiles)
5. **Markers:** Overlay markers on image, interactive

---

**Test Status:** Awaiting test data setup
**Test Flow:** Ready for execution
**Documentation:** Complete
**Next Action:** Upload sample plan with processed sheets
