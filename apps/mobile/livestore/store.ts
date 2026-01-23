import { makePersistedAdapter } from "@livestore/adapter-expo";
import { storeOptions, useStore } from "@livestore/react";
import { makeWsSync } from "@livestore/sync-cf/client";
import { schema } from "@sitelink/domain";
import { useMemo } from "react";
import { unstable_batchedUpdates as batchUpdates } from "react-native";

const syncUrl = process.env.EXPO_PUBLIC_LIVESTORE_SYNC_URL || "";

// Global cache to ensure we always return the same options object for a given storeId+sessionId
// This survives React component unmount/remount cycles
const globalOptionsCache = new Map<string, any>();

export const projectStoreOption = (storeId: string, sessionToken?: string) => {
	return storeOptions({
		storeId,
		schema,
		adapter: makePersistedAdapter({
			sync: {
				backend:
					syncUrl && sessionToken ? makeWsSync({ url: syncUrl }) : undefined,
			},
		}),
		syncPayload: sessionToken ? { authToken: sessionToken } : undefined,
		batchUpdates,
	});
};

export const useAppStore = (
	storeId: string,
	sessionToken?: string,
	sessionId?: string,
) => {
	const cacheKey = `${storeId}-${sessionId || "no-session"}`;

	console.log(`[useAppStore] Called for storeId: ${storeId}`, {
		hasToken: !!sessionToken,
		sessionId,
		cacheKey,
		hasCachedOptions: globalOptionsCache.has(cacheKey),
	});

	const options = useMemo(() => {
		// Check global cache first
		if (globalOptionsCache.has(cacheKey)) {
			console.log(`[useAppStore] Reusing GLOBAL cached options for ${storeId}`);
			return globalOptionsCache.get(cacheKey);
		}

		console.log(`[useAppStore] Creating NEW options for ${storeId}`);
		// Create new options only when values actually change
		const newOptions = storeOptions({
			storeId,
			schema,
			adapter: makePersistedAdapter({
				sync: {
					backend:
						syncUrl && sessionToken ? makeWsSync({ url: syncUrl }) : undefined,
				},
			}),
			syncPayload: sessionToken ? { authToken: sessionToken } : undefined,
			batchUpdates,
		});

		// Store in global cache
		globalOptionsCache.set(cacheKey, newOptions);
		console.log(`[useAppStore] Cached options globally for key: ${cacheKey}`);

		return newOptions;
	}, [cacheKey, storeId, sessionToken]);

	return useStore(options);
};
