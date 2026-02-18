#!/bin/bash
APP_ID="com.nessei.sitelink"

# Find LiveStore databases using run-as (works on physical devices without root)
adb shell "run-as $APP_ID find files/SQLite/ -name '*.db' 2>/dev/null"
