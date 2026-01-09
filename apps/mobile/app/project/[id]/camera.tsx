import * as React from 'react'
import { View, StyleSheet, Pressable } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as FileSystem from 'expo-file-system'
import { Text } from '@/components/ui/text'
import { useCameraState } from '@/hooks/use-camera-state'
import { useAudioRecorder } from '@/hooks/use-audio-recorder'
import { CameraViewfinder } from '@/components/camera/camera-viewfinder'
import { CameraOverlayTop } from '@/components/camera/camera-overlay-top'
import { CameraShutter } from '@/components/camera/camera-shutter'
import { CameraModeToggle } from '@/components/camera/camera-mode-toggle'
import { CameraLinkContext } from '@/components/camera/camera-link-context'
import { IssueModeBanner } from '@/components/camera/issue-mode-banner'
import { PhotoPreviewLayer } from '@/components/camera/photo-preview-layer'
import { RecordingLayer } from '@/components/camera/recording-layer'
import { detectTextInPhoto } from '@/utils/ocr'
import { PlanSelector, Plan } from '@/components/plans/plan-selector'
import { ensureProjectDirectoriesExist, getMediaPath } from '@/utils/file-paths'
import { Modal } from 'react-native'

// Configure route options for Expo Router
export const options = {
  presentation: 'fullScreenModal' as const,
  headerShown: false,
}

type CameraScreenState = 'camera' | 'preview' | 'recording'

