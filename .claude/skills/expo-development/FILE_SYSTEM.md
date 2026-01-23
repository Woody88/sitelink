# Modern FileSystem Patterns

## Legacy API Deprecated

```typescript
// DON'T - Legacy API
import * as FileSystem from 'expo-file-system/legacy'
const content = await FileSystem.readAsStringAsync(path, {
  encoding: FileSystem.EncodingType.Base64
})

// DO - Modern File class
import { File } from 'expo-file-system'
const file = new File(path)
const buffer = await file.arrayBuffer()
```

## Reading Files

```typescript
import { File } from 'expo-file-system'

// As ArrayBuffer (for binary processing)
const file = new File(filePath)
const buffer = await file.arrayBuffer()
const bytes = new Uint8Array(buffer)

// As Uint8Array directly
const data = await file.bytes()
const syncData = file.bytesSync() // synchronous

// As text
const text = await file.text()
```

## Writing Files

```typescript
const file = new File(outputPath)
file.create({ intermediates: true })

// Write bytes directly (NO base64!)
file.write(new Uint8Array([...]))

// Write text
file.write('Hello World')
```

## File Handle for Large Files

```typescript
const handle = file.open()
handle.offset = 0
handle.writeBytes(chunk1)
handle.writeBytes(chunk2)
handle.close()
```

## Common Pattern: PDF Processing

```typescript
import { File } from 'expo-file-system'
import { PDFDocument } from 'pdf-lib'

// Read PDF as bytes
const pdfFile = new File(pdfPath)
const buffer = await pdfFile.arrayBuffer()
const pdfBytes = new Uint8Array(buffer)

// Process with pdf-lib
const pdfDoc = await PDFDocument.load(pdfBytes)

// Write result
const outputFile = new File(outputPath)
outputFile.create()
outputFile.write(await pdfDoc.save())
```

## Directory Operations

```typescript
import { Directory, Paths } from 'expo-file-system'

// Create directory
const dir = new Directory(Paths.document, 'my-folder')
dir.create()

// List contents
const contents = await dir.list()

// Check existence
const exists = dir.exists
```

## File Metadata

```typescript
const file = new File(filePath)

// Get file info
const size = file.size
const exists = file.exists
const uri = file.uri
```
