// apps/mobile/lib/biometric.ts
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";

const BIOMETRIC_ENABLED_KEY = "biometric.enabled";
const BIOMETRIC_SETUP_COMPLETE_KEY = "biometric.setup.complete";

export async function isBiometricAvailable(): Promise<boolean> {
	const compatible = await LocalAuthentication.hasHardwareAsync();
	if (!compatible) return false;

	const enrolled = await LocalAuthentication.isEnrolledAsync();
	return enrolled;
}

export async function isBiometricEnabled(): Promise<boolean> {
	try {
		const value = await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY);
		return value === "true";
	} catch {
		return false;
	}
}

export async function setBiometricEnabled(enabled: boolean): Promise<void> {
	await SecureStore.setItemAsync(
		BIOMETRIC_ENABLED_KEY,
		enabled ? "true" : "false",
	);
	// Mark setup as complete when user makes a choice
	await SecureStore.setItemAsync(BIOMETRIC_SETUP_COMPLETE_KEY, "true");
}

export async function isBiometricSetupComplete(): Promise<boolean> {
	try {
		const value = await SecureStore.getItemAsync(BIOMETRIC_SETUP_COMPLETE_KEY);
		return value === "true";
	} catch {
		return false;
	}
}

export async function authenticateWithBiometric(): Promise<boolean> {
	try {
		const result = await LocalAuthentication.authenticateAsync({
			promptMessage: "Authenticate to access SiteLink",
			cancelLabel: "Cancel",
			fallbackLabel: "Use Password",
		});

		return result.success;
	} catch {
		return false;
	}
}

export function getBiometricType(): "face" | "fingerprint" | "iris" | null {
	// This is a simplified version - in production you'd check the actual type
	// For now, we'll let the system handle it
	return null;
}

/**
 * Clear all biometric settings (for logout or testing)
 */
export async function clearBiometricSettings(): Promise<void> {
	try {
		await SecureStore.deleteItemAsync(BIOMETRIC_ENABLED_KEY);
		await SecureStore.deleteItemAsync(BIOMETRIC_SETUP_COMPLETE_KEY);
	} catch {
		// Ignore errors
	}
}
