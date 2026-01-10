export interface ProcessedPage {
  pageNumber: number
  fullImageDataUrl: string
  thumbnailDataUrl: string
  pdfData?: string // Base64 encoded PDF for this single page
  width: number
  height: number
}
