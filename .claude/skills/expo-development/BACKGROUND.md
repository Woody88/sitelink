# Background Processing

## Background Tasks

For deferrable work that runs outside the app lifecycle (sync, updates, etc).

### When to Use

- Syncing data with a server
- Fetching new content
- Checking for expo-updates
- Any task that can be deferred

### Registration (Global Scope)

```typescript
import * as BackgroundTask from 'expo-background-task'
import * as TaskManager from 'expo-task-manager'

const TASK_NAME = 'my-background-task'

// Define OUTSIDE any component (at module level)
TaskManager.defineTask(TASK_NAME, async () => {
  try {
    // Your background work here
    await syncData()
    return BackgroundTask.BackgroundTaskResult.Success
  } catch (error) {
    console.error('Background task failed:', error)
    return BackgroundTask.BackgroundTaskResult.Failed
  }
})
```

### Register in Component

```typescript
async function registerBackgroundTask() {
  return BackgroundTask.registerTaskAsync(TASK_NAME, {
    minimumInterval: 15 // minutes (minimum on Android)
  })
}

async function unregisterBackgroundTask() {
  return BackgroundTask.unregisterTaskAsync(TASK_NAME)
}
```

### Testing During Development

```typescript
// Trigger task immediately for testing
await BackgroundTask.triggerTaskWorkerForTestingAsync()
```

### iOS Configuration

Add to app.json or app.config.js:

```json
{
  "expo": {
    "ios": {
      "infoPlist": {
        "UIBackgroundModes": ["processing"]
      }
    }
  }
}
```

### Key Constraints

- **Android**: Minimum 15-minute intervals (WorkManager)
- **iOS**: System determines optimal timing; not available in simulator
- Tasks persist after restart but stop if user force-kills app
- Only runs when battery is sufficient and network available

## Blob Operations

Use `expo-blob` for web-standards-compliant Blob handling.

### Why expo-blob?

- Web standards compliant
- Superior performance
- Works consistently across all platforms
- Reliable `slice()` method (unlike RN Blob)

### Creating Blobs

```typescript
import { Blob } from 'expo-blob'

// Empty blob
const emptyBlob = new Blob()

// From text
const textBlob = new Blob(['Hello, World!'], { type: 'text/plain' })

// From binary data
const binaryBlob = new Blob([new Uint8Array([1, 2, 3, 4])], {
  type: 'application/octet-stream'
})

// Mixed content
const mixedBlob = new Blob(['Text', new Uint8Array([65, 66, 67])], {
  type: 'text/plain'
})
```

### Converting Formats

```typescript
const blob = new Blob(['Hello, World!'], { type: 'text/plain' })

// To text
const text = await blob.text()

// To Uint8Array
const bytes = await blob.bytes()

// To ArrayBuffer
const arrayBuffer = await blob.arrayBuffer()
```

### Slicing Blobs

```typescript
const blob = new Blob(['Hello, World!'])

const slice1 = blob.slice(0, 5)        // "Hello"
const slice2 = blob.slice(7)           // "World!"
const slice3 = blob.slice(0, 5, 'text/html') // With custom MIME type
```

### Blob Properties

```typescript
const blob = new Blob(['Hello'], { type: 'text/plain' })

blob.size  // 5
blob.type  // "text/plain"
```

## Common Pattern: File Upload with Progress

```typescript
import { File } from 'expo-file-system'
import { Blob } from 'expo-blob'

async function uploadFile(filePath: string, uploadUrl: string) {
  // Read file as bytes
  const file = new File(filePath)
  const bytes = await file.bytes()

  // Create blob
  const blob = new Blob([bytes], { type: 'application/octet-stream' })

  // Upload
  const response = await fetch(uploadUrl, {
    method: 'POST',
    body: blob,
    headers: {
      'Content-Type': blob.type,
    },
  })

  return response
}
```
