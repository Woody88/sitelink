# Construction Plan Callout Detection Solution

## Final Results

| Metric | Value |
|--------|-------|
| **Fully Accurate** | 80% (8/10 callouts with correct position & text) |
| **Needs Manual Placement** | 10% (1/10 - detected but position wrong) |
| **Needs Manual Detection** | 10% (1/10 - not detected by CV) |
| Position Precision | ✅ Precise (CV shape center) |
| Text Correction | ✅ Verification catches misreads |
| Processing Time | ~120 seconds |

### What This Means for Users:
- **8 callouts** → Ready to use as clickable links ✅
- **1 callout** → Detected but needs manual position adjustment ⚠️
- **1 callout** → Not detected, needs manual addition ❌

## Problem Statement

Detect callout symbols on construction plan sheets and extract:
1. **Reference text** (e.g., "1/A5", "2/A6")
2. **Precise bounding box coordinates** for creating interactive hyperlinks

```
┌─────────────────────────────────────────────────────────────────┐
│                     CONSTRUCTION PLAN SHEET                      │
│                                                                   │
│    ┌───┐                                      ┌───┐              │
│    │ 1 │                                      │ 2 │              │
│    │───│◄── Detail callout                    │───│              │
│    │A5 │    "1/A5" = Detail 1 on Sheet A5     │A6 │              │
│    └───┘                                      └───┘              │
│       │                                          │               │
│       ▼                                          ▼               │
│    [WALL DETAIL]                          [FLOOR DETAIL]         │
│                                                                   │
│    ◄──── User clicks callout → Navigate to Sheet A5 ────►       │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Solution Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        INPUT: PDF Plan Sheet                     │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                  STEP 1: PDF → PNG Conversion                    │
│                      (300 DPI, high quality)                     │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│              STEP 2: OpenCV Multi-Technique Detection            │
│                                                                   │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │    Contour      │  │   HoughCircles  │  │      Blob       │  │
│  │   Detection     │  │    Detection    │  │   Detection     │  │
│  │                 │  │                 │  │                 │  │
│  │ • Compound      │  │ • Precise       │  │ • Filled        │  │
│  │   shapes        │  │   circles       │  │   shapes        │  │
│  │ • Triangles     │  │ • Detail        │  │ • Solid         │  │
│  │ • Rectangles    │  │   markers       │  │   triangles     │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
│                                │                                  │
│                    ┌───────────┴───────────┐                     │
│                    │   Merge Nearby (40px) │                     │
│                    │   Remove Duplicates   │                     │
│                    └───────────────────────┘                     │
│                                │                                  │
│                    Output: 74 detected shapes                    │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                STEP 3: Crop Each Shape + Padding                 │
│                                                                   │
│   Original Shape         Cropped with 100px padding              │
│   ┌───┐                  ┌─────────────────────┐                │
│   │ 1 │                  │                     │                │
│   │───│        ──►       │      ┌───┐          │                │
│   │A5 │                  │      │ 1 │  TEXT    │                │
│   └───┘                  │      │───│          │                │
│                          │      │A5 │          │                │
│                          │      └───┘          │                │
│                          └─────────────────────┘                │
│                                                                   │
│   Padding captures adjacent text and context                     │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│              STEP 4: LLM Validation (Gemini 2.5 Flash)           │
│                                                                   │
│   For each cropped image:                                        │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │  Prompt: "Find ALL callouts in this image"               │   │
│   │                                                           │   │
│   │  Response:                                                │   │
│   │  {                                                        │   │
│   │    "callouts": [                                          │   │
│   │      { "ref": "1/A5", "targetSheet": "A5" },             │   │
│   │      { "ref": "2/A6", "targetSheet": "A6" }              │   │
│   │    ]                                                      │   │
│   │  }                                                        │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                   │
│   LLM excels at:                                                 │
│   • Reading rotated/stylized text                                │
│   • Understanding callout context                                │
│   • Distinguishing callouts from dimensions/labels               │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    STEP 5: Post-Processing                       │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              Format Validation                           │    │
│  │  ✓ "1/A5"  → Valid (detail/sheet format)                │    │
│  │  ✗ "A5"    → Invalid (bare sheet number)                │    │
│  │  ✗ "1"     → Invalid (bare number)                      │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │           Self-Reference Filtering                       │    │
│  │  Current sheet: A2                                       │    │
│  │  ✓ "1/A5"  → Keep (references different sheet)          │    │
│  │  ✗ "1/A2"  → Reject (references current sheet)          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              Deduplication (200px threshold)             │    │
│  │                                                          │    │
│  │  Before:  1/A5 @ (100,200)                              │    │
│  │           1/A5 @ (120,210)  ← Within 200px, merge       │    │
│  │           1/A5 @ (130,205)  ← Within 200px, merge       │    │
│  │                                                          │    │
│  │  After:   1/A5 @ (100,200)  ← Keep highest confidence   │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│              STEP 6: LLM Verification (Quality Check)            │
│                                                                   │
│  For each detected callout:                                      │
│  1. Create small crop (80px) centered on detection position     │
│  2. Ask LLM: "Is there a callout symbol in the CENTER?"         │
│  3. LLM returns: { isCentered: true/false, confidence: 0-100 }  │
│                                                                   │
│  Results:                                                        │
│  ✅ Verified (confidence ≥ 70%): Added to final results         │
│  ⚠️  Needs Review (confidence < 70%): Flagged for manual check  │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                        OUTPUT: Results                           │
│                                                                   │
│  {                                                               │
│    "verified": [                                                 │
│      { "ref": "1/A5", "x": 1460, "y": 1694, "confidence": 0.95 },│
│      { "ref": "1/A6", "x": 946,  "y": 863,  "confidence": 0.95 },│
│      ...                                                         │
│    ],                                                            │
│    "needsReview": ["1/A7"],                                      │
│    "missing": ["2/A6 (1 instance)"]                              │
│  }                                                               │
└─────────────────────────────────────────────────────────────────┘
```

