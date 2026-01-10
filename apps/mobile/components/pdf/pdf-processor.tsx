'use dom'

import { useEffect, useCallback } from 'react'
import * as mupdf from 'mupdf-js'
import type { ProcessedPage } from './types'

interface PDFProcessorProps {
  pdfDataBase64: string
  onProgress?: (current: number, total: number) => void
  onPageProcessed?: (page: ProcessedPage) => void
  onComplete?: (pages: ProcessedPage[]) => void
  onError?: (error: Error) => void
}

const FULL_DPI = 150
const THUMBNAIL_DPI = 72

export default function PDFProcessor({
  pdfDataBase64,
  onProgress,
  onPageProcessed,
  onComplete,
  onError,
}: PDFProcessorProps) {
  const processPDF = useCallback(async () => {
    try {
      if (!pdfDataBase64) return

      await mupdf.ready

      // 1. Load the source document
      const binaryString = atob(pdfDataBase64)
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }
      
      const srcDoc = mupdf.Document.openDocument(bytes.buffer, 'application/pdf')
      const pageCount = srcDoc.countPages()
      const allProcessedPages: ProcessedPage[] = []

      for (let i = 0; i < pageCount; i++) {
        const page = srcDoc.loadPage(i)
        const bounds = page.getBounds()
        
        // Render images for UI feedback/viewer fallback
        const fullImage = await renderPageToImage(page, bounds, FULL_DPI)
        const thumbnailImage = await renderPageToImage(page, bounds, THUMBNAIL_DPI)

        // Split PDF: Create a brand new PDF document for each page
        const newDoc = new mupdf.Document('application/pdf')
        
        // "Graft" (copy) the specific page from source to new doc
        newDoc.graftPage(0, srcDoc, i)
        
        // Save the new 1-page document to a Buffer
        const outBuffer = newDoc.saveToBuffer('incremental=false')
        
        // Convert Buffer to Base64 to send back to React Native
        const pdfBase64 = btoa(String.fromCharCode(...new Uint8Array(outBuffer)))

        const processedPage: ProcessedPage = {
          pageNumber: i + 1,
          fullImageDataUrl: fullImage.dataUrl,
          thumbnailDataUrl: thumbnailImage.dataUrl,
          pdfData: pdfBase64, // The actual 1-page PDF file
          width: fullImage.width,
          height: fullImage.height,
        }

        allProcessedPages.push(processedPage)
        onPageProcessed?.(processedPage)
        onProgress?.(i + 1, pageCount)

        // Cleanup memory for the new single-page doc
        newDoc.destroy()
      }

      onComplete?.(allProcessedPages)
      srcDoc.destroy()
    } catch (error) {
      onError?.(error instanceof Error ? error : new Error(String(error)))
    }
  }, [pdfDataBase64, onProgress, onPageProcessed, onComplete, onError])

  useEffect(() => {
    processPDF()
  }, [processPDF])

  async function renderPageToImage(
    page: any,
    bounds: number[],
    dpi: number
  ): Promise<{ dataUrl: string; width: number; height: number }> {
    const zoom = dpi / 72
    const matrix = mupdf.Matrix.scale(zoom, zoom)
    const pixmap = page.toPixmap(matrix, mupdf.ColorSpace.DeviceRGB, false)

    const canvas = document.createElement('canvas')
    canvas.width = pixmap.getWidth()
    canvas.height = pixmap.getHeight()

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      throw new Error('Failed to get canvas context')
    }

    const imageData = ctx.createImageData(canvas.width, canvas.height)
    const samples = pixmap.getSamples()
    imageData.data.set(samples)
    ctx.putImageData(imageData, 0, 0)

    const dataUrl = canvas.toDataURL('image/png')

    return {
      dataUrl,
      width: canvas.width,
      height: canvas.height,
    }
  }

  return null // This component runs in a hidden DOM environment
}
