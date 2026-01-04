// apps/mobile/hooks/useAuth.ts
import { useEffect, useState } from "react"
import { getSession, signIn, signOut, signUp } from "@/lib/auth"
import type { User } from "better-auth/types"

interface AuthState {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
  })

  useEffect(() => {
    checkSession()
  }, [])

  async function checkSession() {
    try {
      const session = await getSession()
      setState({
        user: session?.user || null,
        isLoading: false,
        isAuthenticated: !!session?.user,
      })
    } catch {
      setState({
        user: null,
        isLoading: false,
        isAuthenticated: false,
      })
    }
  }

  async function handleSignIn(email: string, password: string) {
    const result = await signIn({ email, password })
    if (result.data?.user) {
      await checkSession()
      return { success: true }
    }
    return {
      success: false,
      error: result.error?.message || "Sign in failed",
    }
  }

  async function handleSignUp(
    email: string,
    password: string,
    name: string
  ) {
    const result = await signUp({ email, password, name })
    if (result.data?.user) {
      await checkSession()
      return { success: true, isNewUser: true }
    }
    return {
      success: false,
      error: result.error?.message || "Sign up failed",
      isNewUser: false,
    }
  }

  async function handleSignOut() {
    await signOut()
    setState({
      user: null,
      isLoading: false,
      isAuthenticated: false,
    })
  }

  return {
    ...state,
    signIn: handleSignIn,
    signUp: handleSignUp,
    signOut: handleSignOut,
    refresh: checkSession,
  }
}

