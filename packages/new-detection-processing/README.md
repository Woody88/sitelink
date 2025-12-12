# Construction Plan Callout Detection

Automatic detection of sheet reference callouts in construction plan PDFs using Computer Vision + Vision LLM.

## Overview

This system detects callout symbols (like "1/A5", "2/A6") on construction plan sheets and extracts their positions for creating clickable hyperlinks in viewers like OpenSeadragon.

**Accuracy: 80%** (8/10 callouts fully accurate, with graceful degradation for the rest)

## How It Works

```
PDF → PNG (300 DPI) → OpenCV Shape Detection → LLM Text Reading → Verification → Results
```

1. **OpenCV** detects geometric shapes (circles, triangles, compound shapes)
2. **LLM** validates each shape and reads the callout text
3. **Verification** confirms centering and corrects misreads
4. **Output** provides normalized coordinates for OpenSeadragon

See `FINAL_SOLUTION.md` for complete technical details.

## Prerequisites

- [Bun](https://bun.sh) runtime
- [vips](https://www.libvips.org/) for PDF→PNG conversion
- [OpenCV](https://opencv.org/) Python bindings
- OpenRouter API key

## Setup

1. Install dependencies:
```bash
bun install
pip install opencv-python numpy
```

2. Create `.env` file:
```
OPENROUTER_API_KEY=your_api_key_here
```

3. Verify installations:
```bash
vips --version
python3 -c "import cv2; import numpy; print('OpenCV ready')"
```

## Usage

```bash
# Recommended: CV → LLM detection
bun run src/index.ts --method=cvllm --dpi=300

# Options:
# --method=cvllm       CV shapes + LLM text reading (recommended)
# --dpi=300            Image resolution (300-600)
# --model=flash        LLM model (flash or pro)
```

## Output Format

```json
{
  "success": true,
  "sheetNumber": "A2",
  "hyperlinks": [
    {
      "calloutRef": "1/A5",
      "targetSheetRef": "A5",
      "x": 0.5725,        // Normalized 0-1 for OpenSeadragon
      "y": 0.5133,
      "pixelX": 1460,
      "pixelY": 1694,
      "confidence": 0.90
    }
  ],
  "unmatchedCallouts": ["1/A7"]  // Needs manual review
}
```

## Project Structure

```
new-detection-processing/
├── src/
│   ├── index.ts                    # CLI entry point
│   └── services/
│       ├── cvLLMDetection.ts       # Main CV→LLM pipeline
│       ├── enhancedShapeDetection.py  # OpenCV detection
│       ├── annotateImage.py        # Visual annotation
│       └── pdfProcessor.ts         # PDF→PNG conversion
├── output/
│   └── cv_llm_debug/               # Debug outputs
│       ├── callouts_annotated.png  # Visual result
│       ├── cv_detection_debug.png  # CV detections
│       └── crops/                  # Shape crops
├── FINAL_SOLUTION.md               # Complete documentation
├── SOLUTION_EXPLANATION.md         # Technical deep-dive
└── sample-single-plan.pdf          # Test PDF
```

## Expected Results (Sample PDF)

| Callout | Instances | Status |
|---------|-----------|--------|
| 1/A5 | 1 | ✅ Detected |
| 1/A6 | 2 | ✅ Detected |
| 1/A7 | 1 | ⚠️ Needs review |
| 2/A5 | 1 | ✅ Detected |
| 2/A6 | 2 | ✅ Detected |
| 2/A7 | 1 | ❌ Missed |
| 3/A5 | 1 | ✅ Detected |
| 3/A7 | 1 | ✅ Detected |

**Result: 8/10 (80%) fully accurate**

## Documentation

- `FINAL_SOLUTION.md` - Complete solution with database schema and frontend integration
- `SOLUTION_EXPLANATION.md` - Technical architecture with diagrams

## Known Limitations

1. **Closely-spaced callouts** may be detected as one shape
2. **Edge callouts** may be cropped incorrectly
3. **Non-standard formats** (not "N/SHEET") are rejected

The system provides graceful degradation with `unmatchedCallouts` for manual handling.
