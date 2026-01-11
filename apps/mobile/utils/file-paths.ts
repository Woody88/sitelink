// apps/mobile/utils/file-paths.ts
import * as FileSystem from 'expo-file-system/legacy'

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
 * Structure: storage/sitelink/{organizationId}/{projectId}/plans/{planId}/
 */
export function getPlanUploadPath(
  organizationId: string,
  projectId: string,
  planId: string
): string {
  return `${BASE_STORAGE_PATH}/${organizationId}/${projectId}/plans/${planId}`
}

/**
 * Get the path for the plan source PDF
 */
export function getPlanSourcePath(
  organizationId: string,
  projectId: string,
  planId: string
): string {
  return `${getPlanUploadPath(organizationId, projectId, planId)}/source.pdf`
}

/**
 * Get the storage path for sheets extracted from a plan
 * Structure: storage/sitelink/{organizationId}/{projectId}/plans/{planId}/sheets/
 */
export function getPlanSheetsPath(
  organizationId: string,
  projectId: string,
  planId: string
): string {
  return `${getPlanUploadPath(organizationId, projectId, planId)}/sheets`
}

/**
 * Get the path for a specific sheet directory
 */
export function getSheetPath(
  organizationId: string,
  projectId: string,
  planId: string,
  pageNumber: number
): string {
  const paddedNumber = String(pageNumber).padStart(3, '0')
  return `${getPlanSheetsPath(organizationId, projectId, planId)}/${paddedNumber}`
}

/**
 * Get the full resolution image path for a sheet
 */
export function getSheetFullImagePath(
  organizationId: string,
  projectId: string,
  planId: string,
  pageNumber: number
): string {
  return `${getSheetPath(organizationId, projectId, planId, pageNumber)}/full.png`
}

/**
 * Get the thumbnail image path for a sheet
 */
export function getSheetThumbnailPath(
  organizationId: string,
  projectId: string,
  planId: string,
  pageNumber: number
): string {
  return `${getSheetPath(organizationId, projectId, planId, pageNumber)}/thumb.png`
}

/**
 * Get the single-page PDF path for a sheet
 */
export function getSheetPdfPath(
  organizationId: string,
  projectId: string,
  planId: string,
  pageNumber: number
): string {
  return `${getSheetPath(organizationId, projectId, planId, pageNumber)}/source.pdf`
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
  planId: string
): Promise<string> {
  const uploadPath = getPlanUploadPath(organizationId, projectId, planId)
  await ensureDirectoryExists(uploadPath)
  return uploadPath
}

/**
 * Ensure sheet directory exists
 */
export async function ensureSheetDirectoryExists(
  organizationId: string,
  projectId: string,
  planId: string,
  pageNumber: number
): Promise<string> {
  const sheetPath = getSheetPath(organizationId, projectId, planId, pageNumber)
  await ensureDirectoryExists(sheetPath)
  return sheetPath
}
