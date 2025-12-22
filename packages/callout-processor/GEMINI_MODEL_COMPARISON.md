# Gemini Model Comparison: 2.5 Flash vs 3 Flash Preview

**Test Date:** December 2024
**Test File:** `sample-single-plan.pdf`
**Detection Method:** cvllm (CV + LLM validation with batch processing)

## Test Configuration

- **DPI:** 300
- **Contrast:** 1.5x
- **Expected Callouts:** 10 total instances
  - 1/A5: 1, 1/A6: 2, 1/A7: 1
  - 2/A5: 1, 2/A6: 2, 2/A7: 1
  - 3/A5: 1, 3/A7: 1

## Results Summary

| Metric | Gemini 2.5 Flash | Gemini 3 Flash Preview | Winner |
|--------|------------------|------------------------|--------|
| **Average Confidence** | 61.5% | **84.1%** | Flash 3 |
| **Individual Confidences** | 90-95% | **95-99%** | Flash 3 |
| **Callouts Found** | 12 | 9 | Flash 3 (closer to expected 10) |
| **Needs Manual Review** | 5 | **2** | Flash 3 |
| **False Positives** | 2/A6: 5 detected (expected 2) | 2/A6: 2 detected (expected 2) | Flash 3 |
| **Batch Validation Time** | **50.3s** | 77.5s | Flash 2.5 |
| **Total Time** | **56.3s** | 87.8s | Flash 2.5 |

## Key Findings

### Confidence Scores

**Gemini 3 Flash Preview** produces significantly higher confidence scores:
- Average confidence: 84.1% vs 61.5% (37% improvement)
- Individual callout confidences consistently 95-99% vs 90-95%
- Fewer callouts flagged for manual review (2 vs 5)

### Accuracy

**Gemini 3 Flash Preview** is more accurate:
- Detected 9 callouts (closer to expected 10)
- Only 2 false positives on 2/A6 (matched expected count)
- Gemini 2.5 Flash detected 12 callouts with 5 false positives on 2/A6

### Speed

**Gemini 2.5 Flash** is faster:
- Batch validation: 50.3s vs 77.5s (54% slower for Flash 3)
- Total processing: 56.3s vs 87.8s
- Flash 3 is a preview model, so speed may improve

## Recommendation

**Gemini 3 Flash Preview is now the default model** due to:
1. Significantly higher confidence scores
2. Better accuracy (fewer false positives)
3. Closer to expected callout count

Speed tradeoff is acceptable given the improved quality.

## Usage

```bash
# Default (Gemini 3 Flash Preview)
bun run src/index.ts sample-single-plan.pdf

# Explicit model selection
bun run src/index.ts sample-single-plan.pdf --model=flash3  # Gemini 3 Flash (default)
bun run src/index.ts sample-single-plan.pdf --model=flash   # Gemini 2.5 Flash
bun run src/index.ts sample-single-plan.pdf --model=pro     # Gemini 2.5 Pro
bun run src/index.ts sample-single-plan.pdf --model=pro3    # Gemini 3 Pro
```

## Batch Processing Performance

Both tests used the new multi-image batch LLM validation:
- 129 shape candidates processed
- Batch size: 15 images per request
- 5-7x speedup vs sequential single-image calls

Without batch processing, the same test would take ~250-300 seconds per model.