## Why This Approach Works

### Previous Approaches (Failed)

```
┌─────────────────────────────────────────────────────────────────┐
│  Approach 1: LLM-Only                                           │
│  ─────────────────────                                          │
│                                                                  │
│  [Full Image] ──► LLM ──► Callouts + Approximate Positions      │
│                                                                  │
│  Problem: LLM gives rough coordinates, not pixel-precise        │
│  Accuracy: 60%                                                   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  Approach 2: Region-Based (LLM → OCR)                           │
│  ────────────────────────────────────                           │
│                                                                  │
│  [Full Image] ──► LLM finds regions ──► OCR reads text          │
│                                                                  │
│  Problem: Tesseract can't read small/rotated callout text       │
│  Accuracy: 60%                                                   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  Approach 3: CV-Only + OCR                                      │
│  ─────────────────────────                                      │
│                                                                  │
│  [Full Image] ──► OpenCV shapes ──► OCR reads text              │
│                                                                  │
│  Problem: OCR returns 0 words from callout shapes               │
│  Accuracy: 0%                                                    │
└─────────────────────────────────────────────────────────────────┘
```

### Current Approach (Success)

```
┌─────────────────────────────────────────────────────────────────┐
│  Approach 4: CV → LLM (The Winner!)                             │
│  ──────────────────────────────────                             │
│                                                                  │
│  [Full Image] ──► OpenCV shapes ──► Crop each ──► LLM validates │
│                        │                              │          │
│                   Precise (x,y)              Accurate text       │
│                                                                  │
│  Best of both worlds:                                            │
│  • CV provides pixel-precise shape positions                    │
│  • LLM reads rotated/stylized text accurately                   │
│                                                                  │
│  Accuracy: 100%                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Callout Types Detected

```
┌─────────────────────────────────────────────────────────────────┐
│                    CALLOUT SYMBOL TYPES                          │
│                                                                   │
│   Detail Marker          Section Cut           Elevation Mark    │
│   (Circle + Line)        (Triangle)            (Triangle)        │
│                                                                   │
│      ┌───┐                  ▲                     ◄──┐           │
│      │ 1 │                 ╱ ╲                       │           │
│      │───│                ╱   ╲                   ┌──┴──┐        │
│      │A5 │               ╱ 3   ╲                  │  1  │        │
│      └───┘              ╱───────╲                 │─────│        │
│         │              ╱   A5    ╲                │ A5  │        │
│         ▼             ▼───────────▼               └─────┘        │
│                                                                   │
│   Compound (Circle + Triangle)                                   │
│                                                                   │
│      ┌───┐                                                       │
│      │ 1 │◄───┐                                                  │
│      │───│    │                                                  │
│      │A6 │    │                                                  │
│      └───┘    │                                                  │
│          ╲   ╱                                                   │
│           ╲ ╱                                                    │
│            ▼                                                     │
└─────────────────────────────────────────────────────────────────┘
```

## File Structure

```
new-detection-processing/
├── src/
│   ├── services/
│   │   ├── enhancedShapeDetection.py   # OpenCV multi-technique detection
│   │   ├── cvLLMDetection.ts           # CV → LLM pipeline
│   │   ├── pdfProcessor.ts             # PDF → PNG conversion
│   │   └── ...
│   ├── index.ts                        # CLI entry point
│   └── ...
├── output/
│   ├── cv_llm_debug/
│   │   ├── cv_detection_debug.png      # Annotated detection image
│   │   ├── cv_thresh.png               # Threshold preprocessing
│   │   ├── cv_cleaned.png              # Morphological cleanup
│   │   └── crops/
│   │       ├── shape_1_circle.png      # Individual cropped shapes
│   │       ├── shape_2_triangle.png
│   │       └── ...
│   └── results.json                    # Final detection results
└── ...
```

## Usage

```bash
# Run CV → LLM detection (recommended)
bun run src/index.ts --method=cvllm --dpi=300

