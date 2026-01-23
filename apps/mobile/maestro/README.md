# Maestro Test Flows

Automated UI test flows for the Sitelink mobile app.

## Prerequisites

Before running any flows, ensure:

1. **Backend is running**: `bun dev:network` (from `apps/backend`)
2. **Emulator is running**: `bun run android` (from `apps/mobile`)
3. **Test PDF is on device**: `bash push_plan.sh` (from `apps/mobile`)

## Reset Commands

For a fresh test environment:

```bash
# Reset backend database
cd apps/backend && bun wrangler:state:reset

# Reset emulator database
cd apps/mobile && bash delete_db.sh

# Push test files to emulator
cd apps/mobile && bash push_plan.sh
```

## Available Flows

### Individual Flows

| Flow | Description | Prerequisites |
|------|-------------|---------------|
| `auth-signup.yaml` | Sign up new user, skip biometrics | Fresh DB |
| `auth-login.yaml` | Log in existing user | User must exist |
| `project-create.yaml` | Create a new project | Must be logged in |
| `plan-upload.yaml` | Upload PDF from device | Must be in a project |

### End-to-End Flows

| Flow | Description |
|------|-------------|
| `e2e-signup-to-upload.yaml` | Full flow: signup → create project → upload plan |

## Running Flows

### Single Flow

```bash
maestro test apps/mobile/maestro/auth-signup.yaml
```

### With Environment Variables

```bash
maestro test apps/mobile/maestro/auth-signup.yaml \
  -e TEST_EMAIL=mytest@example.com \
  -e TEST_PASSWORD=mypassword123
```

### Full E2E Test (Fresh Start)

```bash
# Reset everything first
cd apps/backend && bun wrangler:state:reset
cd apps/mobile && bash delete_db.sh && bash push_plan.sh

# Run the full flow
maestro test apps/mobile/maestro/e2e-signup-to-upload.yaml
```

## Environment Variables

| Variable | Default | Used In |
|----------|---------|---------|
| `TEST_NAME` | Tester | signup |
| `TEST_EMAIL` | test@example.com | signup, login |
| `TEST_ORGANIZATION` | Test Organization | signup |
| `TEST_PASSWORD` | password123 | signup, login |
| `PROJECT_NAME` | Test Project | project-create |
| `PROJECT_ADDRESS` | 123 Test St | project-create |

## Troubleshooting

### Flow fails at "Enable Fingerprint?"
The biometric prompt may not appear on all emulators. The flow handles this with `optional: true`.

### File picker doesn't show sample-plan.pdf
Run `bash push_plan.sh` to copy the test PDF to the emulator's Downloads folder.

### "No Projects Found" not visible
Backend may not be running or DB wasn't reset. Run `bun wrangler:state:reset`.

### Upload hangs
Check backend logs in `/tmp/backend-output.log` for processing errors.
