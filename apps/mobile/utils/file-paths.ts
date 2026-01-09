// apps/mobile/utils/file-paths.ts
import * as FileSystem from 'expo-file-system'

const BASE_STORAGE_PATH = `${FileSystem.documentDirectory}storage/sitelink`

/**
 * Get the base storage path for SiteLink
 */
export function getBaseStoragePath(): string {
  return BASE_STORAGE_PATH
}

/**
 * Get the storage path for a specific organization
 */
export function getOrganizationPath(organizationId: string): string {
  return `${BASE_STORAGE_PATH}/${organizationId}`
}

/**
 * Get the storage path for a specific project
 */
export function getProjectPath(organizationId: string, projectId: string): string {
  return `${BASE_STORAGE_PATH}/${organizationId}/${projectId}`
}

/**
 * Get the storage path for plan uploads
 * Structure: storage/sitelink/{organizationId}/{projectId}/plan/{uploadId}/
 */
export function getPlanUploadPath(organizationId: string, projectId: string, uploadId: string): string {
  return `${BASE_STORAGE_PATH}/${organizationId}/${projectId}/plan/${uploadId}`
}

/**
 * Get the storage path for media files (photos, voice recordings)
 * Structure: storage/sitelink/{organizationId}/{projectId}/media/
 */
export function getMediaPath(organizationId: string, projectId: string): string {
  return `${BASE_STORAGE_PATH}/${organizationId}/${projectId}/media`
}

/**
 * Ensure a directory exists, creating it if necessary
 */
export async function ensureDirectoryExists(path: string): Promise<void> {
  const dirInfo = await FileSystem.getInfoAsync(path)
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(path, { intermediates: true })
  }
}

/**
 * Ensure all required directories exist for a project
 */
export async function ensureProjectDirectoriesExist(
  organizationId: string,
  projectId: string
): Promise<{
  projectPath: string
  mediaPath: string
}> {
  const projectPath = getProjectPath(organizationId, projectId)
  const mediaPath = getMediaPath(organizationId, projectId)

  await ensureDirectoryExists(projectPath)
  await ensureDirectoryExists(mediaPath)

  return { projectPath, mediaPath }
}

/**
 * Ensure plan upload directory exists
 */
export async function ensurePlanUploadDirectoryExists(
  organizationId: string,
  projectId: string,
  uploadId: string
): Promise<string> {
  const uploadPath = getPlanUploadPath(organizationId, projectId, uploadId)
  await ensureDirectoryExists(uploadPath)
  return uploadPath
}

