---
name: expo-development
description: Modern Expo SDK patterns and APIs for React Native. Use when working with Expo apps, React Native file operations, media (video/audio), image picking, or background tasks. Enforces modern APIs and warns about deprecated patterns like expo-av and legacy FileSystem.
---

# Expo Development Patterns

## Critical Deprecations

| Deprecated | Use Instead |
|------------|-------------|
| `expo-av` (Video) | `expo-video` |
| `expo-av` (Audio) | `expo-audio` |
| `expo-file-system` functions | `expo-file-system` File class |
| React Native Blob | `expo-blob` |
| Base64 file operations | Direct byte operations with File API |

## Quick Reference

### File Operations

**ALWAYS use the modern File class, not legacy functions.**

```typescript
import { File } from 'expo-file-system'

// Read as bytes (NOT base64!)
const file = new File(filePath)
const buffer = await file.arrayBuffer()
const bytes = new Uint8Array(buffer)

// Write bytes directly
file.create()
file.write(bytes)
```

See [FILE_SYSTEM.md](FILE_SYSTEM.md) for complete patterns.

### Media Playback

- Video: See [MEDIA.md](MEDIA.md#video)
- Audio: See [MEDIA.md](MEDIA.md#audio)
- Image/Video Picker: See [MEDIA.md](MEDIA.md#picker)

### Background Processing

- Background Tasks: See [BACKGROUND.md](BACKGROUND.md#tasks)
- Blob Operations: See [BACKGROUND.md](BACKGROUND.md#blob)

## Key Principles

1. **Avoid base64 conversions** - Use `File.arrayBuffer()` and `File.write(Uint8Array)`
2. **Use hooks for media** - `useVideoPlayer`, `useAudioPlayer`, `useAudioRecorder`
3. **Web standards compliance** - Use `expo-blob` for reliable Blob operations
4. **Battery-conscious background work** - Use `expo-background-task` for deferrable tasks
