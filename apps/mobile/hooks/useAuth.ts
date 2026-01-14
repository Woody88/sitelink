// apps/mobile/hooks/useAuth.ts
import { authClient, signIn, signOut, signUp } from "@/lib/auth";
import { clearBiometricSettings } from "@/lib/biometric";
import { useSessionContext } from "@/lib/session-context";

export function useAuth() {
	const { session, isPending, refetch } = useSessionContext();

	const user = session?.user || null;
	const isAuthenticated = !!session?.user;
	const isLoading = isPending;

	async function handleSignIn(email: string, password: string) {
		const result = await signIn({ email, password });
		if (result.data?.user) {
			return { success: true };
		}
		return {
			success: false,
			error: result.error?.message || "Sign in failed",
		};
	}

	async function handleSignUp(
		email: string,
		password: string,
		name: string,
		organizationName?: string,
	) {
		const result = await signUp({ email, password, name, organizationName });

		if (result.data?.user) {
			// Clear any existing biometric settings so new user gets the setup screen
			await clearBiometricSettings();

			// Refetch session to get the updated activeOrganizationId
			// This is necessary because better-auth's setActive() doesn't automatically update useSession()
			// The refetch is tracked in SessionContext to prevent navigation during the update
			console.log("[Auth] Refetching session after signup...");
			await refetch();
			console.log("[Auth] Session refetched successfully");

			return { success: true, isNewUser: true };
		}
		return {
			success: false,
			error: result.error?.message || "Sign up failed",
			isNewUser: false,
		};
	}

	async function handleSignOut() {
		// Clear biometric settings so next user gets the setup screen
		await clearBiometricSettings();
		await signOut();
	}

	async function refresh() {
		// Use better-auth's recommended refetch method
		await refetch();
	}

	return {
		user,
		isLoading,
		isAuthenticated,
		signIn: handleSignIn,
		signUp: handleSignUp,
		signOut: handleSignOut,
		refresh,
	};
}
