---
name: mobile-testing
description: Automated mobile UI testing with Maestro. Use when testing the mobile app, verifying fixes end-to-end, or running common user flows like signup, login, project creation, and plan upload.
---

# Mobile Testing with Maestro

## When to Use This Skill

- Testing fixes end-to-end before claiming something is fixed
- Verifying user flows work correctly
- Automating repetitive testing tasks
- Creating new test flows for new features

## Quick Reference

**Flow location**: `apps/mobile/maestro/`
**Documentation**: `apps/mobile/maestro/README.md`
**App ID**: `com.nessei.sitelink` (dev client build, NOT Expo Go)

### Running Existing Flows

```bash
# Via Maestro MCP (use phone serial or emulator ID)
mcp__maestro__run_flow_files(device_id="RFCX2045G1X", flow_files="apps/mobile/maestro/<flow>.yaml")

# Via CLI
maestro test apps/mobile/maestro/<flow>.yaml
```

### Fresh Test Environment

```bash
cd apps/backend && bun wrangler:state:reset   # Reset backend DB
cd apps/mobile && bash delete_db.sh           # Reset device DB
cd apps/mobile && bash push_plan.sh           # Push test files
# IMPORTANT: Restart backend after reset!

# Ensure port forwarding (physical device via USB)
adb reverse tcp:8081 tcp:8081 && adb reverse tcp:8787 tcp:8787
```

## Creating New Flows

When you need to test something not covered by existing flows, create a new one following these patterns:

### Flow Template

```yaml
# Description of what this flow tests
# Prerequisites: what must be true before running
#
# Run with:
#   maestro test apps/mobile/maestro/<name>.yaml

appId: com.nessei.sitelink
---
# Dev client launches directly - no Expo Go prompts needed
- launchApp:
    clearState: true

# Wait for app to load
- extendedWaitUntil:
    visible: 'Sign In'
    timeout: 30000

# Your test steps here...
```

### Key Patterns for This App

| Pattern | Solution |
|---------|----------|
| Launch app | `launchApp` with `clearState: true` (dev client, NOT Expo Go) |
| App ID | `com.nessei.sitelink` (NOT `host.exp.exponent`) |
| Wait for app load | `extendedWaitUntil` with 30s timeout |
| Tap by testID | `tapOn: id: 'my-test-id'` |
| Tap by text | `tapOn: 'Button Text'` |
| File picker | Use full filename like `sample-plan.pdf` |
| Form with autoFocus | Just `inputText` directly, don't tap first |

### Finding Element Selectors

1. **Take screenshot**: `mcp__maestro__take_screenshot`
2. **Inspect hierarchy**: `mcp__maestro__inspect_view_hierarchy`
3. **Look for**: `text=`, `resource-id=`, `accessibilityText=`

### Adding testIDs to Components

If Maestro can't find an element, add a testID to the React Native component:

```tsx
<Button testID="submit-button" onPress={handleSubmit}>
  Submit
</Button>
```

Then reference it in Maestro:

```yaml
- tapOn:
    id: 'submit-button'
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Element not found | Check exact text with `inspect_view_hierarchy` |
| Sign up failed | Restart backend after DB reset |
| File not in picker | Run `bash push_plan.sh` |
| Network request failed | Check `adb reverse` ports are set up |
| Form text concatenated | Don't tap label, tap input or use autoFocus |
| Phone disconnected | Replug USB, re-run `adb reverse tcp:8081 tcp:8081 && adb reverse tcp:8787 tcp:8787` |

## Verification Workflow

**NEVER claim something is fixed without testing it.**

1. Reset environment if needed
2. Restart backend after resets
3. Ensure `adb reverse` ports are forwarded
4. Run appropriate Maestro flow (or create one)
5. Take screenshots to verify
6. Only then confirm the fix

## Device Database Inspection

Use these scripts to inspect the SQLite database on the device and verify data has been synced correctly.

**IMPORTANT**: The database does NOT auto-sync to the local directory. Always re-pull to see latest changes.

### Workflow

```bash
cd apps/mobile

# 1. Always delete old pulled databases first
rm -rf databases/*

# 2. Find available stores (shows organizationIds)
bash find_db.sh

# 3. Pull the database for a specific organizationId
bash pull_db.sh <organizationId>

# 4. Find the pulled db file and query it
ls databases/
sqlite3 databases/<db-file>.db "<your query>"
```

### Example Session

```bash
cd apps/mobile
rm -rf databases/*
bash find_db.sh
# Output shows stores like: /data/.../SQLite/HLVnqxI4BHok5fvqllItdn8vBOH9c94X/...

bash pull_db.sh HLVnqxI4BHok5fvqllItdn8vBOH9c94X
ls databases/
# Shows: livestore--XXXXXXX@6.db  livestore-eventlog@6.db

# Query the main db (the non-eventlog one)
sqlite3 databases/livestore--*.db ".tables"
sqlite3 databases/livestore--*.db "SELECT COUNT(*) FROM markers;"
```

### Useful Queries

```bash
# List all tables
sqlite3 databases/livestore--*.db ".tables"

# Show table schema
sqlite3 databases/livestore--*.db ".schema <tablename>"

# Count records
sqlite3 databases/livestore--*.db "SELECT COUNT(*) FROM <tablename>;"

# View data
sqlite3 databases/livestore--*.db "SELECT * FROM <tablename> LIMIT 10;"
```

### Multiple Stores

The device may have multiple stores (shown by `find_db.sh`):
- **OrganizationId store** (e.g., `HLVnqxI4BHok5fvqllItdn8vBOH9c94X`) - Where synced data lives
- **Static store** (e.g., `nessei-sitelink-dev`) - May be empty or have different data

Always check the **organizationId store** when verifying backend-synced data.

## Extending the Test Suite

When adding new features:

1. **Check if existing flow covers it** - Look in `apps/mobile/maestro/`
2. **Create new flow if needed** - Use the template above
3. **Update README.md** - Document the new flow
4. **Consider composability** - Can it be used by other flows?