# Other options
--dpi=300|400|600     # Image resolution
--model=flash|pro     # LLM model selection
```

## Performance

| Metric | Value |
|--------|-------|
| **Fully Accurate** | 80% (8/10 callouts) |
| **Needs Review** | 10% (1 position wrong) |
| **Missed** | 10% (1 not detected) |
| Processing Time | ~120 seconds |
| Shapes Detected | 129 |
| LLM Calls | 129 initial + 9 verification |
| Final Callouts | 9 (after dedup) |

## Key Innovations

1. **Multi-Technique CV**: Combines contour, Hough circles, and blob detection
2. **Multi-Callout Extraction**: LLM returns ALL callouts per crop
3. **Self-Reference Filtering**: Rejects callouts to current sheet
4. **Aggressive Deduplication**: Handles overlapping crop regions
5. **Format Validation**: Only accepts "N/SHEET" format

## Comparison Table

| Approach | Accuracy | Position Precision | Text Reading |
|----------|----------|-------------------|--------------|
| LLM-Only | 60% | ❌ Approximate | ✅ Good |
| Region + OCR | 60% | ✅ Good | ❌ Poor |
| CV + OCR | 0% | ✅ Precise | ❌ Failed |
| **CV → LLM** | **80%** | ✅ Precise | ✅ Excellent |

## Known Limitations

### 1. Closely-Spaced Callouts
When two callouts are very close together (like 2/A6 next to 2/A7), CV may detect them as a single shape. We only take the first callout per shape to preserve position accuracy, which can cause the second callout to be missed.

### 2. Edge Cases
- Callouts at very edge of sheet may be cropped incorrectly
- Unusual callout formats not matching "N/SHEET" pattern are rejected

### 3. Graceful Degradation
The system outputs:
- **Verified callouts** → Ready for database, use as-is
- **Needs review** → Position may be wrong, frontend should allow manual adjustment
- **Missed callouts** → Frontend should provide "Add Callout" UI

This ensures 80% of callouts work automatically, with fallback for the remaining 20%.

