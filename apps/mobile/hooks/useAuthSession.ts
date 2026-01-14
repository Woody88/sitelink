// apps/mobile/hooks/useAuthSession.ts
import { useSessionContext } from "@/lib/session-context";

/**
 * Hook for retrieving session token for sync purposes only.
 * This does NOT gate access to the app - biometric is the access gate.
 * Session token is only used for LiveStore sync authorization.
 *
 * NOTE: This hook now simply wraps useSessionContext for backwards compatibility.
 * Consider using useSessionContext() directly in new code.
 */
export function useAuthSession() {
	const { sessionToken, isPending } = useSessionContext();

	return {
		sessionToken,
		isLoading: isPending,
	};
}
