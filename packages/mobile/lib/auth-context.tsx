import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import { router } from "expo-router";
import {
  authClient,
  secureStorageAdapter,
  AUTH_TOKEN_KEY,
  AUTH_SESSION_KEY,
} from "./auth";

// Types for the auth context
export interface User {
  id: string;
  email: string;
  name: string | null;
  emailVerified: boolean;
  image: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Session {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
  ipAddress?: string | null;
  userAgent?: string | null;
  activeOrganizationId?: string | null;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  logo?: string | null;
  createdAt: Date;
  metadata?: Record<string, unknown> | null;
}

export interface AuthState {
  user: User | null;
  session: Session | null;
  organization: Organization | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
}

export interface AuthContextValue extends AuthState {
  // Auth actions
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name?: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;

  // Organization actions
  setActiveOrganization: (orgId: string) => Promise<void>;

  // Utility
  clearError: () => void;
}

// Create the context
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// Provider props
interface AuthProviderProps {
  children: ReactNode;
}

// Auth Provider component
export function AuthProvider({ children }: AuthProviderProps) {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    organization: null,
    isLoading: true,
    isAuthenticated: false,
    error: null,
  });

  // Initialize auth state from storage and verify with server
  const initializeAuth = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      // First check stored session
      const storedSessionData = await secureStorageAdapter.getItem(AUTH_SESSION_KEY);
      const storedSession = storedSessionData ? JSON.parse(storedSessionData) : null;

      // Then verify with server
      const sessionResult = await authClient.getSession();

      if (sessionResult.data?.session && sessionResult.data?.user) {
        setState({
          user: sessionResult.data.user as User,
          session: sessionResult.data.session as unknown as Session,
          organization: null, // Will be fetched separately if needed
          isLoading: false,
          isAuthenticated: true,
          error: null,
        });
      } else if (storedSession) {
        // We have a stored session but server doesn't recognize it
        // Clear the stored session and require re-authentication
        await secureStorageAdapter.removeItem(AUTH_TOKEN_KEY);
        await secureStorageAdapter.removeItem(AUTH_SESSION_KEY);
        setState({
          user: null,
          session: null,
          organization: null,
          isLoading: false,
          isAuthenticated: false,
          error: null,
        });
      } else {
        // No session
        setState({
          user: null,
          session: null,
          organization: null,
          isLoading: false,
          isAuthenticated: false,
          error: null,
        });
      }
    } catch (error) {
      console.error("[AuthContext] Error initializing auth:", error);
      setState({
        user: null,
        session: null,
        organization: null,
        isLoading: false,
        isAuthenticated: false,
        error: error instanceof Error ? error.message : "Failed to initialize auth",
      });
    }
  }, []);

  // Initialize on mount
  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  // Sign in handler
  const handleSignIn = useCallback(async (email: string, password: string) => {
    try {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      const result = await authClient.signIn.email({
        email,
        password,
      });

      if (result.error) {
        throw new Error(result.error.message || "Sign in failed");
      }

      if (result.data) {
        // Store session data
        await secureStorageAdapter.setItem(
          AUTH_SESSION_KEY,
          JSON.stringify(result.data)
        );

        // Store token if present
        if (result.data.token) {
          await secureStorageAdapter.setItem(AUTH_TOKEN_KEY, result.data.token);
        }

        // Create a session object from the response
        const session: Session = {
          id: result.data.user.id, // Use user ID as session ID if not provided
          userId: result.data.user.id,
          token: result.data.token || "",
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Default 7 days
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        setState({
          user: result.data.user as User,
          session,
          organization: null,
          isLoading: false,
          isAuthenticated: true,
          error: null,
        });

        // Navigate to main app
        router.replace("/(main)/projects");
      }
    } catch (error) {
      console.error("[AuthContext] Sign in error:", error);
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : "Sign in failed",
      }));
      throw error;
    }
  }, []);

  // Sign up handler
  const handleSignUp = useCallback(
    async (email: string, password: string, name?: string) => {
      try {
        setState((prev) => ({ ...prev, isLoading: true, error: null }));

        const result = await authClient.signUp.email({
          email,
          password,
          name: name || email.split("@")[0],
        });

        if (result.error) {
          throw new Error(result.error.message || "Sign up failed");
        }

        if (result.data) {
          // Store session data
          await secureStorageAdapter.setItem(
            AUTH_SESSION_KEY,
            JSON.stringify(result.data)
          );

          // Store token if present
          if (result.data.token) {
            await secureStorageAdapter.setItem(AUTH_TOKEN_KEY, result.data.token);
          }

          // Create a session object from the response
          const session: Session = {
            id: result.data.user.id,
            userId: result.data.user.id,
            token: result.data.token || "",
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          setState({
            user: result.data.user as User,
            session,
            organization: null,
            isLoading: false,
            isAuthenticated: true,
            error: null,
          });

          // Navigate to main app
          router.replace("/(main)/projects");
        }
      } catch (error) {
        console.error("[AuthContext] Sign up error:", error);
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : "Sign up failed",
        }));
        throw error;
      }
    },
    []
  );

  // Sign out handler
  const handleSignOut = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      await authClient.signOut();
    } catch (error) {
      console.error("[AuthContext] Sign out error:", error);
    } finally {
      // Always clear local storage on sign out
      await secureStorageAdapter.removeItem(AUTH_TOKEN_KEY);
      await secureStorageAdapter.removeItem(AUTH_SESSION_KEY);

      setState({
        user: null,
        session: null,
        organization: null,
        isLoading: false,
        isAuthenticated: false,
        error: null,
      });

      // Navigate to login
      router.replace("/(auth)/login");
    }
  }, []);

  // Refresh session
  const refreshSession = useCallback(async () => {
    await initializeAuth();
  }, [initializeAuth]);

  // Set active organization
  const setActiveOrganization = useCallback(async (orgId: string) => {
    try {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      // Call the organization client to set active org
      const result = await authClient.organization.setActive({
        organizationId: orgId,
      });

      if (result.data) {
        setState((prev) => ({
          ...prev,
          organization: result.data as unknown as Organization,
          isLoading: false,
        }));
      }
    } catch (error) {
      console.error("[AuthContext] Set active org error:", error);
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : "Failed to set organization",
      }));
    }
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  // Memoize context value
  const contextValue = useMemo<AuthContextValue>(
    () => ({
      ...state,
      signIn: handleSignIn,
      signUp: handleSignUp,
      signOut: handleSignOut,
      refreshSession,
      setActiveOrganization,
      clearError,
    }),
    [
      state,
      handleSignIn,
      handleSignUp,
      handleSignOut,
      refreshSession,
      setActiveOrganization,
      clearError,
    ]
  );

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
}

// Hook to use auth context
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

// Hook to require authentication
// Redirects to login if not authenticated
export function useRequireAuth(): AuthContextValue {
  const auth = useAuth();

  useEffect(() => {
    if (!auth.isLoading && !auth.isAuthenticated) {
      router.replace("/(auth)/login");
    }
  }, [auth.isLoading, auth.isAuthenticated]);

  return auth;
}

// Hook for screens that should only be shown to non-authenticated users
// (e.g., login, signup pages)
export function useRedirectIfAuthenticated(): AuthContextValue {
  const auth = useAuth();

  useEffect(() => {
    if (!auth.isLoading && auth.isAuthenticated) {
      router.replace("/(main)/projects");
    }
  }, [auth.isLoading, auth.isAuthenticated]);

  return auth;
}

export default AuthContext;