export default function CameraScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ id: string }>()
  const insets = useSafeAreaInsets()
  const [screenState, setScreenState] = React.useState<CameraScreenState>('camera')
  const [capturedPhotoUri, setCapturedPhotoUri] = React.useState<string | null>(null)
  const [ocrText, setOcrText] = React.useState<string | null>(null)
  const [isOcrLoading, setIsOcrLoading] = React.useState(false)
  const [markerLabel, setMarkerLabel] = React.useState<string | null>(null) // TODO: Get from route params or context
  const [waveform, setWaveform] = React.useState<number[]>([])
  const [isPlanSelectorVisible, setIsPlanSelectorVisible] = React.useState(false)

  const camera = useCameraState()
  const audio = useAudioRecorder()

  // Request permissions on mount
  const { requestPermissions } = camera
  React.useEffect(() => {
    requestPermissions()
  }, [requestPermissions])

  // Generate real-time waveform when recording
  React.useEffect(() => {
    if (audio.state.isRecording) {
      // Generate mock waveform bars that animate
      const bars = 20
      const interval = setInterval(() => {
        setWaveform(
          Array.from({ length: bars }, () => Math.random() * 0.8 + 0.2)
        )
      }, 150)
      return () => clearInterval(interval)
    } else {
      setWaveform([])
    }
  }, [audio.state.isRecording])

  const handleCapturePhoto = React.useCallback(async () => {
    const uri = await camera.capturePhoto()
    if (uri) {
      setCapturedPhotoUri(uri)
      setScreenState('preview')
      setOcrText(null)
      setIsOcrLoading(true)

      // Trigger OCR in background
      detectTextInPhoto(uri)
        .then(result => {
          if (result && result.text.length > 10) {
            setOcrText(result.text)
          }
          setIsOcrLoading(false)
        })
        .catch(() => {
          setIsOcrLoading(false)
        })
    }
  }, [camera])

  const handleRetake = React.useCallback(() => {
    setCapturedPhotoUri(null)
    setOcrText(null)
    setIsOcrLoading(false)
    setScreenState('camera')
  }, [])

  const handleDone = React.useCallback(async () => {
    if (!capturedPhotoUri) return

    try {
      // TODO: Get organizationId from user context or project data
      const organizationId = 'temp-org-id' // TODO: Replace with actual organizationId
      const projectId = params.id

      // Ensure media directory exists
      await ensureProjectDirectoriesExist(organizationId, projectId)
      const mediaPath = getMediaPath(organizationId, projectId)

      // Generate unique filename
      const timestamp = Date.now()
      const fileName = `photo_${timestamp}.jpg`
      const destinationPath = `${mediaPath}/${fileName}`

      // Copy photo to structured directory
      await FileSystem.copyAsync({
        from: capturedPhotoUri,
        to: destinationPath,
      })

      console.log('[CAMERA] Photo saved to:', destinationPath)

      // TODO: Save metadata to SQLite
      // await savePhotoMetadata({
      //   id: `photo-${timestamp}`,
      //   projectId,
      //   markerId: markerLabel ? extractMarkerId(markerLabel) : null,
      //   localPath: destinationPath,
      //   isIssue: camera.state.isIssueMode,
      //   capturedAt: timestamp,
      //   capturedBy: userId,
      // })

      setCapturedPhotoUri(null)
      setOcrText(null)
      setIsOcrLoading(false)
      setScreenState('camera')
    } catch (error) {
      console.error('[CAMERA] Error saving photo:', error)
      // Still reset state even on error
      setCapturedPhotoUri(null)
      setOcrText(null)
      setIsOcrLoading(false)
      setScreenState('camera')
    }
  }, [capturedPhotoUri, params.id])

  const handleAddVoice = React.useCallback(async () => {
    setScreenState('recording')
    await audio.startRecording()
  }, [audio])

  const handleStopRecording = React.useCallback(async () => {
    await audio.stopRecording()
    // Stay in recording state to show transcript
  }, [audio])

  const handleDeleteRecording = React.useCallback(() => {
    audio.deleteRecording()
    setScreenState('preview')
  }, [audio])

  const handleRecordingDone = React.useCallback(async () => {
    const recordingUri = audio.state.uri
    
    if (recordingUri) {
      try {
        // TODO: Get organizationId from user context or project data
        const organizationId = 'temp-org-id' // TODO: Replace with actual organizationId
        const projectId = params.id

        // Ensure media directory exists
        await ensureProjectDirectoriesExist(organizationId, projectId)
        const mediaPath = getMediaPath(organizationId, projectId)

        // Generate unique filename
        const timestamp = Date.now()
        const fileName = `voice_${timestamp}.m4a`
        const destinationPath = `${mediaPath}/${fileName}`

        // Copy voice recording to structured directory
        await FileSystem.copyAsync({
          from: recordingUri,
          to: destinationPath,
        })

        console.log('[CAMERA] Voice recording saved to:', destinationPath)

        // TODO: Save metadata to SQLite
        // await saveVoiceNoteMetadata({
        //   id: `voice-${timestamp}`,
        //   photoId: currentPhotoId, // Link to photo if available
        //   localPath: destinationPath,
        //   durationSeconds: Math.floor(audio.state.duration),
        //   transcription: audio.state.transcript,
        // })
      } catch (error) {
        console.error('[CAMERA] Error saving voice recording:', error)
      }
    }

    audio.deleteRecording()
    setScreenState('preview')
  }, [audio, params.id])

  const handleLinkToPlan = React.useCallback(() => {
    setIsPlanSelectorVisible(true)
  }, [])

  const handleSelectPlan = React.useCallback((plan: Plan) => {
    setMarkerLabel(`${plan.code} - ${plan.title}`)
    setIsPlanSelectorVisible(false)
  }, [])

  const handleClose = React.useCallback(() => {
    router.back()
  }, [router])

  // Don't render camera if no permission
  if (camera.state.hasPermission === false) {
    return (
      <View className="flex-1 items-center justify-center bg-background p-4">
        <Text className="text-foreground text-lg font-semibold mb-2 text-center">
          Camera Permission Required
        </Text>
        <Text className="text-muted-foreground text-center mb-4">
          Please enable camera access in your device settings.
        </Text>
        <Pressable
          onPress={camera.requestPermissions}
          className="bg-primary rounded-full px-6 py-3"
        >
          <Text className="text-primary-foreground font-semibold">Grant Permission</Text>
        </Pressable>
      </View>
    )
  }

  if (camera.state.hasPermission === null) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <Text className="text-muted-foreground">Requesting camera permission...</Text>
      </View>
    )
  }

  return (
    <View className="flex-1 bg-background" style={styles.container}>
      {screenState === 'camera' && (
        <>
          <CameraViewfinder
            cameraRef={camera.cameraRef}
            cameraType={camera.state.cameraType}
            flashMode={camera.state.flashMode}
          />

          <CameraOverlayTop
            onClose={handleClose}
            onToggleFlash={camera.toggleFlash}
            onToggleCamera={camera.toggleCamera}
            flashMode={camera.state.flashMode}
          />

          <IssueModeBanner visible={camera.state.isIssueMode} />

          <CameraLinkContext
            markerLabel={markerLabel}
            onLinkPress={handleLinkToPlan}
          />

          <View
            className="absolute bottom-0 left-0 right-0"
            style={{ paddingBottom: Math.max(insets.bottom, 32) }}
          >
            <View className="flex-row items-center justify-center px-6">
              <View className="flex-1 items-start">
                <CameraModeToggle
                  isIssueMode={camera.state.isIssueMode}
                  onToggle={camera.toggleIssueMode}
                />
              </View>
              
              <CameraShutter
                onPress={handleCapturePhoto}
                isIssueMode={camera.state.isIssueMode}
                disabled={camera.state.isCapturing}
              />
              
              <View className="flex-1" />
            </View>
          </View>
        </>
      )}

      {screenState === 'preview' && capturedPhotoUri && (
        <PhotoPreviewLayer
          photoUri={capturedPhotoUri}
          markerLabel={markerLabel}
          capturedAt={Date.now()}
          ocrText={ocrText}
          isOcrLoading={isOcrLoading}
          onRetake={handleRetake}
          onDone={handleDone}
          onAddVoice={handleAddVoice}
          onCopyOcr={() => {
            console.log('Copy OCR:', ocrText)
          }}
          onEditOcr={() => {
            console.log('Edit OCR:', ocrText)
          }}
        />
      )}

      {screenState === 'recording' && (
        <RecordingLayer
          isRecording={audio.state.isRecording}
          duration={audio.state.duration}
          waveform={waveform}
          transcript={audio.state.transcript}
          isTranscribing={audio.state.isTranscribing}
          onStop={handleStopRecording}
          onPlay={audio.playRecording}
          onDelete={handleDeleteRecording}
          onDone={handleRecordingDone}
        />
      )}

      <Modal
        visible={isPlanSelectorVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsPlanSelectorVisible(false)}
      >
        <PlanSelector 
          onSelect={handleSelectPlan} 
          onClose={() => setIsPlanSelectorVisible(false)} 
          showCloseButton 
        />
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
})
