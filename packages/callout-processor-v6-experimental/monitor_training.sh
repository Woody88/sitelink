#!/bin/bash
# Training Monitor for Iteration 0

RESULTS_FILE="/home/woodson/Code/projects/sitelink/packages/callout-processor-v6-experimental/active_learning/iterations3/results.csv"
LOG_FILE="/tmp/claude/-home-woodson-Code-projects-sitelink/tasks/be0000d.output"

echo "============================================"
echo "Training Progress Monitor - Iteration 0"
echo "============================================"
echo ""

if [ -f "$RESULTS_FILE" ]; then
    echo "Latest Metrics:"
    echo "---------------"
    tail -1 "$RESULTS_FILE" | awk -F',' '{
        printf "Epoch: %d\n", $1
        printf "Time: %.1f seconds\n", $2
        printf "Box Loss: %.4f\n", $3
        printf "Cls Loss: %.4f\n", $4
        printf "DFL Loss: %.5f\n", $5
        printf "Precision: %.5f\n", $6
        printf "Recall: %.5f\n", $7
        printf "mAP50: %.5f\n", $8
        printf "mAP50-95: %.5f\n", $9
    }'
    echo ""

    # Calculate progress
    current_epoch=$(tail -1 "$RESULTS_FILE" | awk -F',' '{print $1}')
    total_epochs=150
    progress=$((current_epoch * 100 / total_epochs))
    echo "Progress: $current_epoch/$total_epochs epochs ($progress%)"

    # Estimate time remaining
    avg_time_per_epoch=$(tail -5 "$RESULTS_FILE" | awk -F',' 'NR>1 {sum+=$2; count++} END {if(count>0) print sum/count; else print 0}')
    remaining_epochs=$((total_epochs - current_epoch))
    remaining_seconds=$(echo "$avg_time_per_epoch * $remaining_epochs" | bc)
    remaining_hours=$(echo "scale=1; $remaining_seconds / 3600" | bc)
    echo "Estimated time remaining: ${remaining_hours} hours"
else
    echo "Results file not found. Training may not have started yet."
fi

echo ""
echo "============================================"
echo "To view live progress:"
echo "  tail -f $LOG_FILE"
echo "============================================"
