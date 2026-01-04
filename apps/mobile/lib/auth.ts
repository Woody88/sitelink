// apps/mobile/lib/auth.ts
import * as SecureStore from "expo-secure-store"

const BETTER_AUTH_URL =
  process.env.EXPO_PUBLIC_BETTER_AUTH_URL || "http://localhost:8787"

const SESSION_KEY = "better-auth.session_token"

export async function getSessionToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(SESSION_KEY)
  } catch {
    return null
  }
}

export async function setSessionToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(SESSION_KEY, token)
}

export async function removeSessionToken(): Promise<void> {
  await SecureStore.deleteItemAsync(SESSION_KEY)
}

export async function signUp(data: {
  email: string
  password: string
  name: string
}) {
  try {
    const response = await fetch(`${BETTER_AUTH_URL}/api/auth/sign-up`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: data.email,
        password: data.password,
        name: data.name,
      }),
    })

    const result = await response.json()

    if (result.session?.token) {
      await setSessionToken(result.session.token)
      return { data: { user: result.user, session: result.session }, error: null }
    }

    return { data: null, error: { message: result.message || "Sign up failed" } }
  } catch (error) {
    return {
      data: null,
      error: { message: error instanceof Error ? error.message : "Sign up failed" },
    }
  }
}

export async function signIn(data: { email: string; password: string }) {
  try {
    const response = await fetch(`${BETTER_AUTH_URL}/api/auth/sign-in`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: data.email,
        password: data.password,
      }),
    })

    const result = await response.json()

    if (result.session?.token) {
      await setSessionToken(result.session.token)
      return { data: { user: result.user, session: result.session }, error: null }
    }

    return { data: null, error: { message: result.message || "Sign in failed" } }
  } catch (error) {
    return {
      data: null,
      error: { message: error instanceof Error ? error.message : "Sign in failed" },
    }
  }
}

export async function signOut() {
  const token = await getSessionToken()
  if (token) {
    try {
      await fetch(`${BETTER_AUTH_URL}/api/auth/sign-out`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: `better-auth.session_token=${token}`,
        },
      })
    } catch {
      // Ignore errors on sign out
    }
  }
  await removeSessionToken()
}

export async function getSession() {
  const token = await getSessionToken()
  if (!token) return null

  try {
    const response = await fetch(`${BETTER_AUTH_URL}/api/auth/session`, {
      headers: {
        cookie: `better-auth.session_token=${token}`,
      },
    })

    if (!response.ok) {
      await removeSessionToken()
      return null
    }

    const result = await response.json()
    return result.data || null
  } catch {
    await removeSessionToken()
    return null
  }
}

