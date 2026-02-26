import { makePersistedAdapter } from "@livestore/adapter-expo";
import { queryDb } from "@livestore/livestore";
import { storeOptions, useStore } from "@livestore/react";
import { makeWsSync } from "@livestore/sync-cf/client";
import { schema, tables } from "@sitelink/domain";
import { useEffect, useMemo } from "react";
import { unstable_batchedUpdates as batchUpdates } from "react-native";
import { DEMO_ORG_ID, isDemoMode, seedDemoData } from "@/lib/demo-mode";

const syncUrl = process.env.EXPO_PUBLIC_LIVESTORE_SYNC_URL || "";

// Global cache to ensure we always return the same options object for a given storeId+sessionId
// This survives React component unmount/remount cycles
const globalOptionsCache = new Map<string, any>();

export const useAppStore = (
	storeId: string,
	sessionToken?: string,
	sessionId?: string,
) => {
	const isDemo = isDemoMode();
	const effectiveStoreId = isDemo ? "demo-store" : storeId;
	const cacheKey = `${effectiveStoreId}-${sessionId || "no-session"}`;

	const options = useMemo(() => {
		if (globalOptionsCache.has(cacheKey)) {
			return globalOptionsCache.get(cacheKey);
		}

		const newOptions = storeOptions({
			storeId: effectiveStoreId,
			schema,
			adapter: makePersistedAdapter({
				sync: {
					backend:
						!isDemo && syncUrl && sessionToken
							? makeWsSync({ url: syncUrl })
							: undefined,
				},
			}),
			syncPayload:
				!isDemo && sessionToken ? { authToken: sessionToken } : undefined,
			batchUpdates,
		});

		globalOptionsCache.set(cacheKey, newOptions);
		return newOptions;
	}, [cacheKey, effectiveStoreId, sessionToken, isDemo]);

	const store = useStore(options);

	// Seed demo data once — check the persisted DB, not in-memory state
	useEffect(() => {
		if (!isDemo) return;

		const existing = store.query(
			queryDb(tables.organizations.where({ id: DEMO_ORG_ID })),
		);
		if (existing.length > 0) return;

		seedDemoData(store);
	}, [store, isDemo]);

	return store;
};
