# Media Patterns (Video, Audio, Picker)

## Video

### expo-av Video is Deprecated

```typescript
// DON'T use expo-av for video
import { Video } from 'expo-av'

// DO use expo-video
import { useVideoPlayer, VideoView } from 'expo-video'
```

### Video Playback Pattern

```typescript
import { useVideoPlayer, VideoView } from 'expo-video'
import { useEvent } from 'expo'

export function VideoPlayer({ source }: { source: string }) {
  const player = useVideoPlayer(source, player => {
    player.loop = true
    player.play()
  })

  const { isPlaying } = useEvent(player, 'playingChange', {
    isPlaying: player.playing
  })

  return (
    <VideoView
      style={{ width: '100%', height: 300 }}
      player={player}
      allowsFullscreen
      allowsPictureInPicture
    />
  )
}
```

### Video Controls

```typescript
// Play/Pause
player.play()
player.pause()

// Seek
player.seekBy(10) // forward 10 seconds
player.currentTime = 30 // jump to 30 seconds

// Volume
player.volume = 0.5 // 0.0 to 1.0

// Playback rate
player.playbackRate = 1.5

// Loop
player.loop = true
```

## Audio

### expo-av Audio is Deprecated

```typescript
// DON'T use expo-av for audio
import { Audio } from 'expo-av'

// DO use expo-audio
import { useAudioPlayer, useAudioRecorder } from 'expo-audio'
```

### Audio Playback Pattern

```typescript
import { useAudioPlayer } from 'expo-audio'

export function AudioPlayer({ source }: { source: string }) {
  const player = useAudioPlayer(source)

  const handleReplay = () => {
    player.seekTo(0) // Must seek before replay!
    player.play()
  }

  return (
    <View>
      <Button
        title={player.playing ? 'Pause' : 'Play'}
        onPress={() => player.playing ? player.pause() : player.play()}
      />
      <Button title="Replay" onPress={handleReplay} />
    </View>
  )
}
```

**Important:** expo-audio doesn't automatically reset playback position when audio finishes. Call `seekTo(0)` before replaying.

### Audio Recording Pattern

```typescript
import { useAudioRecorder, RecordingPresets, setAudioModeAsync } from 'expo-audio'

export function AudioRecorder() {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY)

  const startRecording = async () => {
    await setAudioModeAsync({
      allowsRecording: true,
      playsInSilentMode: true
    })
    await recorder.prepareToRecordAsync()
    recorder.record()
  }

  const stopRecording = async () => {
    await recorder.stop()
    const uri = recorder.uri // Recorded file URI
    console.log('Recording saved to:', uri)
  }

  return (
    <View>
      <Button
        title={recorder.isRecording ? 'Stop' : 'Record'}
        onPress={recorder.isRecording ? stopRecording : startRecording}
      />
    </View>
  )
}
```

### Recording Presets

```typescript
import { RecordingPresets } from 'expo-audio'

// Available presets
RecordingPresets.HIGH_QUALITY
RecordingPresets.LOW_QUALITY
```

## Image/Video Picker

### Pick Single Image

```typescript
import * as ImagePicker from 'expo-image-picker'

const pickImage = async () => {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [4, 3],
    quality: 1,
  })

  if (!result.canceled) {
    const uri = result.assets[0].uri
  }
}
```

### Pick Video

```typescript
const pickVideo = async () => {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['videos'],
    videoExportPreset: 'Passthrough',
  })

  if (!result.canceled) {
    const uri = result.assets[0].uri
    const duration = result.assets[0].duration
  }
}
```

### Pick Multiple Items

```typescript
const pickMultiple = async () => {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images', 'videos'],
    allowsMultipleSelection: true,
    selectionLimit: 0, // 0 = unlimited
  })

  if (!result.canceled) {
    const assets = result.assets // Array of selected items
  }
}
```

**Note:** `allowsEditing` is NOT compatible with `allowsMultipleSelection`.

### Camera Capture

```typescript
const takePhoto = async () => {
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    quality: 0.8,
  })
}

const recordVideo = async () => {
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['videos'],
    videoMaxDuration: 60, // seconds
  })
}
```

### Permissions

```typescript
import * as ImagePicker from 'expo-image-picker'

// Request media library permission
const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
if (status !== 'granted') {
  alert('Permission required')
  return
}

// Request camera permission
const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync()
```
