export interface R2Notification {
  account: string
  action: 'PutObject' | 'CopyObject' | 'DeleteObject' | 'CompleteMultipartUpload'
  bucket: string
  object: {
    key: string
    size?: number
    eTag?: string
  }
  eventTime: string
}

export interface TileJob {
  uploadId: string
  sheetId: string
  projectId: string
  planId: string
  organizationId: string
  /** Sheet number (1-indexed, matches file naming: sheet-1.pdf, sheet-2.pdf, etc.) */
  sheetNumber: number
  sheetKey: string
  totalSheets: number
}

export interface MetadataExtractionJob {
  uploadId: string
  planId: string
  sheetId: string
  sheetNumber: number
  sheetKey: string
  totalSheets: number
}

export interface MarkerDetectionJob {
  uploadId: string
  planId: string
  organizationId: string
  projectId: string
  validSheets: string[]
  // Chunking metadata for parallel processing
  isChunked?: boolean
  chunkIndex?: number
  totalChunks?: number
  tileKeys?: string[]  // Specific tiles for this chunk
  chunkId?: string     // Unique ID for deduplication across chunks
}
