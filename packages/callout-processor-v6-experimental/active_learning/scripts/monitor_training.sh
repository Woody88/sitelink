#!/bin/bash
# Monitor training progress and send Discord updates every 10 minutes

LOG_FILE="/tmp/train_iter0.log"
DISCORD_URL="http://localhost:3000/api/send-message"
INTERVAL=600  # 10 minutes in seconds

send_update() {
    local message="$1"
    curl -X POST "$DISCORD_URL" \
         -H "Content-Type: application/json" \
         -d "{\"message\":\"$message\"}" \
         -s > /dev/null 2>&1
}

get_latest_epoch() {
    tail -50 "$LOG_FILE" 2>/dev/null | grep -oP 'Epoch\s+\K\d+(?=/\d+)' | tail -1
}

get_latest_metrics() {
    tail -20 "$LOG_FILE" 2>/dev/null | grep -E '^\s+\d+/\d+' | tail -1
}

get_gpu_usage() {
    tail -20 "$LOG_FILE" 2>/dev/null | grep -oP 'GPU_mem\s+\K[0-9.]+G' | tail -1
}

check_if_running() {
    pgrep -f "train_active_learning.py --iteration 0" > /dev/null
    return $?
}

# Initial message
send_update "📊 **Training Monitor Started**\n\nSending updates every 10 minutes..."

last_epoch=0
while true; do
    sleep $INTERVAL

    if ! check_if_running; then
        send_update "⚠️ **Training Process Stopped**\n\nChecking if completed or errored..."

        # Check if training completed successfully
        if grep -q "Training complete" "$LOG_FILE" 2>/dev/null; then
            send_update "✅ **Training Complete!**\n\nIteration 0 finished. Checking final metrics..."
        else
            send_update "❌ **Training Error**\n\nProcess stopped unexpectedly. Check logs."
        fi
        break
    fi

    current_epoch=$(get_latest_epoch)
    metrics=$(get_latest_metrics)
    gpu=$(get_gpu_usage)

    if [ -n "$current_epoch" ] && [ "$current_epoch" != "$last_epoch" ]; then
        # Extract loss values
        box_loss=$(echo "$metrics" | awk '{print $3}')
        cls_loss=$(echo "$metrics" | awk '{print $4}')

        elapsed_mins=$(( ($(date +%s) - $(stat -c %Y "$LOG_FILE" 2>/dev/null || echo 0)) / 60 ))

        send_update "📈 **Training Update**\n\n**Epoch:** ${current_epoch}/150\n**GPU:** ${gpu}\n**Box Loss:** ${box_loss}\n**Cls Loss:** ${cls_loss}\n**Runtime:** ${elapsed_mins} mins"

        last_epoch=$current_epoch
    else
        send_update "⏳ **Training In Progress**\n\nEpoch: ${current_epoch:-?}/150\nStill training..."
    fi
done
