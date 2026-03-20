export interface ProcessedSheet {
  pageNumber: number
  pdfBytes: Uint8Array
  width: number
  height: number
}

// Legacy interface - kept for backward compatibility
export interface ProcessedPage {
  pageNumber: number
  fullImageDataUrl: string
  thumbnailDataUrl: string
  pdfData?: string // Base64 encoded PDF for this single page
  width: number
  height: number
}
