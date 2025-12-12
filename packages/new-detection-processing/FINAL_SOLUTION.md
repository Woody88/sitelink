# Final Solution: Construction Plan Callout Detection

## Results Summary

| Metric | Value |
|--------|-------|
| **Fully Accurate** | 80% (8/10 callouts with correct position) |
| **Needs Manual Placement** | 10% (1/10 - detected but position wrong) |
| **Needs Manual Detection** | 10% (1/10 - not detected by CV) |
| **Processing Time** | ~120 seconds |

## Output Format (for Database Storage)

```json
{
  "success": true,
  "sheetNumber": "A2",
  "calloutsFound": 9,
  "calloutsMatched": 8,
  "hyperlinks": [
    {
      "calloutRef": "1/A5",
      "targetSheetRef": "A5",
      "x": 0.5725,           // Normalized (0-1) for OpenSeadragon
      "y": 0.5133,           // Normalized (0-1) for OpenSeadragon
      "pixelX": 1460,        // Pixel position in original image
      "pixelY": 1694,        // Pixel position in original image
      "confidence": 0.90     // 0-1 confidence score
    },
    // ... more callouts
  ],
  "unmatchedCallouts": ["1/A7"],  // Refs that need manual review
  "confidenceStats": {
    "highConfidence": 8,
    "lowConfidence": 1,
    "averageConfidence": 0.85,
    "needsManualReview": true
  }
}
```

## For OpenSeadragon Integration

Use the normalized coordinates (`x`, `y`) which are 0-1 values:

```javascript
// Add clickable overlay at callout position
const overlay = document.createElement('div');
overlay.className = 'callout-link';
overlay.onclick = () => navigateToSheet(callout.targetSheetRef);

viewer.addOverlay({
  element: overlay,
  location: new OpenSeadragon.Point(callout.x, callout.y),
  placement: OpenSeadragon.Placement.CENTER
});
```

---

## Pipeline Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        INPUT: PDF Plan Sheet                     │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                  STEP 1: PDF → PNG (300 DPI)                     │
│                      Using libvips                               │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│              STEP 2: OpenCV Multi-Technique Detection            │
│                                                                   │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│   │   Contour    │  │ HoughCircles │  │     Blob     │          │
│   │  Detection   │  │  Detection   │  │  Detection   │          │
│   └──────────────┘  └──────────────┘  └──────────────┘          │
│                         │                                        │
│                         ▼                                        │
│               Output: ~129 detected shapes                       │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│           STEP 3: Crop Each Shape (70px padding)                 │
│                                                                   │
│   For each shape: Create 70px-padded crop for LLM analysis      │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│         STEP 4: LLM Text Reading (Gemini 2.5 Flash)              │
│                                                                   │
│   For each crop:                                                 │
│   • "Is this a callout? What text does it say?"                 │
│   • Only accept first callout per shape (position accuracy)     │
│   • Validate format: must be "N/SHEET" (e.g., "1/A5")           │
│   • Filter self-references (callouts to current sheet)          │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│              STEP 5: Deduplication (200px threshold)             │
│                                                                   │
│   Merge nearby detections with same ref, keep highest confidence│
│   ~129 shapes → ~9 unique callouts                               │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│         STEP 6: LLM Verification (Quality Check)                 │
│                                                                   │
│   For each callout:                                              │
│   1. Create 80px verification crop centered on position         │
│   2. Ask LLM: "Is callout centered? What does it ACTUALLY say?" │
│   3. Correct misreads (e.g., "2/A7" → "2/A6")                   │
│   4. Flag low-confidence for manual review                       │
│                                                                   │
│   Results:                                                       │
│   ✅ Verified (confidence ≥70%): Final results                  │
│   ⚠️  Needs Review: Position may be wrong, add manually         │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                        OUTPUT                                    │
│                                                                   │
│   • Verified callouts with precise positions (for database)     │
│   • Needs-review list (for manual UI)                            │
│   • Annotated image (for debugging)                              │
│   • Confidence statistics                                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Known Limitations & Flaws

### 1. Closely-Spaced Callouts (10% miss rate)
**Problem:** When 2+ callouts are very close together (e.g., 2/A6 next to 2/A7), the CV detection often groups them as one shape. We only take the first callout to preserve position accuracy.

**Impact:** Some callouts may be missed entirely.

**Workaround:** User can manually add missed callouts via frontend UI.

### 2. Text Misreading (Corrected by verification)
**Problem:** LLM sometimes misreads similar characters (e.g., "6" vs "7").

**Solution:** Verification step re-reads and corrects misread text.

**Impact:** Minimal - most misreads are caught and corrected.

### 3. Position Accuracy vs Detection Recall Trade-off
**Problem:** To get precise positions, we only accept single-callout detections. This means some callouts in multi-callout crops are missed.

**Alternative:** Could accept multiple callouts per crop with LLM-estimated positions, but accuracy drops significantly.

**Current choice:** Prioritize position accuracy (80% accurate) over detection recall.

### 4. Edge Cases Not Handled
- Callouts at very edge of sheet may be missed
- Unusual callout formats not matching "N/SHEET" pattern
- Heavily overlapping callouts

---

## File Structure

```
new-detection-processing/
├── src/
│   └── services/
│       ├── cvLLMDetection.ts      # Main CV→LLM pipeline
│       ├── enhancedShapeDetection.py  # OpenCV multi-technique
│       ├── annotateImage.py       # Draw contours on image
│       └── pdfProcessor.ts        # PDF→PNG conversion
├── output/
│   └── cv_llm_debug/
│       ├── callouts_annotated.png # Visual result
│       ├── cv_detection_debug.png # All CV detections
│       ├── crops/                 # Individual shape crops
│       └── verify/                # Verification crops
└── results.json                   # Final output for database
```

---

## Usage

```bash
# Run detection
bun run src/index.ts --method=cvllm --dpi=300

# With different settings
bun run src/index.ts --method=cvllm --dpi=400 --model=pro
```

---

## Database Schema Suggestion

```sql
CREATE TABLE callout_detections (
  id SERIAL PRIMARY KEY,
  sheet_id INTEGER REFERENCES sheets(id),
  callout_ref VARCHAR(20) NOT NULL,      -- e.g., "1/A5"
  target_sheet VARCHAR(10) NOT NULL,     -- e.g., "A5"
  x_normalized FLOAT NOT NULL,           -- 0-1 for OpenSeadragon
  y_normalized FLOAT NOT NULL,           -- 0-1 for OpenSeadragon
  pixel_x INTEGER NOT NULL,              -- Original pixel position
  pixel_y INTEGER NOT NULL,              -- Original pixel position
  confidence FLOAT NOT NULL,             -- 0-1 confidence score
  needs_review BOOLEAN DEFAULT FALSE,
  manually_added BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE missed_callouts (
  id SERIAL PRIMARY KEY,
  sheet_id INTEGER REFERENCES sheets(id),
  callout_ref VARCHAR(20) NOT NULL,      -- What was expected
  reason VARCHAR(100),                    -- Why it was missed
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## What the Frontend Should Do

1. **Display verified callouts** as clickable hotspots on OpenSeadragon
2. **Show "needs review" indicator** for callouts with `needsReview: true`
3. **Provide "Add Callout" UI** for manually adding missed callouts
4. **Allow position adjustment** for callouts with wrong positions
5. **Track manual additions** separately for training data

---

## Future Improvements

1. **Train a YOLO model** on annotated callouts for faster/better detection
2. **Use higher DPI** (400-600) for small callouts
3. **Template matching** for common callout styles
4. **Active learning** - use manual corrections to improve prompts

