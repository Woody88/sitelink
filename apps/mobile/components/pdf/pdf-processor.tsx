'use dom'

import { useEffect, useCallback } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { PDFDocument } from 'pdf-lib'
import type { ProcessedPage } from './types'

interface PDFProcessorProps {
  pdfDataBase64: string
  onProgress?: (current: number, total: number) => void
  onPageProcessed?: (page: ProcessedPage) => void
  onComplete?: (pages: ProcessedPage[]) => void
  onError?: (error: Error) => void
}

const FULL_SCALE = 2 // 2x for retina displays
const THUMBNAIL_SCALE = 0.5 // Smaller for thumbnails

// Configure PDF.js worker
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`
}

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

      // Convert base64 to Uint8Array
      const binaryString = atob(pdfDataBase64)
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }

      // Load PDF with pdf.js for rendering
      const loadingTask = pdfjsLib.getDocument({ data: bytes })
      const pdfDoc = await loadingTask.promise
      const pageCount = pdfDoc.numPages

      // Load PDF with pdf-lib for splitting
      const pdfLibDoc = await PDFDocument.load(bytes)

      const allProcessedPages: ProcessedPage[] = []

      for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
        // Get page from pdf.js for rendering
        const page = await pdfDoc.getPage(pageNum)
        const viewport = page.getViewport({ scale: 1 })

        // Render full resolution image
        const fullImage = await renderPageToImage(page, viewport, FULL_SCALE)

        // Render thumbnail
        const thumbnailImage = await renderPageToImage(page, viewport, THUMBNAIL_SCALE)

        // Extract single page PDF using pdf-lib
        const singlePageDoc = await PDFDocument.create()
        const [copiedPage] = await singlePageDoc.copyPages(pdfLibDoc, [pageNum - 1])
        singlePageDoc.addPage(copiedPage)

        const pdfBytes = await singlePageDoc.save()
        const pdfBase64 = btoa(String.fromCharCode(...pdfBytes))

        const processedPage: ProcessedPage = {
          pageNumber: pageNum,
          fullImageDataUrl: fullImage.dataUrl,
          thumbnailDataUrl: thumbnailImage.dataUrl,
          pdfData: pdfBase64,
          width: fullImage.width,
          height: fullImage.height,
        }

        allProcessedPages.push(processedPage)
        onPageProcessed?.(processedPage)
        onProgress?.(pageNum, pageCount)
      }

      onComplete?.(allProcessedPages)
    } catch (error) {
      console.error('[PDFProcessor] Error:', error)
      onError?.(error instanceof Error ? error : new Error(String(error)))
    }
  }, [pdfDataBase64, onProgress, onPageProcessed, onComplete, onError])

  useEffect(() => {
    processPDF()
  }, [processPDF])

  async function renderPageToImage(
    page: any,
    viewport: any,
    scale: number
  ): Promise<{ dataUrl: string; width: number; height: number }> {
    const scaledViewport = page.getViewport({ scale })

    const canvas = document.createElement('canvas')
    canvas.width = scaledViewport.width
    canvas.height = scaledViewport.height

    const context = canvas.getContext('2d')
    if (!context) {
      throw new Error('Failed to get canvas context')
    }

    await page.render({
      canvasContext: context,
      viewport: scaledViewport,
    }).promise

    const dataUrl = canvas.toDataURL('image/png')

    return {
      dataUrl,
      width: canvas.width,
      height: canvas.height,
    }
  }

  return null // This component runs in a hidden DOM environment
}
