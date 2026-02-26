// apps/mobile/lib/onboarding.ts
import * as SecureStore from "expo-secure-store";

const ONBOARDING_COMPLETED_KEY = "onboarding.completed";

export async function isOnboardingCompleted(): Promise<boolean> {
	try {
		const value = await SecureStore.getItemAsync(ONBOARDING_COMPLETED_KEY);
		return value === "true";
	} catch {
		return false;
	}
}

export async function setOnboardingCompleted(): Promise<void> {
	await SecureStore.setItemAsync(ONBOARDING_COMPLETED_KEY, "true");
}

export async function clearOnboardingState(): Promise<void> {
	try {
		await SecureStore.deleteItemAsync(ONBOARDING_COMPLETED_KEY);
	} catch {
		// Ignore errors
	}
}
