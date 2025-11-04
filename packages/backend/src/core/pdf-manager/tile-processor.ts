import fs from "node:fs/promises"
import { $ } from "bun"
import { PDFDocument } from "pdf-lib"

export interface TileGeneratorData {
	pdfPath: string // Path to the actual PDF file to process
	organizationId: string
	projectId: string
	planId: string
	uploadId: string
	uploadCallback: (
		path: string,
		orgId: string,
		projectId: string,
		planId: string,
		sheetId: string,
	) => Promise<void>
	tempOutputDir?: string
	tempOutputCleanup?: boolean
}

declare function uploadDirectory(
	localDir: string,
	r2Path: string,
): Promise<void>

export async function executePlanTileGeneration({
	pdfPath,
	organizationId,
	projectId,
	planId,
	uploadId,
	uploadCallback,
	tempOutputDir,
	tempOutputCleanup = true,
}: TileGeneratorData) {
	console.info("Starting tile processing...")

	// 1. Load PDF to get page count
	const pdfBuffer = await Bun.file(pdfPath).arrayBuffer()
	const pdfDoc = await PDFDocument.load(pdfBuffer)
	const totalPages = pdfDoc.getPageCount()

	console.info(`Processing ${totalPages} pages from ${pdfPath}`)

	// 2. Process each page sequentially
	for (let pageNum = 0; pageNum < totalPages; pageNum++) {
		const pageNumber = pageNum + 1 // 1-indexed for display
		const sheetId = `sheet-${pageNumber}`

		console.info(`Processing page ${pageNumber}/${totalPages}`)

		// Create temp directory for this page's tiles

		const tmpOutputDir = tempOutputDir
			? tempOutputDir
			: `/tmp/${uploadId}/${sheetId}`

		await fs.mkdir(tmpOutputDir, { recursive: true })

		const dziPath = `${tmpOutputDir}/${sheetId}`

		// 3. Generate tiles with vips (0-indexed page parameter)
		await $`vips dzsave ${pdfPath}[page=${pageNum},dpi=300] ${dziPath} --tile-size 256 --overlap 1`

		// const r2BasePath = `organizations/${organizationId}/projects/${projectId}/plans/${planId}/sheets/${sheetId}/tiles`

		// Upload the entire directory (includes .dzi file and _files/ directory)
		await uploadCallback(
			tmpOutputDir,
			organizationId,
			projectId,
			planId,
			sheetId,
		)

		if (tempOutputCleanup) {
			// 5. Cleanup temp files for this page
			await fs.rm(tmpOutputDir, { recursive: true })
		}

		console.info(`Completed page ${pageNumber}/${totalPages}`)
	}

	console.info("Tile processing complete")

	return totalPages
}
