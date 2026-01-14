#!/bin/bash
mkdir -p ./databases/
adb shell "find /data/data/host.exp.exponent/files/SQLite/B1yZvED8MgH9dndbE7FT7oo2W1vCDwwL -name 'livestore-*.db' 2>&1" | \
    tr -d '\r' | \
    xargs -I {} adb pull {} ./databases/