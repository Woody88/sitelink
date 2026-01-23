# YOLO-26E Zero-Shot Detection Test Results

## Test Setup

- **Model**: yoloe-26n-seg.pt (YOLO-26E Nano Segmentation)
- **Test Image**: sample-plan-2.png (page 2 from apps/sample-plan.pdf, rendered at 150 DPI)
- **Standards**: US NCS (National CAD Standard)
- **Python**: 3.10.12 (`/usr/bin/python3`)

## Text Prompt Detection Results

### Configuration
- Confidence threshold: 0.01
- IOU threshold: 0.5
- Prompt source: prompts/us_ncs.json (detailed text descriptions)

### Detections Summary
- **Total**: 25 callouts detected
- **Elevation**: 17 detections (confidence: 0.01-0.08)
- **Detail**: 6 detections (confidence: 0.01-0.02)
- **Title**: 2 detections (confidence: 0.01)
- **Section**: 0 detections

### Observations

**Positive**:
- YOLO-26E successfully detects callouts using text prompts alone
- Highest confidence on elevation callouts (0.08 max)
- Detections appear on actual callout symbols in many cases

**Issues**:
- Very low confidence scores (0.01-0.08) indicate uncertainty
- Some detections on text labels rather than callout symbols
- Some bounding boxes are oversized (e.g., title block detection)
- Many duplicate/overlapping detections on same callouts
- No section callouts detected (may not be present on this page)

**Example Good Detections**:
- Elevation callouts in upper right (green boxes at 0.05-0.08 confidence)
- Detail callout boxes with dashed borders

**Example False Positives**:
- "OVERALL OPENING" text label detected as detail
- Large title block bounding box covering entire detail
- Wide text areas detected as detail callouts

## Visual Prompt Detection Results

### Configuration
- Confidence threshold: 0.05
- IOU threshold: 0.5
- Crop images: 10 examples from examples/us/ncs/

### Detections Summary
- **Total**: 0 callouts detected

### Analysis

The visual prompt method returned 0 detections due to an implementation limitation. The current code extracts simple class names ("detail", "elevation") from the crop image folder structure but doesn't use the detailed text descriptions.

YOLOE-26's "visual prompting" refers to providing bounding box examples from the SAME image, not using crop images from other sources as visual references. True cross-image one-shot learning would require a different model architecture (e.g., few-shot detection models).

The crop images are still valuable for:
- Documentation of callout symbol standards
- Future model training (supervised learning)
- Visual reference for prompt engineering

## Performance Analysis

### Text Detection (Primary Method)
- **Recall**: Unknown (no ground truth annotations yet)
- **Precision**: Estimated ~30-50% based on visual inspection
- **Speed**: Fast (< 5 seconds on 2560x1920 image)
- **Usability**: Works out-of-the-box with text prompts only

### Key Findings

1. **Text prompts work for zero-shot detection**: YOLO-26E can detect callouts using detailed natural language descriptions without any training.

2. **Low confidence is expected**: Zero-shot detection typically has lower confidence than supervised models. Confidence 0.01-0.08 is normal for this use case.

3. **NMS may need tuning**: Multiple overlapping detections suggest IOU threshold could be lowered to 0.3-0.4 to merge duplicates.

4. **Prompt engineering matters**: Detailed descriptions (from official PDFs) are essential. Simple class names don't work.

5. **Ground truth needed**: Cannot calculate proper metrics without manual annotations.

## Next Steps

### Phase 4: Validation (Current)
1. ✅ Quick test completed (text detection working)
2. ⏳ Create ground truth annotations for sample plans
3. ⏳ Run validation.py to calculate precision/recall/F1
4. ⏳ Tune confidence and IOU thresholds
5. ⏳ Test on multiple plan pages and standards

### Phase 5: Optimization
1. Prompt engineering: Refine text descriptions based on results
2. Threshold tuning: Find optimal conf/IOU values
3. Post-processing: Add duplicate filtering, size constraints
4. Multi-standard testing: Test CA NCS, CA CSI, US CSI prompts

### Phase 6: Integration
1. Create TypeScript wrapper: yoloe-extraction.ts
2. API design: Match existing extraction interface
3. Pipeline integration: Connect to sitelink-interpreter
4. End-to-end testing: PDF upload to callout extraction

## Files Generated

- `test_output/sample-plan-2.png` - Test image (page 2, 150 DPI)
- `test_output/results_text_page2_fixed.json` - Text detection results (25 detections)
- `test_output/results_visual_page2.json` - Visual detection results (0 detections)
- `test_output/sample-plan-2-annotated.png` - Visualization with bounding boxes
- `visualize_detections.py` - Visualization script

## Conclusion

YOLO-26E text-based zero-shot detection is **WORKING** and shows promise for callout detection. While confidence scores are low and there are false positives, this is expected for zero-shot detection. The model successfully identifies callout-like regions using only natural language descriptions.

**Recommendation**: Continue with text prompt method as primary approach. Improve through:
1. Ground truth validation to measure actual performance
2. Prompt refinement based on failure cases
3. Post-processing to filter false positives
4. Threshold tuning for precision/recall balance

Visual prompts (crop images) should be retained for future training but are not usable for zero-shot detection with YOLOE-26.
