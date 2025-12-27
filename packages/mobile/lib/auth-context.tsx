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

// Storage key for active organization
const ACTIVE_ORG_KEY = "auth_active_org";

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

  // Helper to fetch and set the active organization
  const fetchAndSetActiveOrganization = useCallback(
    async (
      userId: string
    ): Promise<{ organization: Organization | null; activeOrgId: string | null }> => {
      try {
        console.log("[AuthContext] Fetching organizations for user:", userId);

        // Try to get stored active org first
        const storedActiveOrg = await secureStorageAdapter.getItem(ACTIVE_ORG_KEY);

        // Fetch user's organizations
        const orgsResult = await authClient.organization.list();

        if (orgsResult.error) {
          console.error("[AuthContext] Failed to list organizations:", orgsResult.error);
          return { organization: null, activeOrgId: null };
        }

        const organizations = orgsResult.data ?? [];
        console.log("[AuthContext] Found organizations:", organizations.length);

        if (organizations.length === 0) {
          console.log("[AuthContext] No organizations found - creating default org");
          // Create a default organization for the user
          const createResult = await authClient.organization.create({
            name: "My Organization",
            slug: `org-${userId.slice(0, 8)}`,
          });

          if (createResult.error) {
            console.error("[AuthContext] Failed to create organization:", createResult.error);
            return { organization: null, activeOrgId: null };
          }

          if (createResult.data) {
            const newOrg = createResult.data as unknown as Organization;
            console.log("[AuthContext] Created organization:", newOrg.id);

            // Set as active
            await authClient.organization.setActive({ organizationId: newOrg.id });
            await secureStorageAdapter.setItem(ACTIVE_ORG_KEY, newOrg.id);

            return { organization: newOrg, activeOrgId: newOrg.id };
          }
        }

        // Find the organization to set as active
        let activeOrg: Organization | null = null;

        // Check if stored active org is still valid
        if (storedActiveOrg) {
          activeOrg =
            (organizations.find((o) => o.id === storedActiveOrg) as unknown as Organization) ??
            null;
        }

        // If no stored org or it's invalid, use the first one
        if (!activeOrg && organizations.length > 0) {
          activeOrg = organizations[0] as unknown as Organization;
        }

        if (activeOrg) {
          console.log("[AuthContext] Setting active organization:", activeOrg.id);

          // Set as active on the server
          const setActiveResult = await authClient.organization.setActive({
            organizationId: activeOrg.id,
          });

          if (setActiveResult.error) {
            console.error("[AuthContext] Failed to set active org:", setActiveResult.error);
          }

          // Store locally
          await secureStorageAdapter.setItem(ACTIVE_ORG_KEY, activeOrg.id);

          return { organization: activeOrg, activeOrgId: activeOrg.id };
        }

        return { organization: null, activeOrgId: null };
      } catch (error) {
        console.error("[AuthContext] Error fetching organizations:", error);
        return { organization: null, activeOrgId: null };
      }
    },
    []
  );

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
        const user = sessionResult.data.user as User;
        const serverSession = sessionResult.data.session as unknown as Session;

        // Fetch and set the active organization
        const { organization, activeOrgId } = await fetchAndSetActiveOrganization(user.id);

        // Update session with activeOrganizationId
        const session: Session = {
          ...serverSession,
          activeOrganizationId: activeOrgId ?? serverSession.activeOrganizationId ?? null,
        };

        setState({
          user,
          session,
          organization,
          isLoading: false,
          isAuthenticated: true,
          error: null,
        });
      } else if (storedSession) {
        // We have a stored session but server doesn't recognize it
        // Clear the stored session and require re-authentication
        await secureStorageAdapter.removeItem(AUTH_TOKEN_KEY);
        await secureStorageAdapter.removeItem(AUTH_SESSION_KEY);
        await secureStorageAdapter.removeItem(ACTIVE_ORG_KEY);
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
  }, [fetchAndSetActiveOrganization]);

  // Initialize on mount
  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  // Sign in handler
  const handleSignIn = useCallback(async (email: string, password: string) => {
    try {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      console.log("[AuthContext] Attempting sign in for:", email);
      const result = await authClient.signIn.email({
        email,
        password,
      });
      console.log("[AuthContext] Sign in result:", JSON.stringify(result, null, 2));

      if (result.error) {
        console.error("[AuthContext] Sign in error details:", result.error);
        throw new Error(result.error.message || result.error.code || "Sign in failed");
      }

      if (result.data) {
        const user = result.data.user as User;

        // Store session data
        await secureStorageAdapter.setItem(
          AUTH_SESSION_KEY,
          JSON.stringify(result.data)
        );

        // Store token if present
        if (result.data.token) {
          await secureStorageAdapter.setItem(AUTH_TOKEN_KEY, result.data.token);
        }

        // Fetch and set the active organization
        const { organization, activeOrgId } = await fetchAndSetActiveOrganization(user.id);

        // Create a session object from the response with activeOrganizationId
        const session: Session = {
          id: user.id, // Use user ID as session ID if not provided
          userId: user.id,
          token: result.data.token || "",
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Default 7 days
          createdAt: new Date(),
          updatedAt: new Date(),
          activeOrganizationId: activeOrgId,
        };

        setState({
          user,
          session,
          organization,
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
  }, [fetchAndSetActiveOrganization]);

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
          const user = result.data.user as User;

          // Store session data
          await secureStorageAdapter.setItem(
            AUTH_SESSION_KEY,
            JSON.stringify(result.data)
          );

          // Store token if present
          if (result.data.token) {
            await secureStorageAdapter.setItem(AUTH_TOKEN_KEY, result.data.token);
          }

          // For new users, wait a moment for the backend to create the default org
          // The backend's user.create.after hook creates an organization automatically
          await new Promise((resolve) => setTimeout(resolve, 500));

          // Fetch and set the active organization
          const { organization, activeOrgId } = await fetchAndSetActiveOrganization(user.id);

          // Create a session object from the response with activeOrganizationId
          const session: Session = {
            id: user.id,
            userId: user.id,
            token: result.data.token || "",
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            createdAt: new Date(),
            updatedAt: new Date(),
            activeOrganizationId: activeOrgId,
          };

          setState({
            user,
            session,
            organization,
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
    [fetchAndSetActiveOrganization]
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
      await secureStorageAdapter.removeItem(ACTIVE_ORG_KEY);

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

      if (result.error) {
        throw new Error(result.error.message || "Failed to set organization");
      }

      // Store locally
      await secureStorageAdapter.setItem(ACTIVE_ORG_KEY, orgId);

      // Update state with the new organization and session
      setState((prev) => ({
        ...prev,
        organization: result.data as unknown as Organization,
        session: prev.session
          ? { ...prev.session, activeOrganizationId: orgId }
          : prev.session,
        isLoading: false,
        error: null,
      }));
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
