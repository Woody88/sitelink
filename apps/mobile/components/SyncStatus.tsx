// apps/mobile/components/SyncStatus.tsx
import { useEffect, useState } from 'react'
import { View , ActivityIndicator } from 'react-native'
import { Text } from '@/components/ui/text'

type SyncStatus = 'checking' | 'connected' | 'disconnected' | 'no-sync'

interface SyncStatusProps {
  /**
   * Interval in milliseconds to check sync status (default: 10000 = 10 seconds)
   */
  checkInterval?: number
  /**
   * Show detailed status text (default: true)
   */
  showText?: boolean
  /**
   * Size of the status indicator (default: 'sm')
   */
  size?: 'sm' | 'md' | 'lg'
}

export function SyncStatus({
  checkInterval = 10000,
  showText = true,
  size = 'sm',
}: SyncStatusProps) {
  const [status, setStatus] = useState<SyncStatus>('checking')
  const [lastCheck, setLastCheck] = useState<Date | null>(null)

  const syncUrl = process.env.EXPO_PUBLIC_LIVESTORE_SYNC_URL

  useEffect(() => {
    if (!syncUrl) {
      setStatus('no-sync')
      return
    }

    // Convert WebSocket URL to HTTP/HTTPS for health check
    let healthUrl: string
    try {
      const url = new URL(syncUrl)
      // Change protocol from ws/wss to http/https, but preserve http/https if already set
      if (url.protocol === 'ws:') {
        url.protocol = 'http:'
      } else if (url.protocol === 'wss:') {
        url.protocol = 'https:'
      }
      // http: and https: are already correct, no change needed
      // Remove WebSocket-specific paths
      if (url.pathname.endsWith('/websocket') || url.pathname.endsWith('/sync')) {
        url.pathname = url.pathname.replace(/\/websocket$/, '').replace(/\/sync$/, '')
      }
      // Add /health endpoint
      url.pathname = url.pathname === '/' ? '/health' : `${url.pathname}/health`
      healthUrl = url.toString()
    } catch {
      // Fallback to simple string replacement if URL parsing fails
      healthUrl = syncUrl
        .replace(/^ws:/, 'http:')
        .replace(/^wss:/, 'https:')
        .replace(/\/websocket$/, '')
        .replace(/\/sync$/, '')
        .replace(/\/$/, '') + '/health'
    }

    let intervalId: ReturnType<typeof setInterval> | null = null

    async function checkHealth() {
      try {
        const controller = new AbortController()
        const timeoutId: ReturnType<typeof setTimeout> = setTimeout(() => controller.abort(), 5000) // 5 second timeout

        if (__DEV__) {
          console.log('[SyncStatus] Checking health at:', healthUrl)
        }

        const response = await fetch(healthUrl, {
          method: 'GET',
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
          },
        })

        clearTimeout(timeoutId)

        if (__DEV__) {
          console.log('[SyncStatus] Health check response:', response.status, response.statusText)
        }

        if (response.ok) {
          const data = await response.json()
          if (data.status === 'ok') {
            setStatus('connected')
            setLastCheck(new Date())
            if (__DEV__) {
              console.log('[SyncStatus] Connected successfully')
            }
            return
          }
        }
        setStatus('disconnected')
        if (__DEV__) {
          console.log('[SyncStatus] Health check failed - response not ok')
        }
      } catch (error) {
        // Log error for debugging (only in development)
        if (__DEV__) {
          console.log('[SyncStatus] Health check failed:', error)
          console.log('[SyncStatus] Sync URL:', syncUrl)
          console.log('[SyncStatus] Health URL:', healthUrl)
        }
        setStatus('disconnected')
      }
    }

    // Initial check
    checkHealth()

    // Set up periodic checks
    intervalId = setInterval(checkHealth, checkInterval)

    return () => {
      if (intervalId) {
        clearInterval(intervalId)
      }
    }
  }, [syncUrl, checkInterval])

  const sizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4',
  }

  const getStatusColor = () => {
    switch (status) {
      case 'connected':
        return 'bg-green-500'
      case 'disconnected':
        return 'bg-red-500'
      case 'checking':
        return 'bg-yellow-500'
      case 'no-sync':
        return 'bg-gray-400'
      default:
        return 'bg-gray-400'
    }
  }

  const getStatusText = () => {
    switch (status) {
      case 'connected':
        return 'Synced'
      case 'disconnected':
        return 'Offline'
      case 'checking':
        return 'Checking...'
      case 'no-sync':
        return 'No Sync'
      default:
        return 'Unknown'
    }
  }

  if (status === 'no-sync') {
    return null // Don't show anything if sync is not configured
  }

  return (
    <View className="flex-row items-center gap-2">
      {status === 'checking' ? (
        <ActivityIndicator size="small" color="#fbbf24" />
      ) : (
        <View className={`${sizeClasses[size]} rounded-full ${getStatusColor()}`} />
      )}
      {showText && (
        <Text variant="small" className="text-muted-foreground">
          {getStatusText()}
          {lastCheck && status === 'connected' && (
            <Text variant="muted" className="text-xs">
              {' '}
              • {lastCheck.toLocaleTimeString()}
            </Text>
          )}
        </Text>
      )}
    </View>
  )
}

