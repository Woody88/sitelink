#!/bin/bash
# Active Learning Iteration Runner
#
# Usage: ./run_iteration.sh <iteration_number>

set -e

if [ $# -ne 1 ]; then
    echo "Usage: $0 <iteration_number>"
    exit 1
fi

ITERATION=$1
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT_BASE="$SCRIPT_DIR/../output"
ITERATION_DIR="$OUTPUT_BASE/iteration_$ITERATION"

echo "========================================="
echo "Active Learning - Iteration $ITERATION"
echo "========================================="

# Create iteration directory
mkdir -p "$ITERATION_DIR"

# 1. Run validation (assumes batch_validate.py is available)
echo ""
echo "Step 1: Running validation..."
if [ ! -f "$SCRIPT_DIR/batch_validate.py" ]; then
    echo "Warning: batch_validate.py not found - skipping validation"
    echo "You'll need to run validation manually and save results to:"
    echo "  $ITERATION_DIR/validation.json"
else
    python3 "$SCRIPT_DIR/batch_validate.py" \
        --model "$SCRIPT_DIR/../../weights/yoloe-26n.pt" \
        --dataset "$SCRIPT_DIR/../../dataset_v6" \
        --output "$ITERATION_DIR/validation.json"
fi

# Check if validation results exist
if [ ! -f "$ITERATION_DIR/validation.json" ]; then
    echo "Error: Validation results not found at $ITERATION_DIR/validation.json"
    exit 1
fi

# 2. Analyze errors
echo ""
echo "Step 2: Analyzing errors..."
python3 "$SCRIPT_DIR/error_analysis.py" \
    "$ITERATION_DIR/validation.json" \
    "$ITERATION_DIR/validation_image.png" \
    --output-dir "$ITERATION_DIR/error_analysis" \
    --extract-crops

# 3. Update convergence tracking
echo ""
echo "Step 3: Updating convergence tracking..."
python3 "$SCRIPT_DIR/convergence_tracker.py" \
    --csv "$OUTPUT_BASE/convergence_tracking.csv" \
    --output-dir "$OUTPUT_BASE/convergence_plots" \
    --update "$ITERATION_DIR/validation.json" \
    --iteration "$ITERATION"

# 4. Check convergence
echo ""
echo "Step 4: Checking convergence..."
if [ -f "$OUTPUT_BASE/convergence_config.json" ]; then
    CONFIG_ARG="--config $OUTPUT_BASE/convergence_config.json"
else
    CONFIG_ARG=""
fi

python3 "$SCRIPT_DIR/convergence_tracker.py" \
    --csv "$OUTPUT_BASE/convergence_tracking.csv" \
    --output-dir "$OUTPUT_BASE/convergence_plots" \
    --update "$ITERATION_DIR/validation.json" \
    --iteration "$ITERATION" \
    --check-convergence \
    $CONFIG_ARG

# 5. Check if we should continue
CONVERGENCE_FILE="$OUTPUT_BASE/convergence_plots/convergence_check_iter_$ITERATION.json"
if [ -f "$CONVERGENCE_FILE" ]; then
    SHOULD_STOP=$(python3 -c "import json; print(json.load(open('$CONVERGENCE_FILE'))['should_stop'])")
    REASON=$(python3 -c "import json; print(json.load(open('$CONVERGENCE_FILE'))['reason'])")

    echo ""
    echo "========================================="
    echo "Convergence Check Result"
    echo "========================================="
    echo "Should Stop: $SHOULD_STOP"
    echo "Reason: $REASON"
    echo ""

    if [ "$SHOULD_STOP" = "True" ]; then
        echo "Convergence achieved - stopping active learning"
        exit 0
    else
        echo "Continuing to next iteration..."
        echo ""
        echo "Next steps:"
        echo "1. Review error analysis in: $ITERATION_DIR/error_analysis/"
        echo "2. Use FN crops to augment dataset"
        echo "3. Refine prompts based on suggestions"
        echo "4. Retrain model"
        echo "5. Run next iteration: ./run_iteration.sh $((ITERATION + 1))"
    fi
else
    echo "Warning: Convergence check file not found"
fi

echo ""
echo "Iteration $ITERATION complete!"
echo "Output saved to: $ITERATION_DIR"
