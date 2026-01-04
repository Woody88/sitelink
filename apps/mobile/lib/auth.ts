// apps/mobile/lib/auth.ts
import { createAuthClient } from 'better-auth/react'
import { expoClient } from '@better-auth/expo/client'
import * as SecureStore from 'expo-secure-store'

const BETTER_AUTH_URL = process.env.EXPO_PUBLIC_BETTER_AUTH_URL || 'http://localhost:8787'

export const authClient = createAuthClient({
  baseURL: BETTER_AUTH_URL,
  plugins: [
    expoClient({
      scheme: 'sitelink-mobile',
      storagePrefix: 'sitelink-mobile',
      storage: SecureStore,
    }),
  ],
})

// Export convenience methods that wrap authClient methods
export async function signUp(data: { email: string; password: string; name: string }) {
  return await authClient.signUp.email({
    email: data.email,
    password: data.password,
    name: data.name,
  })
}

export async function signIn(data: { email: string; password: string }) {
  return await authClient.signIn.email({
    email: data.email,
    password: data.password,
  })
}

export async function signOut() {
  return await authClient.signOut()
}

export async function getSession() {
  const session = await authClient.getSession()
  return session.data
}

// Export getCookie for authenticated requests to other endpoints
export function getCookie(): string | null {
  return authClient.getCookie()
}
