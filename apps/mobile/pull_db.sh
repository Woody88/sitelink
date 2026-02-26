#!/bin/bash
APP_ID="com.nessei.sitelink"
mkdir -p ./databases/

# List LiveStore DB files, then copy each one out via run-as (works on physical devices)
adb shell "run-as $APP_ID find files/SQLite/${1:-.} -name 'livestore-*.db' 2>/dev/null" | \
    tr -d '\r' | while read -r db_path; do
        filename=$(basename "$db_path")
        adb shell "run-as $APP_ID cat $db_path" > "./databases/$filename"
        echo "Pulled $filename"
    done
