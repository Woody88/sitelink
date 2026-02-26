// apps/mobile/lib/auth.ts

import { expoClient } from "@better-auth/expo/client";
import { organizationClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import * as SecureStore from "expo-secure-store";

const BETTER_AUTH_URL =
	process.env.EXPO_PUBLIC_BETTER_AUTH_URL || "http://localhost:8787";

export const authClient = createAuthClient({
	baseURL: BETTER_AUTH_URL,
	plugins: [
		expoClient({
			scheme: "sitelink-mobile",
			storagePrefix: "sitelink-mobile",
			storage: SecureStore,
		}),
		organizationClient(),
	],
});

// Export convenience methods that wrap authClient methods
export async function signUp(data: {
	email: string;
	password: string;
	name: string;
	organizationName?: string;
}) {
	const result = await authClient.signUp.email({
		email: data.email,
		password: data.password,
		name: data.name,
	});

	// Create organization after successful signup
	if (result.data?.user) {
		try {
			const orgResult = await authClient.organization.create({
				name: data.organizationName || `${data.name}'s Organization`,
				slug: (data.organizationName || data.name)
					.toLowerCase()
					.replace(/\s+/g, "-"),
			});

			if (orgResult.data) {
				// Set the new organization as active in the session
				await authClient.organization.setActive({
					organizationId: orgResult.data.id,
				});
				console.log(
					"[Auth] Organization created and set as active:",
					orgResult.data.id,
				);

				// Return the complete data including organization
				// The caller should refetch the session using useSession's refetch() method
				return {
					...result,
					data: {
						...result.data,
						organization: orgResult.data,
					},
				};
			}
		} catch (error) {
			console.error(
				"[Auth] Failed to create organization after signup:",
				error,
			);
			throw error; // Re-throw to let caller handle the error
		}
	}

	return result;
}

export async function signIn(data: { email: string; password: string }) {
	return await authClient.signIn.email({
		email: data.email,
		password: data.password,
	});
}

export async function signOut() {
	return await authClient.signOut();
}

export async function getSession() {
	const session = await authClient.getSession();
	return session.data;
}

// Export getCookie for authenticated requests to other endpoints
export function getCookie(): string | null {
	return authClient.getCookie();
}
