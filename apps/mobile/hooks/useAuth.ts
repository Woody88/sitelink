// apps/mobile/hooks/useAuth.ts
import { signIn, signOut, signUp, authClient } from '@/lib/auth'
import { clearBiometricSettings } from '@/lib/biometric'

export function useAuth() {
  const { data: session, isPending } = authClient.useSession()

  const user = session?.user || null
  const isAuthenticated = !!session?.user
  const isLoading = isPending

  async function handleSignIn(email: string, password: string) {
    const result = await signIn({ email, password })
    if (result.data?.user) {
      return { success: true }
    }
    return {
      success: false,
      error: result.error?.message || 'Sign in failed',
    }
  }

  async function handleSignUp(email: string, password: string, name: string, organizationName?: string) {
    const result = await signUp({ email, password, name, organizationName })

    if (result.data?.user) {
      // Clear any existing biometric settings so new user gets the setup screen
      await clearBiometricSettings()
      return { success: true, isNewUser: true }
    }
    return {
      success: false,
      error: result.error?.message || 'Sign up failed',
      isNewUser: false,
    }
  }

  async function handleSignOut() {
    // Clear biometric settings so next user gets the setup screen
    await clearBiometricSettings()
    await signOut()
  }

  async function refresh() {
    await authClient.getSession()
  }

  return {
    user,
    isLoading,
    isAuthenticated,
    signIn: handleSignIn,
    signUp: handleSignUp,
    signOut: handleSignOut,
    refresh,
  }
}
