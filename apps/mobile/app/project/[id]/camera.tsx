import { nanoid, queryDb } from "@livestore/livestore"
import { useStore } from "@livestore/react"
import { events, tables } from "@sitelink/domain"
import * as FileSystem from "expo-file-system/legacy"
import { useLocalSearchParams, useRouter } from "expo-router"
import { Camera, Check, Image, Search, Video, X, Zap, ZapOff } from "lucide-react-native"
import * as React from "react"
import { Animated, FlatList, Modal, Pressable, StyleSheet, TextInput, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { CameraLinkContext } from "@/components/camera/camera-link-context"
import { CameraModeToggle } from "@/components/camera/camera-mode-toggle"
import { CameraOverlayTop } from "@/components/camera/camera-overlay-top"
import { CameraShutter } from "@/components/camera/camera-shutter"
import { CameraViewfinder } from "@/components/camera/camera-viewfinder"
import { GlassCircle, ShutterButton } from "@/components/camera/glass-controls"
import { IssueModeBanner } from "@/components/camera/issue-mode-banner"
import { PhotoPreview } from "@/components/camera/photo-preview"
import { PhotoPreviewLayer } from "@/components/camera/photo-preview-layer"
import { RecordingLayer } from "@/components/camera/recording-layer"
import { VoiceRecordingOverlay } from "@/components/camera/voice-recording-overlay"
import type { Plan } from "@/components/plans/plan-selector"
import { PlanSelector } from "@/components/plans/plan-selector"
import { Icon } from "@/components/ui/icon"
import { Text } from "@/components/ui/text"
import { useAudioRecorder } from "@/hooks/use-audio-recorder"
import { useCameraState } from "@/hooks/use-camera-state"
import { MOCK_FOLDERS } from "@/lib/mock-data"
import { isPrototypeMode } from "@/lib/prototype-mode"
import { useSessionContext } from "@/lib/session-context"
import { createAppStoreOptions } from "@/lib/store-config"
import { cn } from "@/lib/utils"
import { ensureProjectDirectoriesExist, getMediaPath } from "@/utils/file-paths"
import { detectTextInPhoto } from "@/utils/ocr"

export const options = {
  presentation: "fullScreenModal" as const,
  headerShown: false,
}

type CameraScreenState = "camera" | "preview" | "recording"

type PrototypeCameraState = "viewfinder" | "preview" | "linking" | "voice-recording" | "done"

type PrototypeCaptureMode = "photo" | "video"

const PLACEHOLDER_COLORS = ["#4f46e5", "#7c3aed", "#db2777", "#ea580c", "#059669", "#0284c7"]

function PrototypeCameraScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()

  const [state, setState] = React.useState<PrototypeCameraState>("viewfinder")
  const [captureMode, setCaptureMode] = React.useState<PrototypeCaptureMode>("photo")
  const [isIssueMode, setIsIssueMode] = React.useState(false)
  const [flashOn, setFlashOn] = React.useState(false)
  const [isRecordingVideo, setIsRecordingVideo] = React.useState(false)
  const [videoTimer, setVideoTimer] = React.useState(0)
  const [voiceDuration, setVoiceDuration] = React.useState(0)
  const [isVoiceNoteActive, setIsVoiceNoteActive] = React.useState(false)
  const [linkedSheet, setLinkedSheet] = React.useState<string | null>(null)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [placeholderColor, setPlaceholderColor] = React.useState(PLACEHOLDER_COLORS[0])

  const videoPulseAnim = React.useRef(new Animated.Value(1)).current

  React.useEffect(() => {
    if (!isRecordingVideo) return
    const interval = setInterval(() => {
      setVideoTimer((prev) => prev + 1)
    }, 1000)
    return () => clearInterval(interval)
  }, [isRecordingVideo])

  React.useEffect(() => {
    if (!isRecordingVideo) return
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(videoPulseAnim, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(videoPulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    )
    pulse.start()
    return () => pulse.stop()
  }, [isRecordingVideo, videoPulseAnim])

  React.useEffect(() => {
    if (state !== "voice-recording") return
    const interval = setInterval(() => {
      setVoiceDuration((prev) => prev + 1)
    }, 1000)
    return () => clearInterval(interval)
  }, [state])

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const handleCapture = React.useCallback(() => {
    if (captureMode === "video") {
      if (isRecordingVideo) {
        setIsRecordingVideo(false)
        setVideoTimer(0)
        setState("preview")
        setPlaceholderColor(
          PLACEHOLDER_COLORS[Math.floor(Math.random() * PLACEHOLDER_COLORS.length)],
        )
      } else {
        setIsRecordingVideo(true)
        setVideoTimer(0)
      }
      return
    }

    setPlaceholderColor(PLACEHOLDER_COLORS[Math.floor(Math.random() * PLACEHOLDER_COLORS.length)])
    setState("preview")
  }, [captureMode, isRecordingVideo])

  const handleRetake = React.useCallback(() => {
    setIsVoiceNoteActive(false)
    setVoiceDuration(0)
    setLinkedSheet(null)
    setState("viewfinder")
  }, [])

  const handleDone = React.useCallback(() => {
    router.back()
  }, [router])

  const handleClose = React.useCallback(() => {
    router.back()
  }, [router])

  const handleToggleVoice = React.useCallback(() => {
    if (isVoiceNoteActive) {
      setIsVoiceNoteActive(false)
      setVoiceDuration(0)
    } else {
      setVoiceDuration(0)
      setState("voice-recording")
    }
  }, [isVoiceNoteActive])

  const handleStopVoice = React.useCallback(() => {
    setIsVoiceNoteActive(true)
    setState("preview")
  }, [])

  const handleLinkToPlan = React.useCallback(() => {
    setSearchQuery("")
    setState("linking")
  }, [])

  const handleSelectSheet = React.useCallback((sheetNumber: string, sheetTitle: string) => {
    setLinkedSheet(`${sheetNumber} - ${sheetTitle}`)
    setState("preview")
  }, [])

  const handleToggleCaptureMode = React.useCallback(() => {
    setCaptureMode((prev) => (prev === "photo" ? "video" : "photo"))
  }, [])

  const filteredSheets = React.useMemo(() => {
    const allSheets = MOCK_FOLDERS.flatMap((folder) =>
      folder.sheets.map((sheet) => ({ ...sheet, folderName: folder.name })),
    )
    if (!searchQuery.trim()) return allSheets
    const q = searchQuery.toLowerCase()
    return allSheets.filter(
      (s) =>
        s.number.toLowerCase().includes(q) ||
        s.title.toLowerCase().includes(q) ||
        s.folderName.toLowerCase().includes(q),
    )
  }, [searchQuery])

  if (state === "viewfinder") {
    return (
      <View style={protoStyles.fullScreen}>
        <View style={protoStyles.viewfinderBg}>
          <View style={protoStyles.crosshairH} />
          <View style={protoStyles.crosshairV} />
        </View>

        {isRecordingVideo && (
          <View style={[protoStyles.recordingBanner, { top: insets.top + 60 }]}>
            <Animated.View style={[protoStyles.recDot, { opacity: videoPulseAnim }]} />
            <Text className="font-mono text-base font-bold text-white">
              {formatTimer(videoTimer)}
            </Text>
          </View>
        )}

        <View style={[protoStyles.topBar, { paddingTop: insets.top + 8 }]}>
          <GlassCircle icon={X} onPress={handleClose} accessibilityLabel="Close camera" />
          <View style={protoStyles.topBarRight}>
            <GlassCircle
              icon={flashOn ? Zap : ZapOff}
              onPress={() => setFlashOn((prev) => !prev)}
              accessibilityLabel={flashOn ? "Flash on" : "Flash off"}
              iconClassName={flashOn ? "text-yellow-300" : "text-white/60"}
            />
          </View>
        </View>

        {isIssueMode && (
          <View style={[protoStyles.issueModeBanner, { top: insets.top + 60 }]}>
            <Text className="text-sm font-semibold text-white">ISSUE MODE</Text>
          </View>
        )}

        <View style={[protoStyles.bottomControls, { paddingBottom: Math.max(insets.bottom, 24) }]}>
          <Pressable
            onPress={() => setIsIssueMode((prev) => !prev)}
            style={[protoStyles.issueModeToggle, isIssueMode && protoStyles.issueModeToggleActive]}
            accessibilityRole="button"
            accessibilityLabel={isIssueMode ? "Disable issue mode" : "Enable issue mode"}
          >
            <Text
              className={cn("text-xs font-semibold", isIssueMode ? "text-white" : "text-white/70")}
            >
              {isIssueMode ? "Issue ON" : "Issue"}
            </Text>
          </Pressable>

          <View style={protoStyles.shutterRow}>
            <GlassCircle icon={Image} onPress={() => {}} accessibilityLabel="Open gallery" />

            <ShutterButton
              onPress={handleCapture}
              isIssueMode={isIssueMode}
              isVideoMode={captureMode === "video"}
              isRecording={isRecordingVideo}
            />

            <GlassCircle
              icon={captureMode === "photo" ? Video : Camera}
              onPress={handleToggleCaptureMode}
              accessibilityLabel={captureMode === "photo" ? "Switch to video" : "Switch to photo"}
            />
          </View>
        </View>
      </View>
    )
  }

  if (state === "preview") {
    return (
      <PhotoPreview
        placeholderColor={placeholderColor}
        isVoiceNoteActive={isVoiceNoteActive}
        voiceDuration={voiceDuration}
        linkedSheet={linkedSheet}
        onRetake={handleRetake}
        onToggleVoice={handleToggleVoice}
        onLinkToPlan={handleLinkToPlan}
        onDone={handleDone}
      />
    )
  }

  if (state === "voice-recording") {
    return (
      <View style={protoStyles.fullScreen}>
        <View style={[protoStyles.photoPlaceholder, { backgroundColor: placeholderColor }]} />
        <VoiceRecordingOverlay duration={voiceDuration} onStop={handleStopVoice} />
      </View>
    )
  }

  if (state === "linking") {
    return (
      <View style={protoStyles.fullScreen}>
        <View style={[protoStyles.photoPlaceholderDimmed, { backgroundColor: placeholderColor }]} />

        <View style={[protoStyles.linkingSheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={protoStyles.linkingHandle} />

          <Text className="mb-4 text-center text-lg font-bold text-white">Link to Plan</Text>

          <View style={protoStyles.searchContainer}>
            <Icon as={Search} className="size-4 text-white/40" />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search sheets..."
              placeholderTextColor="rgba(255,255,255,0.4)"
              style={protoStyles.searchInput}
            />
          </View>

          <FlatList
            data={filteredSheets}
            keyExtractor={(item) => item.id}
            style={protoStyles.sheetList}
            renderItem={({ item }) => {
              const isSelected = linkedSheet === `${item.number} - ${item.title}`
              return (
                <Pressable
                  onPress={() => handleSelectSheet(item.number, item.title)}
                  style={[protoStyles.sheetRow, isSelected && protoStyles.sheetRowSelected]}
                >
                  <View style={protoStyles.sheetInfo}>
                    <Text className="text-base font-bold text-white">{item.number}</Text>
                    <Text className="text-sm text-white/60" numberOfLines={1}>
                      {item.title}
                    </Text>
                  </View>
                  {isSelected && <Icon as={Check} className="size-5 text-blue-400" />}
                </Pressable>
              )
            }}
            ListEmptyComponent={
              <View style={protoStyles.emptyList}>
                <Text className="text-sm text-white/40">No sheets found</Text>
              </View>
            }
          />

          <View style={protoStyles.linkingActions}>
            <Pressable onPress={() => setState("preview")} style={protoStyles.linkingCancelBtn}>
              <Text className="text-sm font-semibold text-white">Cancel</Text>
            </Pressable>
            {linkedSheet && (
              <Pressable
                onPress={() => {
                  setLinkedSheet(null)
                  setState("preview")
                }}
                style={protoStyles.linkingClearBtn}
              >
                <Text className="text-sm font-semibold text-red-400">Clear Link</Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    )
  }

  return null
}

export default function CameraScreen() {
  if (isPrototypeMode()) {
    return <PrototypeCameraScreen />
  }

  return <RealCameraScreen />
}

function RealCameraScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ id: string }>()
  const insets = useSafeAreaInsets()
  const [screenState, setScreenState] = React.useState<CameraScreenState>("camera")
  const [capturedPhotoUri, setCapturedPhotoUri] = React.useState<string | null>(null)
  const [currentPhotoId, setCurrentPhotoId] = React.useState<string | null>(null)
  const [ocrText, setOcrText] = React.useState<string | null>(null)
  const [isOcrLoading, setIsOcrLoading] = React.useState(false)
  const [markerLabel, setMarkerLabel] = React.useState<string | null>(null)
  const [waveform, setWaveform] = React.useState<number[]>([])
  const [isPlanSelectorVisible, setIsPlanSelectorVisible] = React.useState(false)

  const camera = useCameraState()
  const audio = useAudioRecorder()

  const { sessionToken, userId } = useSessionContext()

  const storeOptions = React.useMemo(() => createAppStoreOptions(sessionToken), [sessionToken])

  const store = useStore(storeOptions)

  const projectQuery = React.useMemo(
    () => queryDb(tables.projects.where({ id: params.id })),
    [params.id],
  )
  const projectData = store.useQuery(projectQuery)?.[0]
  const organizationId = projectData?.organizationId

  const { requestPermissions } = camera
  React.useEffect(() => {
    requestPermissions()
  }, [requestPermissions])

  React.useEffect(() => {
    if (audio.state.isRecording) {
      const bars = 20
      const interval = setInterval(() => {
        setWaveform(Array.from({ length: bars }, () => Math.random() * 0.8 + 0.2))
      }, 150)
      return () => clearInterval(interval)
    } else {
      setWaveform([])
    }
  }, [audio.state.isRecording])

  const handleCapturePhoto = React.useCallback(async () => {
    if (!userId || !organizationId) {
      console.error(
        "[CAMERA] Cannot capture photo: user not authenticated or organizationId missing",
      )
      return
    }

    const uri = await camera.capturePhoto()
    if (uri) {
      try {
        const projectId = params.id

        await ensureProjectDirectoriesExist(organizationId, projectId)
        const mediaPath = getMediaPath(organizationId, projectId)

        const timestamp = Date.now()
        const fileName = `photo_${timestamp}.jpg`
        const destinationPath = `${mediaPath}/${fileName}`

        await FileSystem.copyAsync({
          from: uri,
          to: destinationPath,
        })

        const photoId = nanoid()
        setCurrentPhotoId(photoId)
        setCapturedPhotoUri(destinationPath)
        setScreenState("preview")
        setOcrText(null)
        setIsOcrLoading(true)

        if (store && storeOptions) {
          await store.commit(
            events.photoCaptured({
              id: photoId,
              projectId,
              markerId: markerLabel || undefined,
              localPath: destinationPath,
              isIssue: camera.state.isIssueMode,
              capturedAt: new Date(timestamp),
              capturedBy: userId,
            }),
          )
          console.log("[CAMERA] Photo captured and saved to LiveStore:", photoId)
        }

        detectTextInPhoto(destinationPath)
          .then((result) => {
            if (result && result.text.length > 10) {
              setOcrText(result.text)
            }
            setIsOcrLoading(false)
          })
          .catch(() => {
            setIsOcrLoading(false)
          })
      } catch (error) {
        console.error("[CAMERA] Error saving photo:", error)
      }
    }
  }, [
    camera.capturePhoto,
    camera.state.isIssueMode,
    userId,
    params.id,
    markerLabel,
    store,
    storeOptions,
  ])

  const handleRetake = React.useCallback(() => {
    setCapturedPhotoUri(null)
    setCurrentPhotoId(null)
    setOcrText(null)
    setIsOcrLoading(false)
    setScreenState("camera")
  }, [])

  const handleDone = React.useCallback(() => {
    setCapturedPhotoUri(null)
    setCurrentPhotoId(null)
    setOcrText(null)
    setIsOcrLoading(false)
    setScreenState("camera")
  }, [])

  const handleAddVoice = React.useCallback(async () => {
    setScreenState("recording")
    await audio.startRecording()
  }, [audio])

  const handleStopRecording = React.useCallback(async () => {
    await audio.stopRecording()
  }, [audio])

  const handleDeleteRecording = React.useCallback(() => {
    audio.deleteRecording()
    setScreenState("preview")
  }, [audio])

  const handleRecordingDone = React.useCallback(async () => {
    const recordingUri = audio.state.uri

    if (!recordingUri) {
      audio.deleteRecording()
      setScreenState("preview")
      return
    }

    if (!currentPhotoId) {
      console.error("[CAMERA] Cannot save voice note: no associated photo")
      audio.deleteRecording()
      setScreenState("preview")
      return
    }

    try {
      const projectId = params.id

      if (!organizationId) {
        throw new Error("organizationId is missing")
      }

      await ensureProjectDirectoriesExist(organizationId, projectId)
      const mediaPath = getMediaPath(organizationId, projectId)

      const timestamp = Date.now()
      const fileName = `voice_${timestamp}.m4a`
      const destinationPath = `${mediaPath}/${fileName}`

      await FileSystem.copyAsync({
        from: recordingUri,
        to: destinationPath,
      })

      console.log("[CAMERA] Voice recording saved to:", destinationPath)

      const voiceNoteId = nanoid()

      if (store && storeOptions) {
        await store.commit(
          events.voiceNoteRecorded({
            id: voiceNoteId,
            photoId: currentPhotoId,
            localPath: destinationPath,
            durationSeconds: Math.floor(audio.state.duration),
          }),
        )
        console.log("[CAMERA] Voice note metadata saved to LiveStore")

        if (audio.state.transcript) {
          await store.commit(
            events.voiceNoteTranscribed({
              voiceNoteId,
              transcription: audio.state.transcript,
            }),
          )
          console.log("[CAMERA] Voice note transcription saved to LiveStore")
        }
      }
    } catch (error) {
      console.error("[CAMERA] Error saving voice recording:", error)
    }

    audio.deleteRecording()
    setScreenState("preview")
  }, [audio, params.id, currentPhotoId, store, storeOptions])

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

  if (camera.state.hasPermission === false) {
    return (
      <View className="bg-background flex-1 items-center justify-center p-4">
        <Text className="text-foreground mb-2 text-center text-lg font-semibold">
          Camera Permission Required
        </Text>
        <Text className="text-muted-foreground mb-4 text-center">
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
      <View className="bg-background flex-1 items-center justify-center">
        <Text className="text-muted-foreground">Requesting camera permission...</Text>
      </View>
    )
  }

  return (
    <View className="bg-background flex-1" style={styles.container}>
      {screenState === "camera" && (
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

          <CameraLinkContext markerLabel={markerLabel} onLinkPress={handleLinkToPlan} />

          <View
            className="absolute right-0 bottom-0 left-0"
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

      {screenState === "preview" && capturedPhotoUri && (
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
            console.log("Copy OCR:", ocrText)
          }}
          onEditOcr={() => {
            console.log("Edit OCR:", ocrText)
          }}
        />
      )}

      {screenState === "recording" && (
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
          projectId={params.id}
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

const protoStyles = StyleSheet.create({
  fullScreen: {
    flex: 1,
    backgroundColor: "#000",
  },
  viewfinderBg: {
    flex: 1,
    backgroundColor: "#1a1a2e",
    alignItems: "center",
    justifyContent: "center",
  },
  crosshairH: {
    position: "absolute",
    width: 40,
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
  },
  crosshairV: {
    position: "absolute",
    width: 1,
    height: 40,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
  },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    zIndex: 10,
  },
  topBarRight: {
    flexDirection: "row",
    gap: 12,
  },
  issueModeBanner: {
    position: "absolute",
    alignSelf: "center",
    backgroundColor: "rgba(239, 68, 68, 0.8)",
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    zIndex: 10,
  },
  recordingBanner: {
    position: "absolute",
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    zIndex: 10,
  },
  recDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#ef4444",
  },
  bottomControls: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 16,
  },
  issueModeToggle: {
    alignSelf: "center",
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 16,
  },
  issueModeToggleActive: {
    backgroundColor: "rgba(239, 68, 68, 0.8)",
  },
  shutterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 32,
  },
  photoPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  photoPlaceholderDimmed: {
    flex: 1,
    opacity: 0.3,
  },
  linkingSheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(30, 30, 46, 0.95)",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    paddingHorizontal: 16,
    maxHeight: "70%",
  },
  linkingHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    alignSelf: "center",
    marginBottom: 16,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    color: "#fff",
    fontSize: 14,
  },
  sheetList: {
    maxHeight: 320,
  },
  sheetRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 2,
  },
  sheetRowSelected: {
    backgroundColor: "rgba(59, 130, 246, 0.15)",
  },
  sheetInfo: {
    flex: 1,
    gap: 2,
  },
  emptyList: {
    alignItems: "center",
    paddingVertical: 32,
  },
  linkingActions: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
    paddingTop: 12,
    paddingBottom: 8,
  },
  linkingCancelBtn: {
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
  },
  linkingClearBtn: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
  },
})
