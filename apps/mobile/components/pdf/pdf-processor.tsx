'use dom'

import { useEffect, useState, useCallback } from 'react'
import * as mupdf from 'mupdf-js'
import type { ProcessedPage } from './types'

interface PDFProcessorProps {
  pdfData: ArrayBuffer
  onProgress?: (current: number, total: number) => void
  onPageProcessed?: (page: ProcessedPage) => void
  onComplete?: (pages: ProcessedPage[]) => void
  onError?: (error: Error) => void
}

const FULL_DPI = 150
const THUMBNAIL_DPI = 72

export default function PDFProcessor({
  pdfData,
  onProgress,
  onPageProcessed,
  onComplete,
  onError,
}: PDFProcessorProps) {
  const [status, setStatus] = useState<'idle' | 'processing' | 'complete' | 'error'>('idle')

  const processPDF = useCallback(async () => {
    try {
      setStatus('processing')
      const processedPages: ProcessedPage[] = []

      await mupdf.ready

      const document = mupdf.Document.openDocument(pdfData, 'application/pdf')
      const pageCount = document.countPages()

      for (let pageNum = 0; pageNum < pageCount; pageNum++) {
        const page = document.loadPage(pageNum)
        const bounds = page.getBounds()

        const fullImage = await renderPageToImage(page, bounds, FULL_DPI)
        const thumbnailImage = await renderPageToImage(page, bounds, THUMBNAIL_DPI)

        const processedPage: ProcessedPage = {
          pageNumber: pageNum + 1,
          fullImageDataUrl: fullImage.dataUrl,
          thumbnailDataUrl: thumbnailImage.dataUrl,
          width: fullImage.width,
          height: fullImage.height,
        }

        processedPages.push(processedPage)
        onPageProcessed?.(processedPage)
        onProgress?.(pageNum + 1, pageCount)
      }

      setStatus('complete')
      onComplete?.(processedPages)
    } catch (error) {
      setStatus('error')
      onError?.(error instanceof Error ? error : new Error(String(error)))
    }
  }, [pdfData, onProgress, onPageProcessed, onComplete, onError])

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

  return (
    <div style={{ display: 'none' }}>
      <span>PDF Processor: {status}</span>
    </div>
  )
}
