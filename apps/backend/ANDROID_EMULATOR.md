# Android Emulator Networking Setup

When running the backend in WSL2 and testing with an Android emulator on Windows, you need to configure networking so the emulator can reach the backend server.

## The Problem

WSL2 runs in a virtualized network environment. When your backend runs on `localhost:8787` in WSL2, it's only accessible from within WSL2, not from:
- The Windows host
- The Android emulator (which runs on Windows)

The Android emulator's `10.0.2.2` points to the **Windows host's** localhost, not WSL2's localhost.

## Solution: Windows Port Proxy (Recommended for WSL2)

This forwards traffic from Windows host to WSL2, allowing the emulator to reach WSL2 services via `10.0.2.2`.

### Step 1: Find WSL2 IP Address

From WSL2 terminal:
```bash
hostname -I
# Example output: 10.5.0.2
```

### Step 2: Set Up Port Forwarding on Windows

**From Windows PowerShell (Run as Administrator):**

```powershell
# Forward port 8787 from Windows host to WSL2
netsh interface portproxy add v4tov4 listenaddress=0.0.0.0 listenport=8787 connectaddress=10.5.0.2 connectport=8787
```

Replace `10.5.0.2` with your WSL2 IP from Step 1.

### Step 3: Configure Mobile App

In your mobile app's `.env` file:
```
EXPO_PUBLIC_LIVESTORE_SYNC_URL=ws://10.0.2.2:8787
```

Now the flow works:
- Android Emulator → `10.0.2.2:8787` → Windows Host → WSL2 (10.5.0.2:8787)

### Step 4: Allow Windows Firewall (if needed)

If Windows Firewall blocks the connection:
```powershell
# Allow inbound connections on port 8787
New-NetFirewallRule -DisplayName "WSL2 Backend" -Direction Inbound -LocalPort 8787 -Protocol TCP -Action Allow
```

### Removing Port Forwarding

To remove the port proxy later:
```powershell
netsh interface portproxy delete v4tov4 listenaddress=0.0.0.0 listenport=8787
```

## Alternative: ADB Reverse Port Forwarding

If you prefer ADB, you need **two** port forwards:

1. **From Windows (PowerShell/CMD):**
   ```bash
   # Forward from emulator to Windows host
   adb reverse tcp:8787 tcp:8787
   ```

2. **Then set up Windows → WSL2 forwarding** (same as above with netsh)

This is more complex, so the netsh method above is recommended.

## Why This Is Needed

- **WSL2 Network Isolation**: WSL2 has its own virtual network (IP like `10.5.0.2`)
- **Android Emulator Network**: Runs on Windows, `10.0.2.2` maps to Windows host's localhost
- **The Gap**: No direct connection between WSL2 and Windows host for external access
- **The Bridge**: `netsh portproxy` creates the bridge: Windows host → WSL2

