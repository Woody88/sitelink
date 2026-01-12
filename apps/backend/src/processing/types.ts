export interface ImageGenerationJob {
  planId: string
  projectId: string
  organizationId: string
  pdfPath: string // R2 path to original PDF
  totalPages: number
}

export interface MetadataExtractionJob {
  planId: string
  projectId: string
  organizationId: string
  sheetId: string
  sheetNumber: number
  totalSheets: number
}

export interface CalloutDetectionJob {
  planId: string
  projectId: string
  organizationId: string
  sheetId: string
  validSheets: string[] // For validating callout targets
}

export interface TileGenerationJob {
  planId: string
  projectId: string
  organizationId: string
  sheetId: string
}

export type ProcessingJob =
  | { type: "image_generation"; data: ImageGenerationJob }
  | { type: "metadata_extraction"; data: MetadataExtractionJob }
  | { type: "callout_detection"; data: CalloutDetectionJob }
  | { type: "tile_generation"; data: TileGenerationJob }

export function getR2Path(
  organizationId: string,
  projectId: string,
  planId: string,
  sheetId?: string,
  filename?: string,
): string {
  const basePath = `organizations/${organizationId}/projects/${projectId}/plans/${planId}`
  if (!sheetId) return basePath
  const sheetPath = `${basePath}/sheets/${sheetId}`
  if (!filename) return sheetPath
  return `${sheetPath}/${filename}`
}
