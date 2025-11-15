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
  projectId: string
  planId: string
  organizationId: string
  sheetNumber: number
  sheetKey: string
  totalSheets: number
}
