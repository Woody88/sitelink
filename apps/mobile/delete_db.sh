#!/bin/bash
APP_ID="com.nessei.sitelink"

# Delete LiveStore databases from device using run-as (works on physical devices)
adb shell "run-as $APP_ID find files/SQLite -name 'livestore-*.db' 2>/dev/null" | \
    tr -d '\r' | \
    xargs -I {} adb shell "run-as $APP_ID rm {}"

# Delete local copies
rm -f ./databases/livestore-*.db

# Clear app data
adb shell pm clear $APP_ID
echo "Deleted database files from device and local ./databases/ directory. Also cleared device cache."
