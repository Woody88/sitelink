import { fetch } from 'expo/fetch'
import { File } from 'expo-file-system/next'

const BACKEND_URL = process.env.EXPO_PUBLIC_BETTER_AUTH_URL

if (!BACKEND_URL) {
  throw new Error('EXPO_PUBLIC_BETTER_AUTH_URL is not defined')
}

export interface UploadPlanToBackendOptions {
  fileUri: string
  fileName: string
  projectId: string
  organizationId: string
  sessionToken: string
}

export interface UploadPlanResponse {
  success: boolean
  planId: string
  message?: string
}

export async function uploadPlanToBackend(
  options: UploadPlanToBackendOptions
): Promise<UploadPlanResponse> {
  const { fileUri, fileName, projectId, organizationId, sessionToken } = options

  console.log('[UPLOAD-API] Starting upload:', {
    fileUri: fileUri?.substring(0, 80),
    fileName,
    projectId,
    organizationId,
    hasToken: !!sessionToken,
  })

  const file = new File(fileUri)
  const formData = new FormData()
  formData.append('file', file as unknown as Blob, fileName)
  formData.append('fileName', fileName)
  formData.append('projectId', projectId)
  formData.append('organizationId', organizationId)

  const response = await fetch(`${BACKEND_URL}/api/plans/upload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${sessionToken}`,
    },
    body: formData,
  })

  console.log('[UPLOAD-API] Response status:', response.status)

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Upload failed: ${response.status} ${response.statusText} - ${errorText}`)
  }

  return await response.json()
}
