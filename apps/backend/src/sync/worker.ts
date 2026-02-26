// apps/backend/src/sync/worker.ts
import { makeDurableObject, makeWorker } from "@livestore/sync-cf/cf-worker";
import type { Env } from "../types/env";

/**
 * WebSocketServer Durable Object for handling LiveStore sync connections
 *
 * This DO handles:
 * - WebSocket connections from clients
 * - Push/pull sync operations
 * - Event storage and retrieval
 *
 * The validation (auth) happens in the worker's validatePayload,
 * so by the time events reach onPush, they're already authenticated.
 */
export class SyncBackendDO extends makeDurableObject({
	onPush: async (message, context) => {
		// Handle incoming events from clients
		console.log(
			"[Sync] onPush: Received batch with",
			message.batch.length,
			"events",
		);
		console.log("[Sync] onPush: Context:", {
			storeId: context.storeId,
			payload: context.payload,
		});

		// Events are already validated by validatePayload in the worker
		// Just log for debugging
		console.log("[Sync] onPush: All events authorized, storing...");
	},

	onPull: async (message, context) => {
		// Handle pull requests from clients
		console.log(
			"[Sync] onPull: Client requesting events since",
			message.cursor,
		);
		console.log("[Sync] onPull: Context:", {
			storeId: context.storeId,
			payload: context.payload,
		});

		// No filtering needed - the sync library handles event retrieval
	},
}) {}

/**
 * Validates the auth token from the LiveStore sync payload
 * This ensures only authenticated users can sync data
 *
 * Note: We keep the existing direct DB query validation as it's working correctly.
 * We don't use auth.api.getSession() due to known issues (GitHub issue #3892).
 */
async function validatePayload(
	payload: any,
	context: { storeId: string },
	env: Env,
): Promise<void> {
	// Extract auth token from payload
	const authToken = (payload as any)?.authToken;

	// Require auth token
	if (!authToken) {
		console.log("[Sync] No auth token provided - rejecting connection");
		throw new Error("Missing auth token");
	}

	// Validate the session token by querying the database directly
	//
	// Why not use auth.api.getSession()?
	// - WebSocket connections don't carry cookies in headers reliably
	// - better-auth's getSession() has known issues parsing cookies from custom headers
	// - Even with disableCookieCache and proper cookie formatting, getSession() returns null
	// - Direct DB validation is more reliable and doesn't depend on better-auth's internal cookie parsing
	//
	// Related issue: https://github.com/better-auth/better-auth/issues/3892
	// Multiple users report getSession() returning null despite valid sessions in database
	//
	if (!env.DB) {
		throw new Error("Database not available for session validation");
	}

	// Query session by token and validate it hasn't expired
	const sessionResult = await env.DB.prepare(
		"SELECT s.*, u.id as user_id, u.email, u.name FROM session s JOIN user u ON s.user_id = u.id WHERE s.token = ? AND s.expires_at > ?",
	)
		.bind(authToken, Date.now())
		.first();

	if (!sessionResult) {
		console.error(
			"[Sync] Invalid or expired session for token:",
			authToken.substring(0, 10) + "...",
		);
		throw new Error("Invalid or expired session");
	}

	console.log("[Sync] Session validated for user:", sessionResult.email);
}

/**
 * Create the LiveStore sync worker using the new makeWorker pattern
 *
 * This worker:
 * - Handles sync requests at any endpoint (detected by query params)
 * - Validates auth tokens via direct DB queries
 * - Delegates to SYNC_BACKEND_DO (WebSocketServer) for sync operations
 * - Enables CORS for cross-origin requests
 */
export function createSyncWorker(env: Env) {
	return makeWorker({
		syncBackendBinding: "SYNC_BACKEND_DO",
		validatePayload: (payload, context) =>
			validatePayload(payload, context, env),
		enableCORS: true,
	});
}
