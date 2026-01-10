import { useState, useCallback, useMemo, createElement } from 'react'
import { useStore } from '@livestore/react'
import { nanoid } from '@livestore/livestore'
import * as DocumentPicker from 'expo-document-picker'
import { uploadPlan, saveProcessedSheet } from '@/services/plan-upload-service'
import { authClient } from '@/lib/auth'
import { createAppStoreOptions } from '@/lib/store-config'
import { events } from '@sitelink/domain'
import PDFProcessor from '@/components/pdf/pdf-processor'

export interface UsePlanUploadOptions {
  projectId: string
  organizationId: string
  uploadedBy: string
}

export interface UploadProgress {
  planId: string
  progress: number
  currentPage: number
  totalPages: number
  status: 'idle' | 'uploading' | 'processing' | 'complete' | 'error'
  error?: Error
}

export function usePlanUpload({ projectId, organizationId, uploadedBy }: UsePlanUploadOptions) {
  const { data } = authClient.useSession()
  const sessionToken = data?.session?.token

  const storeOptions = useMemo(
    () => createAppStoreOptions(sessionToken),
    [sessionToken]
  )

  const store = useStore(storeOptions)
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null)
  const [pdfToProcess, setPdfToProcess] = useState<{ planId: string; data: string } | null>(null)

  const pickAndUploadPlan = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf'],
        copyToCacheDirectory: true,
        multiple: false,
      })

      if (result.canceled) {
        return null
      }

      const file = result.assets[0]
      const planId = nanoid()

      setUploadProgress({
        planId,
        progress: 0,
        currentPage: 0,
        totalPages: 0,
        status: 'uploading',
      })

      const { pdfDataBase64 } = await uploadPlan(store, {
        planId,
        projectId,
        organizationId,
        fileName: file.name,
        fileSize: file.size || 0,
        mimeType: file.mimeType || 'application/pdf',
        sourceUri: file.uri,
        uploadedBy,
      })

      setPdfToProcess({ planId, data: pdfDataBase64 })
      
      setUploadProgress(prev => prev ? {
        ...prev,
        status: 'processing',
      } : null)

      return planId
    } catch (error) {
      console.error('Error picking/uploading plan:', error)
      const err = error instanceof Error ? error : new Error(String(error))
      setUploadProgress({
        planId: '',
        progress: 0,
        currentPage: 0,
        totalPages: 0,
        status: 'error',
        error: err,
      })
      throw err
    }
  }, [store, projectId, organizationId, uploadedBy])

  const handlePageProcessed = useCallback(async (page: any) => {
    if (!pdfToProcess) return

    try {
      const sheet = await saveProcessedSheet(
        organizationId,
        projectId,
        pdfToProcess.planId,
        page
      )

      // Use store.commit directly here
      await store.commit(
        events.sheetsReceived({
          projectId,
          planId: pdfToProcess.planId,
          sheets: [sheet],
        })
      )
    } catch (error) {
      console.error('[UPLOAD] Error saving sheet:', error)
    }
  }, [pdfToProcess, organizationId, projectId, store])

  const handleComplete = useCallback(async (pages: any[]) => {
    if (!pdfToProcess) return

    try {
      await store.commit(
        events.planProcessingCompleted({
          planId: pdfToProcess.planId,
          sheetCount: pages.length,
          completedAt: new Date(),
        })
      )

      setUploadProgress(prev => prev ? {
        ...prev,
        progress: 100,
        status: 'complete',
      } : null)

      setTimeout(() => {
        setUploadProgress(null)
        setPdfToProcess(null)
      }, 2000)
    } catch (error) {
      console.error('[UPLOAD] Error completing plan:', error)
    }
  }, [pdfToProcess, store])

  const handleError = useCallback((error: Error) => {
    setUploadProgress(prev => prev ? {
      ...prev,
      status: 'error',
      error,
    } : null)
    setPdfToProcess(null)
  }, [])

  const handleProgress = useCallback((current: number, total: number) => {
    const progress = Math.round((current / total) * 100)
    setUploadProgress(prev => prev ? {
      ...prev,
      progress,
      currentPage: current,
      totalPages: total,
    } : null)

    if (pdfToProcess) {
      store.commit(
        events.planProcessingProgress({
          planId: pdfToProcess.planId,
          progress,
          currentPage: current,
          totalPages: total,
        })
      )
    }
  }, [pdfToProcess, store])

  // Component to be rendered in the React tree to trigger the DOM processing
  const renderProcessor = useCallback(() => {
    if (!pdfToProcess) return null
    
    return createElement(PDFProcessor, {
      pdfDataBase64: pdfToProcess.data,
      onProgress: handleProgress,
      onPageProcessed: handlePageProcessed,
      onComplete: handleComplete,
      onError: handleError,
    })
  }, [pdfToProcess, handleProgress, handlePageProcessed, handleComplete, handleError])

  const resetProgress = useCallback(() => {
    setUploadProgress(null)
    setPdfToProcess(null)
  }, [])

  return {
    pickAndUploadPlan,
    uploadProgress,
    resetProgress,
    renderProcessor,
    isUploading: uploadProgress?.status === 'uploading' || uploadProgress?.status === 'processing',
  }
}
