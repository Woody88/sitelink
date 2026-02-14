export interface ImageGenerationJob {
  planId: string
  projectId: string
  organizationId: string
  pdfPath: string // R2 path to original PDF
  totalPages: number
  planName: string // Original PDF filename without extension (e.g., "sample-plan")
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
  sheetNumber?: string // Sheet number of current sheet (e.g., "A1")
  validSheetNumbers: string[] // Valid sheet numbers for callout matching (e.g., ["A1", "A2", "S1"])
}

export interface TileGenerationJob {
  planId: string
  projectId: string
  organizationId: string
  sheetId: string
}

export interface DocLayoutDetectionJob {
  planId: string
  projectId: string
  organizationId: string
  sheetId: string
  sheetNumber?: string
}

export type ProcessingJob =
  | { type: "image_generation"; data: ImageGenerationJob }
  | { type: "metadata_extraction"; data: MetadataExtractionJob }
  | { type: "callout_detection"; data: CalloutDetectionJob }
  | { type: "doc_layout_detection"; data: DocLayoutDetectionJob }
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
