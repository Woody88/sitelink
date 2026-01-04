// apps/backend/src/sync/worker.ts
import { makeWorker, handleWebSocket } from '@livestore/sync-cf/cf-worker';
import type { Auth } from '../auth/auth';
import type { Env, SyncContext } from '../types/env';

/**
 * Validates the auth token from the LiveStore sync payload
 * This ensures only authenticated users can sync data
 */
export async function validateSyncPayload(
  payload: any,
  auth: Auth,
  request: Request
): Promise<any> {
  // Extract auth token from payload
  const authToken = payload?.authToken;
  
  if (!authToken) {
    throw new Error('Missing auth token');
  }
  
  // Validate the token using Better Auth
  try {
    const session = await auth.api.getSession({
      headers: {
        cookie: `better-auth.session_token=${authToken}`,
      },
    });
    
    if (!session) {
      throw new Error('Invalid or expired session');
    }
    
    // Verify session hasn't expired
    if (session.expiresAt && session.expiresAt < Date.now()) {
      throw new Error('Session expired');
    }
    
    // Return validated payload with user context
    // The sync library will pass this as the context to onPush/onPull
    return {
      ...payload,
      userId: session.user.id,
      userEmail: session.user.email,
    };
  } catch (error) {
    console.error('Auth validation failed:', error);
    throw new Error('Authentication failed');
  }
}

/**
 * Create the default Cloudflare Worker for sync
 * This can be used directly or embedded in a custom worker
 */
export function createSyncWorker(auth: Auth) {
  return makeWorker({
    validatePayload: (payload: any, request: Request) =>
      validateSyncPayload(payload, auth, request),
  });
}

/**
 * Custom request handler for embedding sync in an existing worker
 * Use this if you want to handle other routes in the same worker
 */
export function handleSyncRequest(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  auth: Auth
) {
  const url = new URL(request.url);
  
  if (url.pathname.endsWith('/websocket') || url.pathname.endsWith('/sync')) {
    return handleWebSocket(request, env, ctx, {
      validatePayload: async (payload: any) => {
        const validated = await validateSyncPayload(payload, auth, request);
        // Include env in the validated payload so it's available in handlers
        return {
          ...validated,
          env,
          request,
        };
      },
    });
  }
  
  return null; // Not a sync request
}

