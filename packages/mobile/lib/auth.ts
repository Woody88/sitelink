import { createAuthClient } from "better-auth/react";
import { organizationClient } from "better-auth/client/plugins";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

// API URL configuration
// Android emulator uses 10.0.2.2 to access host machine's localhost
// iOS simulator and web can use localhost directly
const getBaseURL = (): string => {
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl) {
    // If Android emulator, replace localhost with 10.0.2.2
    if (Platform.OS === "android" && envUrl.includes("localhost")) {
      return envUrl.replace("localhost", "10.0.2.2");
    }
    return envUrl;
  }

  // Default fallback
  if (Platform.OS === "android") {
    return "http://10.0.2.2:8787";
  }
  return "http://localhost:8787";
};

// Secure storage keys
const AUTH_TOKEN_KEY = "auth_session_token";
const AUTH_SESSION_KEY = "auth_session_data";

// Storage adapter for React Native using expo-secure-store
const secureStorageAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      if (Platform.OS === "web") {
        // Use localStorage for web
        return localStorage.getItem(key);
      }
      return await SecureStore.getItemAsync(key);
    } catch (error) {
      console.error("[Auth] Error reading from secure storage:", error);
      return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      if (Platform.OS === "web") {
        localStorage.setItem(key, value);
        return;
      }
      await SecureStore.setItemAsync(key, value);
    } catch (error) {
      console.error("[Auth] Error writing to secure storage:", error);
    }
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      if (Platform.OS === "web") {
        localStorage.removeItem(key);
        return;
      }
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      console.error("[Auth] Error removing from secure storage:", error);
    }
  },
};

// Custom fetch wrapper for React Native
// Handles cookies and auth headers properly
const customFetch = async (
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> => {
  const url = typeof input === "string" ? input : input.toString();

  // Get stored token for authorization
  const token = await secureStorageAdapter.getItem(AUTH_TOKEN_KEY);

  const headers = new Headers(init?.headers);

  // Set content type if not already set
  if (!headers.has("Content-Type") && init?.body) {
    headers.set("Content-Type", "application/json");
  }

  // Add authorization header if we have a token
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  // Add credentials for cookie-based auth
  const fetchInit: RequestInit = {
    ...init,
    headers,
    credentials: "include",
  };

  const response = await fetch(url, fetchInit);

  // Handle set-cookie header if present (for session management)
  // Note: In React Native, we may need to extract and store the session token manually
  const setCookie = response.headers.get("set-cookie");
  if (setCookie) {
    // Extract session token from cookie if present
    const sessionMatch = setCookie.match(/better-auth\.session_token=([^;]+)/);
    if (sessionMatch) {
      await secureStorageAdapter.setItem(AUTH_TOKEN_KEY, sessionMatch[1]);
    }
  }

  return response;
};

// Create the auth client with organization plugin
export const authClient = createAuthClient({
  baseURL: getBaseURL(),
  plugins: [organizationClient()],
  fetchOptions: {
    customFetchImpl: customFetch,
  },
});

// Export storage adapter for use in other parts of the app if needed
export { secureStorageAdapter, AUTH_TOKEN_KEY, AUTH_SESSION_KEY };

// Export base URL getter for API calls
export { getBaseURL };
