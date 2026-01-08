// apps/mobile/hooks/useAuthSession.ts
import React from 'react'
import { authClient } from '@/lib/auth'
import { getCookie } from '@/lib/auth'

/**
 * Hook for retrieving session token for sync purposes only.
 * This does NOT gate access to the app - biometric is the access gate.
 * Session token is only used for LiveStore sync authorization.
 */
export function useAuthSession() {
  const { data: session, isPending } = authClient.useSession()

  // Extract token from cookie for sync payload
  const sessionToken = React.useMemo(() => {
    if (!session) return undefined
    const cookie = getCookie()
    if (cookie) {
      const match = cookie.match(/better-auth\.session_token=([^;]+)/)
      return match ? match[1] : undefined
    }
    return undefined
  }, [session])

  return {
    sessionToken,
    isLoading: isPending,
  }
}

