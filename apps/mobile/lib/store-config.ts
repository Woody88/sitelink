// apps/mobile/lib/store-config.ts
import { makePersistedAdapter } from "@livestore/adapter-expo";
import { StoreRegistry, storeOptions } from "@livestore/livestore";
import { makeWsSync } from "@livestore/sync-cf/client";
import { schema } from "@sitelink/domain";
import { unstable_batchedUpdates as batchUpdates } from "react-native";
import { isDemoMode } from "./demo-mode";

const storeId = process.env.EXPO_PUBLIC_LIVESTORE_STORE_ID;
const syncUrl = process.env.EXPO_PUBLIC_LIVESTORE_SYNC_URL;

let _storeRegistry: StoreRegistry | null = null;

/**
 * Get or create the singleton StoreRegistry instance
 * Manages store lifecycle, caching, and retention
 */
export function getStoreRegistry(): StoreRegistry {
	if (!_storeRegistry) {
		_storeRegistry = new StoreRegistry({
			defaultOptions: {
				batchUpdates, // React Native's batching for optimal re-renders
				unusedCacheTime: 60_000, // Keep stores for 60s after last use
			},
		});
	}
	return _storeRegistry;
}

/**
 * Create store options for the main app store
 *
 * Works in two modes:
 * - With sessionToken: Syncs with backend using authentication
 * - Without sessionToken: Works in local-only mode (no sync)
 *
 * When user authenticates, pass the new token and sync starts automatically
 */
export function createAppStoreOptions(sessionToken?: string | null) {
	const isDemo = isDemoMode();
	const effectiveStoreId = isDemo ? "demo-store" : storeId;

	if (!effectiveStoreId) {
		throw new Error("EXPO_PUBLIC_LIVESTORE_STORE_ID is not configured");
	}

	return storeOptions({
		schema,
		storeId: effectiveStoreId,
		adapter: makePersistedAdapter({
			sync: {
				backend:
					!isDemo && syncUrl && sessionToken
						? makeWsSync({ url: syncUrl })
						: undefined,
			},
		}),
		// Pass session token as sync payload for backend authentication
		// If no token or demo mode, works in local-only mode
		syncPayload:
			!isDemo && sessionToken ? { authToken: sessionToken } : undefined,
	});
}

/**
 * Log helpful error messages for common LiveStore errors
 */
export function logLiveStoreError(error: any) {
	console.error("[LiveStore] Error:", error);

	// Check for MaterializerHashMismatchError
	if (
		error?._tag === "MaterializerHashMismatchError" ||
		error?.message?.includes("MaterializerHashMismatchError") ||
		error?.toString?.().includes("MaterializerHashMismatchError")
	) {
		console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
		console.error("❌ MATERIALIZER HASH MISMATCH ERROR");
		console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
		console.error("The local database schema does not match the code.");
		console.error("");
		console.error("This happens when:");
		console.error("1. Schema/events/materializers changed during development");
		console.error("2. Metro bundler served stale cached code");
		console.error("3. Database has events with old materializer hash");
		console.error("");
		console.error("TO FIX:");
		console.error("1. Go to Profile/Settings screen");
		console.error('2. Scroll to "Developer Tools" section');
		console.error('3. Tap "Clear Database & Restart"');
		console.error("4. Or manually clear with: clearLiveStoreDatabase()");
		console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
	}

	// Check for MaterializeError (event processing errors)
	if (
		error?._tag === "MaterializeError" ||
		error?.message?.includes("MaterializeError")
	) {
		console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
		console.error("❌ MATERIALIZE ERROR");
		console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
		console.error("Failed to process/materialize an event.");
		console.error("This could be:");
		console.error("- Event schema mismatch");
		console.error("- Missing required fields");
		console.error("- Invalid data types");
		console.error("");
		console.error("Event details:", error);
		console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
	}
}
