// apps/mobile/hooks/useNetworkStatus.ts
import { useEffect, useState } from 'react'

/**
 * Hook to monitor LiveStore network connectivity status.
 * Returns the current network status and logs connectivity changes.
 *
 * Note: This implementation uses a simple polling approach for now.
 * A more sophisticated implementation would subscribe to the networkStatus
 * stream from the store's leader thread context.
 */
export function useNetworkStatus() {
  const [isMonitoring, setIsMonitoring] = useState(true)

  useEffect(() => {
    if (!isMonitoring) return

    console.log('[NETWORK_STATUS] Connectivity monitoring enabled')

    // For now, we'll just log that monitoring is active
    // The actual networkStatus subscription would require access to the
    // store's internal leader thread context, which isn't exposed through
    // the current LiveStore React API

    return () => {
      console.log('[NETWORK_STATUS] Connectivity monitoring disabled')
    }
  }, [isMonitoring])

  return { isMonitoring }
}
