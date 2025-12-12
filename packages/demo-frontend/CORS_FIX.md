# CORS Fix for Sign-Up Network Error

## Problem Summary

When attempting to sign up via the frontend, users were seeing a "network error" even though the backend was receiving the request and responding with a 422 status code.

### Symptoms
- Frontend: "Network error" displayed to user
- Backend logs: `POST /api/auth/sign-up/email 422 UNPROCESSABLE_ENTITY (35ms)`
- Browser console: CORS-related error (blocked by CORS policy)

## Root Cause

The issue was a **missing CORS headers** problem with two components:

1. **Backend (Cloudflare Worker)**: Better Auth's handler responses were missing CORS headers
2. **Proxy (Bun server)**: The proxy was forwarding responses without adding CORS headers

When a browser makes a cross-origin request (frontend on `localhost:3000` to backend on `localhost:8787`), it requires:
- **Preflight requests** (OPTIONS) to be handled
- **CORS headers** on all responses (including error responses)

Without these headers, the browser blocks the response and treats it as a network error, even though the backend successfully processed the request.

## Solution

### Option 1: Direct Backend Connection (Recommended for Development)

**File**: `/home/woodson/Code/projects/sitelink/packages/demo-frontend/auth-client.js`

```javascript
export const authClient = createAuthClient({
  baseURL: "http://localhost:8787",  // Direct to backend
});
```

**Backend Changes**: Added CORS headers to auth responses in `/home/woodson/Code/projects/sitelink/packages/backend/src/features/auth/http.ts`

1. Added OPTIONS endpoint handler for preflight requests
2. Added CORS headers to all GET/POST responses:
   - `Access-Control-Allow-Origin: http://localhost:3000`
   - `Access-Control-Allow-Credentials: true`
   - `Access-Control-Allow-Methods: GET, POST, OPTIONS`
   - `Access-Control-Allow-Headers: Content-Type, Authorization`

### Option 2: Via Proxy (Also Fixed)

**File**: `/home/woodson/Code/projects/sitelink/packages/demo-frontend/auth-client.js`

```javascript
export const authClient = createAuthClient({
  baseURL: "http://localhost:3000",  // Via proxy
});
```

**Proxy Changes**: Updated `/home/woodson/Code/projects/sitelink/packages/demo-frontend/server.ts` to add CORS headers to all proxied responses.

## Files Modified

1. **`/home/woodson/Code/projects/sitelink/packages/backend/src/features/auth/http.ts`**
   - Added OPTIONS endpoint for CORS preflight
   - Added CORS headers to GET/POST auth responses

2. **`/home/woodson/Code/projects/sitelink/packages/demo-frontend/server.ts`**
   - Updated proxy to add CORS headers to all responses

3. **`/home/woodson/Code/projects/sitelink/packages/demo-frontend/auth-client.js`**
   - Updated baseURL to use direct backend connection (can be switched back to proxy)

## Testing

To test the fix:

1. Start the backend:
   ```bash
   cd /home/woodson/Code/projects/sitelink/packages/backend
   bun run dev
   ```

2. Start the frontend:
   ```bash
   cd /home/woodson/Code/projects/sitelink/packages/demo-frontend
   bun run server.ts
   ```

3. Navigate to `http://localhost:3000/auth.html`
4. Try signing up with a new email
5. Should now see proper error messages (e.g., "email already exists") instead of "network error"

## Why This Happened

1. **Better Auth** is designed to run on the same domain as the frontend (no CORS issues)
2. **Our architecture** has frontend and backend on different ports during development
3. **Effect-TS HTTP** passes through Better Auth responses without modifying headers
4. **Missing CORS headers** on error responses caused browser to block them

## Production Considerations

In production:
- If frontend and backend are on the same domain: No CORS needed
- If on different domains: Keep the CORS headers but update allowed origins
- Consider using environment variables for allowed origins:
  ```typescript
  headers.set("Access-Control-Allow-Origin", process.env.FRONTEND_URL || "http://localhost:3000")
  ```

## Related Configuration

**Backend Auth Config**: `/home/woodson/Code/projects/sitelink/packages/backend/src/core/auth/config.ts`
```typescript
trustedOrigins: ["http://localhost:8787", "http://localhost:3000"],
```

Note: `trustedOrigins` is for CSRF protection, NOT for CORS. CORS headers must be set separately.
