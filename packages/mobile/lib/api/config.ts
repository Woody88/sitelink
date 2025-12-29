/**
 * API Configuration
 */
import Constants from "expo-constants"
import { Platform } from "react-native"

/**
 * Check if running on a physical device (not emulator/simulator)
 */
const isPhysicalDevice = (): boolean => {
	// expo-constants provides isDevice
	return Constants.isDevice ?? false
}

/**
 * Get the API URL based on environment
 *
 * Priority:
 * 1. EXPO_PUBLIC_API_URL environment variable
 * 2. Default based on platform
 *
 * Notes:
 * - Android emulator: uses 10.0.2.2 to access host machine's localhost
 * - iOS simulator: uses localhost directly
 * - Physical devices: need actual network IP or deployed URL
 */
export const getApiUrl = (): string => {
	// Check for environment variable first
	const envUrl = Constants.expoConfig?.extra?.apiUrl
		|| process.env.EXPO_PUBLIC_API_URL

	if (envUrl) {
		// If physical Android device, localhost won't work - keep URL as-is
		// User should set EXPO_PUBLIC_API_URL to their network IP or deployed URL
		if (Platform.OS === "android" && !isPhysicalDevice() && envUrl.includes("localhost")) {
			// Only replace localhost with 10.0.2.2 for Android EMULATOR
			return envUrl.replace("localhost", "10.0.2.2")
		}
		return envUrl
	}

	// Default fallback based on platform
	if (Platform.OS === "android") {
		if (isPhysicalDevice()) {
			// Physical device - this won't work without proper URL
			// Log warning to help developers
			console.warn(
				"[API Config] Running on physical Android device without EXPO_PUBLIC_API_URL set. " +
				"Please set EXPO_PUBLIC_API_URL to your network IP or deployed backend URL."
			)
			return "http://localhost:8787" // Will fail, but shows the issue
		}
		return "http://10.0.2.2:8787"
	}
	return "http://localhost:8787"
}

/**
 * API Configuration object
 */
export const ApiConfig = {
	baseUrl: getApiUrl(),
	timeout: 30000, // 30 seconds
}
