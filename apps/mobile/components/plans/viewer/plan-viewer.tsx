import * as React from 'react'
import { View, Pressable, StatusBar, ActivityIndicator, Alert } from 'react-native'
import { Text } from '@/components/ui/text'
import { Icon } from '@/components/ui/icon'
import { X, AlertCircle, RefreshCw, Plus } from 'lucide-react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'

import { usePlanViewer, type CalloutMarker, type ViewerState } from '@/hooks/use-plan-viewer'
import { useMarkers } from '@/hooks/use-markers'
import { fetchImageAsBase64 } from '@/lib/image-utils'
import { ViewerControls } from './viewer-controls'
import { SheetInfoBar } from './sheet-info-bar'
import { MarkerDetailSheet } from './marker-detail-sheet'
import OpenSeadragonViewer from './openseadragon-viewer'
import { useStore } from '@livestore/react'
import { events } from '@sitelink/domain'
import { authClient } from '@/lib/auth'
import { createAppStoreOptions } from '@/lib/store-config'
import { nanoid } from '@livestore/livestore'

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

interface PlanViewerProps {
  planId: string
  planCode: string
  planTitle: string
  imageUrl: string
  onClose: () => void
  onSheetChange?: (sheetRef: string) => void
  onTakePhoto?: (marker: CalloutMarker) => void
}

/**
 * Full-screen plan viewer with OpenSeadragon integration
 *
 * Features:
 * - Deep zoom with pinch/pan gestures
 * - Callout marker overlays
 * - Sheet navigation
 * - Professional Wealthsimple-inspired UI
 */
