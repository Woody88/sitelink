#!/bin/bash
# Delete from device
adb shell "find /data/data/host.exp.exponent/files/SQLite/nessei-sitelink-dev -name 'livestore-*.db' 2>&1" | \
    tr -d '\r' | \
    xargs -I {} adb shell rm {}

# Delete local copies
rm -f ./databases/livestore-*.db

adb shell pm clear host.exp.exponent
echo "Deleted database files from device and local ./databases/ directory. Also cleared device cache."