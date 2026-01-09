import * as FileSystem from 'expo-file-system'
import { State } from '@livestore/livestore'
import { events } from '@sitelink/domain/events'
import type { ProcessedPage } from '@/components/pdf/types'
import {
  ensurePlanUploadDirectoryExists,
  ensureSheetDirectoryExists,
  getPlanSourcePath,
  getSheetFullImagePath,
  getSheetThumbnailPath,
} from '@/utils/file-paths'

export interface PlanUploadOptions {
  planId: string
  projectId: string
  organizationId: string
  fileName: string
  fileSize: number
  mimeType: string
  sourceUri: string
  uploadedBy: string
}

export interface ProcessingCallbacks {
  onProgress?: (progress: number, current: number, total: number) => void
  onError?: (error: Error) => void
  onComplete?: () => void
}

export async function uploadAndProcessPlan(
  store: State.Store<typeof events>,
  options: PlanUploadOptions,
  callbacks?: ProcessingCallbacks
): Promise<void> {
  const { planId, projectId, organizationId, fileName, fileSize, mimeType, sourceUri, uploadedBy } = options

  try {
    await ensurePlanUploadDirectoryExists(organizationId, projectId, planId)

    const destinationPath = getPlanSourcePath(organizationId, projectId, planId)

    await FileSystem.copyAsync({
      from: sourceUri,
      to: destinationPath,
    })

    await store.dispatch(
      events.planUploaded({
        id: planId,
        projectId,
        fileName,
        fileSize,
        mimeType,
        localPath: destinationPath,
        remotePath: undefined,
        uploadedBy,
        uploadedAt: new Date(),
      })
    )

    await store.dispatch(
      events.planProcessingStarted({
        planId,
        startedAt: new Date(),
      })
    )

    const pdfData = await FileSystem.readAsStringAsync(destinationPath, {
      encoding: FileSystem.EncodingType.Base64,
    })

    const arrayBuffer = base64ToArrayBuffer(pdfData)

    await processPDFPages(store, arrayBuffer, organizationId, projectId, planId, callbacks)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)

    await store.dispatch(
      events.planProcessingFailed({
        planId,
        error: errorMessage,
        failedAt: new Date(),
      })
    )

    callbacks?.onError?.(error instanceof Error ? error : new Error(errorMessage))
    throw error
  }
}

async function processPDFPages(
  store: State.Store<typeof events>,
  pdfData: ArrayBuffer,
  organizationId: string,
  projectId: string,
  planId: string,
  callbacks?: ProcessingCallbacks
): Promise<void> {
  return new Promise((resolve, reject) => {
    const processedPages: Array<{
      id: string
      number: string
      title: string
      discipline: string
      localImagePath: string
      localThumbnailPath: string
      imagePath: undefined
      width: number
      height: number
    }> = []

    let totalPages = 0

    const handleProgress = (current: number, total: number) => {
      totalPages = total
      const progress = Math.round((current / total) * 100)

      store.dispatch(
        events.planProcessingProgress({
          planId,
          progress,
          currentPage: current,
          totalPages: total,
        })
      )

      callbacks?.onProgress?.(progress, current, total)
    }

    const handlePageProcessed = async (page: ProcessedPage) => {
      try {
        await ensureSheetDirectoryExists(organizationId, projectId, planId, page.pageNumber)

        const fullImagePath = getSheetFullImagePath(organizationId, projectId, planId, page.pageNumber)
        const thumbnailPath = getSheetThumbnailPath(organizationId, projectId, planId, page.pageNumber)

        const fullImageBase64 = page.fullImageDataUrl.split(',')[1]
        const thumbnailBase64 = page.thumbnailDataUrl.split(',')[1]

        await FileSystem.writeAsStringAsync(fullImagePath, fullImageBase64, {
          encoding: FileSystem.EncodingType.Base64,
        })

        await FileSystem.writeAsStringAsync(thumbnailPath, thumbnailBase64, {
          encoding: FileSystem.EncodingType.Base64,
        })

        const sheetId = `${planId}_sheet_${page.pageNumber}`

        processedPages.push({
          id: sheetId,
          number: String(page.pageNumber),
          title: `Sheet ${page.pageNumber}`,
          discipline: 'GENERAL',
          localImagePath: fullImagePath,
          localThumbnailPath: thumbnailPath,
          imagePath: undefined,
          width: page.width,
          height: page.height,
        })
      } catch (error) {
        console.error(`Error processing page ${page.pageNumber}:`, error)
        throw error
      }
    }

    const handleComplete = async () => {
      try {
        await store.dispatch(
          events.sheetsReceived({
            projectId,
            planId,
            sheets: processedPages,
          })
        )

        await store.dispatch(
          events.planProcessingCompleted({
            planId,
            sheetCount: processedPages.length,
            completedAt: new Date(),
          })
        )

        callbacks?.onComplete?.()
        resolve()
      } catch (error) {
        reject(error)
      }
    }

    const handleError = (error: Error) => {
      callbacks?.onError?.(error)
      reject(error)
    }

    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      import('@/components/pdf/pdf-processor').then((module) => {
        const PDFProcessor = module.default
        const React = require('react')
        const ReactDOM = require('react-dom/client')

        const container = document.createElement('div')
        document.body.appendChild(container)

        const root = ReactDOM.createRoot(container)
        root.render(
          React.createElement(PDFProcessor, {
            pdfData,
            onProgress: handleProgress,
            onPageProcessed: handlePageProcessed,
            onComplete: handleComplete,
            onError: handleError,
          })
        )
      }).catch(reject)
    } else {
      reject(new Error('Browser environment not available for PDF processing'))
    }
  })
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return bytes.buffer
}