export function PlanViewer({
  planId,
  planCode,
  planTitle,
  imageUrl,
  onClose,
  onSheetChange,
  onTakePhoto,
}: PlanViewerProps) {
  const insets = useSafeAreaInsets()
  const {
    viewerState,
    setViewerState,
    zoomIn,
    zoomOut,
    zoomToFit,
    markers: internalMarkers,
    selectedMarkerId,
    setSelectedMarkerId,
    isLoading,
    setIsLoading,
    error,
    setError,
    // viewerRef - for future use with viewer commands
  } = usePlanViewer({
    onNavigateToSheet: onSheetChange,
  })

  // Query markers from LiveStore for the current sheet
  const liveMarkers = useMarkers(planId)

  // Use LiveStore markers, falling back to internal markers state
  const markers = liveMarkers.length > 0 ? liveMarkers : internalMarkers

  // UI state
  const [showMarkerSheet, setShowMarkerSheet] = React.useState(false)
  const [selectedMarker, setSelectedMarker] = React.useState<CalloutMarker | null>(null)
  const [imageDataUrl, setImageDataUrl] = React.useState<string | null>(null)
  const [retryCount, setRetryCount] = React.useState(0)
  const controlsOpacity = useSharedValue(1)

  const { data: sessionData } = authClient.useSession()
  const sessionToken = sessionData?.session?.token
  const userId = sessionData?.user?.id

  const storeOptions = React.useMemo(
    () => (sessionToken ? createAppStoreOptions(sessionToken) : null),
    [sessionToken]
  )

  const { store } = useStore(storeOptions ?? undefined)

  // Fetch image and convert to base64 to bypass WebView CORS restrictions
  React.useEffect(() => {
    let cancelled = false

    async function loadImage() {
      try {
        setIsLoading(true)
        setError(null)
        console.log('[PlanViewer] Fetching image:', imageUrl)
        const dataUrl = await fetchImageAsBase64(imageUrl)
        if (!cancelled) {
          console.log('[PlanViewer] Image converted to base64, length:', dataUrl.length)
          setImageDataUrl(dataUrl)
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Failed to load image'
          console.error('[PlanViewer] Image fetch error:', message)
          setError(message)
          setIsLoading(false)
        }
      }
    }

    loadImage()
    return () => {
      cancelled = true
    }
  }, [imageUrl, retryCount, setIsLoading, setError])

  // Handle viewer ready - must be async for DOM bridge
  const handleViewerReady = React.useCallback(async () => {
    console.log('[Native] Plan viewer ready signal received')
    setIsLoading(false)
  }, [setIsLoading])

  // Handle viewer error - must be async for DOM bridge
  const handleViewerError = React.useCallback(
    async (errorMessage: string) => {
      setIsLoading(false)
      setError(errorMessage)
    },
    [setIsLoading, setError]
  )

  // Handle viewer state change - must be async for DOM bridge
  const handleViewerStateChange = React.useCallback(
    async (state: ViewerState) => {
      setViewerState(state)
    },
    [setViewerState]
  )

  // Handle marker press - must be async for DOM bridge
  const handleMarkerPress = React.useCallback(
    async (marker: CalloutMarker) => {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      setSelectedMarker(marker)
      setSelectedMarkerId(marker.id)
      setShowMarkerSheet(true)
    },
    [setSelectedMarkerId]
  )

  // Handle close marker sheet
  const handleCloseMarkerSheet = React.useCallback(() => {
    setShowMarkerSheet(false)
    setSelectedMarkerId(null)
  }, [setSelectedMarkerId])

  // Handle navigate to sheet
  const handleNavigateToSheet = React.useCallback(
    (sheetRef: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      onSheetChange?.(sheetRef)
    },
    [onSheetChange]
  )

  // Handle take photo
  const handleTakePhoto = React.useCallback(
    (marker: CalloutMarker) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      onTakePhoto?.(marker)
    },
    [onTakePhoto]
  )

  // Zoom controls
  const handleZoomIn = React.useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    zoomIn()
  }, [zoomIn])

  const handleZoomOut = React.useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    zoomOut()
  }, [zoomOut])

  const handleZoomToFit = React.useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    zoomToFit()
  }, [zoomToFit])

  // Close button handler
  const handleClose = React.useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onClose()
  }, [onClose])

  // Retry on error - increment retry count to trigger new fetch
  const handleRetry = React.useCallback(() => {
    setError(null)
    setImageDataUrl(null)
    setRetryCount((c) => c + 1)
  }, [setError])

  // Handle add marker button
  const handleAddMarkerPress = React.useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    Alert.prompt(
      'Add Marker',
      'Enter a label for the marker:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Add',
          onPress: async (label) => {
            if (!label?.trim() || !userId || !store) {
              return
            }

            const markerId = nanoid()
            const centerX = 0.5
            const centerY = 0.5

            await store.commit(
              events.markerCreated({
                id: markerId,
                sheetId: planId,
                label: label.trim(),
                x: centerX,
                y: centerY,
                createdBy: userId,
              })
            )
            console.log('[PLAN_VIEWER] Marker created:', markerId)
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
          },
        },
      ],
      'plain-text'
    )
  }, [userId, store, planId])

  const controlsAnimatedStyle = useAnimatedStyle(() => ({
    opacity: controlsOpacity.value,
    pointerEvents: controlsOpacity.value > 0.5 ? 'auto' : 'none',
  }))

  return (
    <View className="bg-background flex-1">
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* OpenSeadragon Viewer - only render when image is loaded */}
      <View className="flex-1">
        {imageDataUrl && (
          <OpenSeadragonViewer
            imageUrl={imageDataUrl}
            markers={markers}
            selectedMarkerId={selectedMarkerId}
            onMarkerPress={handleMarkerPress}
            onViewerStateChange={handleViewerStateChange}
            onReady={handleViewerReady}
            onError={handleViewerError}
          />
        )}
      </View>

      {/* Loading overlay */}
      {isLoading && (
        <Animated.View
          entering={FadeIn}
          exiting={FadeOut}
          className="absolute inset-0 items-center justify-center bg-black/80">
          <ActivityIndicator size="large" color="#fff" />
          <Text className="mt-4 text-white">Loading plan...</Text>
        </Animated.View>
      )}

      {/* Error overlay */}
      {error && (
        <Animated.View
          entering={FadeIn}
          className="absolute inset-0 items-center justify-center bg-black/90 px-8">
          <Icon as={AlertCircle} className="text-destructive mb-4 size-16" />
          <Text className="mb-2 text-center text-lg font-semibold text-white">
            Failed to load plan
          </Text>
          <Text className="mb-6 text-center text-sm text-white/60">{error}</Text>
          <Pressable
            onPress={handleRetry}
            className="flex-row items-center gap-2 rounded-full bg-white/10 px-6 py-3 active:bg-white/20">
            <Icon as={RefreshCw} className="size-5 text-white" />
            <Text className="font-semibold text-white">Try Again</Text>
          </Pressable>
        </Animated.View>
      )}

      {/* Controls overlay */}
      <Animated.View
        style={[controlsAnimatedStyle]}
        className="absolute inset-0"
        pointerEvents="box-none">
        {/* Top bar */}
        <View
          className="absolute right-0 left-0"
          style={{ top: insets.top }}
          pointerEvents="box-none">
          <View className="flex-row items-start justify-between px-4 py-2" pointerEvents="box-none">
            {/* Close button */}
            <CloseButton onPress={handleClose} />

            {/* Spacer for balance */}
            <View className="w-12" />
          </View>
        </View>

        {/* Bottom info bar */}
        <View
          className="absolute right-0 left-0"
          style={{ bottom: insets.bottom + 8 }}
          pointerEvents="box-none">
          <SheetInfoBar
            sheetCode={planCode}
            sheetTitle={planTitle}
            markerCount={markers.length}
            onSheetPress={() => {
              // TODO: Open sheet selector
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
            }}
            onMarkersPress={() => {
              // TODO: Open markers list
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
            }}
          />
        </View>

        {/* Right-side zoom controls */}
        <View
          className="absolute right-4"
          style={{ top: insets.top + 80 }}
          pointerEvents="box-none">
          <ViewerControls
            zoom={viewerState.zoom}
            minZoom={viewerState.minZoom}
            maxZoom={viewerState.maxZoom}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onZoomToFit={handleZoomToFit}
          />

          {/* Add marker button */}
          <Pressable
            onPress={handleAddMarkerPress}
            className="mt-4 h-12 w-12 items-center justify-center rounded-full bg-black/60 backdrop-blur-md active:bg-black/70"
            accessibilityLabel="Add marker"
            accessibilityRole="button">
            <Icon as={Plus} className="size-6 text-white" />
          </Pressable>
        </View>
      </Animated.View>

      {/* Marker detail sheet */}
      <MarkerDetailSheet
        marker={selectedMarker}
        visible={showMarkerSheet}
        onClose={handleCloseMarkerSheet}
        onNavigateToSheet={handleNavigateToSheet}
        onTakePhoto={handleTakePhoto}
      />
    </View>
  )
}

/**
 * Close button with glass effect
 */
function CloseButton({ onPress }: { onPress: () => void }) {
  const scale = useSharedValue(1)

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  const handlePressIn = () => {
    scale.value = withSpring(0.9, { damping: 15, stiffness: 300 })
  }

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 300 })
  }

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={animatedStyle}
      className="h-12 w-12 items-center justify-center rounded-full bg-black/60 backdrop-blur-md active:bg-black/70"
      accessibilityLabel="Close plan viewer"
      accessibilityRole="button">
      <Icon as={X} className="size-6 text-white" />
    </AnimatedPressable>
  )
}

export default PlanViewer
