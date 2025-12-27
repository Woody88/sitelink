/**
 * API Configuration
 */
import Constants from "expo-constants"
import { Platform } from "react-native"

/**
 * Get the API URL based on environment
 *
 * Priority:
 * 1. EXPO_PUBLIC_API_URL environment variable
 * 2. Default based on platform
 */
export const getApiUrl = (): string => {
	// Check for environment variable first
	const envUrl = Constants.expoConfig?.extra?.apiUrl
		|| process.env.EXPO_PUBLIC_API_URL

	if (envUrl) {
		// If Android emulator, replace localhost with 10.0.2.2
		if (Platform.OS === "android" && envUrl.includes("localhost")) {
			return envUrl.replace("localhost", "10.0.2.2")
		}
		return envUrl
	}

	// Default fallback based on platform
	// Android emulator uses 10.0.2.2 to access host machine's localhost
	if (Platform.OS === "android") {
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
