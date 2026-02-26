import type React from "react";
import {
	createContext,
	useCallback,
	useContext,
	useMemo,
	useState,
} from "react";
import type { authClient } from "./auth";

interface SessionContextValue {
	session: Awaited<ReturnType<typeof authClient.getSession>> | undefined;
	isPending: boolean;
	isReady: boolean;
	isRefetching: boolean;
	organizationId: string | undefined;
	sessionToken: string | undefined;
	sessionId: string | undefined;
	userId: string | undefined;
	refetch: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

/**
 * SessionProvider - Single source of truth for session state
 *
 * Receives session data from the root layout to ensure consistency across the app.
 * Prevents race conditions by ensuring all components read from the same state.
 */
export function SessionProvider({
	children,
	sessionData,
	isPending,
	refetch,
}: {
	children: React.ReactNode;
	sessionData: any;
	isPending: boolean;
	refetch: () => Promise<any>;
}) {
	const [isRefetching, setIsRefetching] = useState(false);

	const refetchWithTracking = useCallback(async () => {
		setIsRefetching(true);
		try {
			await refetch();
		} finally {
			// Small delay to ensure session state has propagated
			await new Promise((resolve) => setTimeout(resolve, 50));
			setIsRefetching(false);
		}
	}, [refetch]);

	const value = useMemo<SessionContextValue>(
		() => ({
			session: sessionData,
			isPending,
			isRefetching,
			isReady:
				!isPending &&
				!isRefetching &&
				!!sessionData?.session?.activeOrganizationId,
			organizationId: sessionData?.session?.activeOrganizationId,
			sessionToken: sessionData?.session?.token,
			sessionId: sessionData?.session?.id,
			userId: sessionData?.user?.id,
			refetch: refetchWithTracking,
		}),
		[sessionData, isPending, isRefetching, refetchWithTracking],
	);

	return (
		<SessionContext.Provider value={value}>{children}</SessionContext.Provider>
	);
}

export function useSessionContext() {
	const ctx = useContext(SessionContext);
	if (!ctx) {
		throw new Error("useSessionContext must be used within SessionProvider");
	}
	return ctx;
}
