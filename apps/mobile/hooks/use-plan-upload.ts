import { useState, useCallback } from 'react'
import { useStore } from '@livestore/react'
import { nanoid } from '@livestore/livestore'
import * as DocumentPicker from 'expo-document-picker'
import { uploadAndProcessPlan } from '@/services/plan-upload-service'

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
  const store = useStore()
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null)

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

      await uploadAndProcessPlan(
        store,
        {
          planId,
          projectId,
          organizationId,
          fileName: file.name,
          fileSize: file.size || 0,
          mimeType: file.mimeType || 'application/pdf',
          sourceUri: file.uri,
          uploadedBy,
        },
        {
          onProgress: (progress, current, total) => {
            setUploadProgress({
              planId,
              progress,
              currentPage: current,
              totalPages: total,
              status: 'processing',
            })
          },
          onComplete: () => {
            setUploadProgress({
              planId,
              progress: 100,
              currentPage: 0,
              totalPages: 0,
              status: 'complete',
            })

            setTimeout(() => {
              setUploadProgress(null)
            }, 2000)
          },
          onError: (error) => {
            setUploadProgress({
              planId,
              progress: 0,
              currentPage: 0,
              totalPages: 0,
              status: 'error',
              error,
            })
          },
        }
      )

      return planId
    } catch (error) {
      console.error('Error picking/uploading plan:', error)
      setUploadProgress({
        planId: '',
        progress: 0,
        currentPage: 0,
        totalPages: 0,
        status: 'error',
        error: error instanceof Error ? error : new Error(String(error)),
      })
      throw error
    }
  }, [store, projectId, organizationId, uploadedBy])

  const resetProgress = useCallback(() => {
    setUploadProgress(null)
  }, [])

  return {
    pickAndUploadPlan,
    uploadProgress,
    resetProgress,
    isUploading: uploadProgress?.status === 'uploading' || uploadProgress?.status === 'processing',
  }
}
