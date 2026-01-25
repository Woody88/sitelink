#!/bin/bash
# Example: Complete augmentation workflow for iteration 1
#
# This script demonstrates the full human-in-the-loop workflow:
# 1. Extract hard examples from error analysis
# 2. Print Roboflow instructions
# 3. Wait for manual annotation
# 4. Merge datasets
# 5. Prepare for retraining

set -e

ITERATION=1
BASE_DIR="error_analysis/iteration_$ITERATION"
ERROR_REPORT="$BASE_DIR/error_report.json"
IMAGE_PATH="$BASE_DIR/validation_image.png"
ORIGINAL_DATASET="dataset_v6"

echo "============================================"
echo "DATASET AUGMENTATION - ITERATION $ITERATION"
echo "============================================"
echo ""

# Check prerequisites
if [ ! -f "$ERROR_REPORT" ]; then
    echo "Error: error_report.json not found at $ERROR_REPORT"
    echo "Run error_analysis.py first:"
    echo "  python error_analysis.py validation.json image.png --output-dir $BASE_DIR"
    exit 1
fi

if [ ! -f "$IMAGE_PATH" ]; then
    echo "Error: Validation image not found at $IMAGE_PATH"
    exit 1
fi

# Step 1: Extract hard examples
echo "Step 1: Extracting hard examples for manual annotation..."
echo ""

python augment_dataset.py \
  "$ERROR_REPORT" \
  "$IMAGE_PATH" \
  --iteration $ITERATION \
  --output-dir "$BASE_DIR" \
  --min-severity tiny

ANNOTATION_DIR="$BASE_DIR/for_annotation"

if [ ! -d "$ANNOTATION_DIR" ]; then
    echo "Error: Annotation directory not created"
    exit 1
fi

CROP_COUNT=$(ls -1 "$ANNOTATION_DIR"/*.jpg 2>/dev/null | wc -l)

if [ "$CROP_COUNT" -eq 0 ]; then
    echo ""
    echo "No hard examples extracted. Model may have converged."
    exit 0
fi

echo ""
echo "============================================"
echo "MANUAL ANNOTATION REQUIRED"
echo "============================================"
echo ""
echo "Extracted $CROP_COUNT crops to: $ANNOTATION_DIR"
echo ""
echo "NEXT STEPS (MANUAL):"
echo ""
echo "1. Upload crops to Roboflow:"
echo "   - Open your Roboflow workspace"
echo "   - Upload all images from: $ANNOTATION_DIR"
echo "   - Add tag: iteration_$(printf '%02d' $ITERATION)_fn"
echo ""
echo "2. Review and annotate:"
echo "   - Verify ground truth labels (check metadata.csv)"
echo "   - Adjust bounding boxes if needed"
echo "   - Add missing annotations in crops"
echo "   - Fix any labeling errors"
echo ""
echo "3. Export dataset:"
echo "   - Generate new dataset version in Roboflow"
echo "   - Export as YOLOv11 format"
echo "   - Download to: roboflow_export/iteration_$ITERATION/"
echo ""
echo "4. After export completes, run merge step:"
echo ""
echo "   bash $0 --merge"
echo ""
echo "============================================"
echo ""

# If --merge flag provided, proceed with merge
if [ "$1" = "--merge" ]; then
    echo ""
    echo "Step 2: Merging datasets..."
    echo ""

    ROBOFLOW_EXPORT="roboflow_export/iteration_$ITERATION"
    MERGED_OUTPUT="dataset_v$((ITERATION+1))"

    if [ ! -d "$ROBOFLOW_EXPORT" ]; then
        echo "Error: Roboflow export not found at $ROBOFLOW_EXPORT"
        echo ""
        echo "Please complete the manual annotation steps:"
        echo "1. Upload crops to Roboflow"
        echo "2. Review and correct annotations"
        echo "3. Export as YOLOv11 format"
        echo "4. Download to: $ROBOFLOW_EXPORT"
        exit 1
    fi

    python augment_dataset.py \
      "$ERROR_REPORT" \
      "$IMAGE_PATH" \
      --iteration $ITERATION \
      --output-dir output \
      --merge \
      --original-dataset "$ORIGINAL_DATASET" \
      --new-annotations "$ROBOFLOW_EXPORT" \
      --merged-output "$MERGED_OUTPUT"

    echo ""
    echo "============================================"
    echo "READY FOR RETRAINING"
    echo "============================================"
    echo ""
    echo "Merged dataset: $MERGED_OUTPUT"
    echo ""
    echo "Next: Retrain model with augmented dataset"
    echo ""
    echo "  python train_active_learning.py \\"
    echo "    --iteration $((ITERATION+1)) \\"
    echo "    --data $MERGED_OUTPUT/data.yaml \\"
    echo "    --continue-from iterations/iteration_$ITERATION/weights/best.pt"
    echo ""
    echo "Expected improvements:"
    echo "  - Better recall on tiny objects"
    echo "  - Improved low-contrast detection"
    echo "  - Better edge/corner case handling"
    echo ""
fi
