#!/bin/bash
mkdir -p ./databases/
adb shell "find /data/data/host.exp.exponent/files/SQLite/$1 -name 'livestore-*.db' 2>&1" | \
    tr -d '\r' | \
    xargs -I {} adb pull {} ./databases/