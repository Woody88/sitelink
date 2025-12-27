import fs from "node:fs/promises"
import { $, Glob, S3Client } from "bun"
import { PDFDocument } from "pdf-lib"
import { pack } from 'tar-stream'
import { Writable } from 'stream'
import { Readable } from "node:stream"

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
	s3Client?: S3Client
}

/**
 * Recursively upload a directory to R2 using Bun's S3Client
 * @param client S3Client instance with R2 credentials
 * @param localDir Local directory path to upload
 * @param r2BasePath Base path in R2 bucket
 * @returns Upload metrics (file count and total bytes)
 */
async function uploadDirectoryToR2(
	client: S3Client,
	localDir: string,
	r2BasePath: string,
): Promise<{ fileCount: number; totalBytes: number }> {
	let fileCount = 0
	let totalBytes = 0

	async function uploadDir(currentLocalPath: string, currentR2Path: string) {
		const entries = await fs.readdir(currentLocalPath, { withFileTypes: true })

		for (const entry of entries) {
			const localPath = `${currentLocalPath}/${entry.name}`
			const r2Path = `${currentR2Path}/${entry.name}`

			if (entry.isDirectory()) {
				// Recursively upload subdirectories
				await uploadDir(localPath, r2Path)
			} else if (entry.isFile()) {
				// Upload file
				const fileData = await Bun.file(localPath).arrayBuffer()
				const fileSize = fileData.byteLength

				// Infer content type from file extension
				let contentType = "application/octet-stream"
				if (entry.name.endsWith(".jpeg") || entry.name.endsWith(".jpg")) {
					contentType = "image/jpeg"
				} else if (entry.name.endsWith(".dzi")) {
					contentType = "application/xml"
				}

				await client.write(r2Path, fileData, { type: contentType })

				fileCount++
				totalBytes += fileSize

				console.info(`Uploaded: ${r2Path} (${fileSize} bytes)`)
			}
		}
	}

	await uploadDir(localDir, r2BasePath)

	console.info(`Upload complete: ${fileCount} files, ${totalBytes} bytes total`)

	return { fileCount, totalBytes }
}

export async function executePlanTileGeneration({
	pdfPath,
	organizationId,
	projectId,
	planId,
	uploadId,
	uploadCallback,
	tempOutputDir,
	tempOutputCleanup = true,
	s3Client,
}: TileGeneratorData) {
	console.info("Starting tile processing...")

	// 1. Download PDF from R2 if using s3Client, otherwise use local path
	let localPdfPath = pdfPath
	let downloadedPdf = false

	if (s3Client) {
		console.info(`Downloading PDF from R2: ${pdfPath}`)
		const pdfBuffer = await s3Client.file(pdfPath).arrayBuffer()

		// Save to temp location for vips processing
		localPdfPath = `/tmp/${uploadId}/original.pdf`
		await fs.mkdir(`/tmp/${uploadId}`, { recursive: true })
		await Bun.write(localPdfPath, pdfBuffer)
		downloadedPdf = true

		console.info(`PDF downloaded to: ${localPdfPath}`)
	}

	// 2. Load PDF to get page count
	const pdfBuffer = await Bun.file(localPdfPath).arrayBuffer()
	const pdfDoc = await PDFDocument.load(pdfBuffer)
	const totalPages = pdfDoc.getPageCount()

	console.info(`Processing ${totalPages} pages from ${localPdfPath}`)

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
		await $`vips dzsave ${localPdfPath}[page=${pageNum},dpi=150] ${dziPath} --tile-size 254 --overlap 1 --depth onetile --suffix .jpg[Q=85]`

		// 4. Upload to R2 if s3Client is provided
		if (s3Client) {
			const r2BasePath = `organizations/${organizationId}/projects/${projectId}/plans/${planId}/sheets/${sheetId}/tiles`

			try {
				console.info(`Uploading ${sheetId} to R2...`)

				// Upload .dzi file
				const dziFilePath = `${tmpOutputDir}/${sheetId}.dzi`
				const dziData = await Bun.file(dziFilePath).arrayBuffer()
				await s3Client.write(`${r2BasePath}/${sheetId}.dzi`, dziData, {
					type: "application/xml",
				})

				// Upload tiles directory
				const tilesDir = `${tmpOutputDir}/${sheetId}_files`
				const { fileCount, totalBytes } = await uploadDirectoryToR2(
					s3Client,
					tilesDir,
					`${r2BasePath}/${sheetId}_files`,
				)

				console.info(
					`Successfully uploaded ${sheetId}: ${fileCount} tiles (${totalBytes} bytes)`,
				)
			} catch (error) {
				console.error(`Failed to upload ${sheetId} to R2:`, error)
				throw new Error(
					`R2 upload failed for ${sheetId}: ${error instanceof Error ? error.message : String(error)}`,
				)
			}
		}

		// 5. Call the upload callback (for any additional processing)
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

	// Cleanup downloaded PDF if we created it
	if (downloadedPdf && tempOutputCleanup) {
		console.info("Cleaning up downloaded PDF...")
		await fs.rm(`/tmp/${uploadId}`, { recursive: true, force: true })
	}

	console.info("Tile processing complete")

	return totalPages
}



export async function generateTilesStream(pdfPath: string, sheetId: string, uploadId: string) {
	const OUTPUT_DIR = `/tmp/uploads/${uploadId}`
	const OUTPUT_PREFIX = `${OUTPUT_DIR}/sheet-${sheetId}`

	// 0. Create output directory
	await $`mkdir -p ${OUTPUT_DIR}`

	// 1. run vips - creates OUTPUT_PREFIX.dzi and OUTPUT_PREFIX_files/
	await $`vips dzsave ${pdfPath}[page=0,dpi=150] ${OUTPUT_PREFIX} --tile-size 254 --overlap 1 --depth onetile --suffix .jpg[Q=85]`

	// 2. stream the entire output directory (includes both .dzi and _files/)
	return streamTilesDirectory(OUTPUT_DIR)
}

async function streamTilesDirectory(tilesDir: string): Promise<ReadableStream<Uint8Array>>{
	// 1. Get all files path using glob
	const glob = new Glob(`**/*`)
	const packer = pack()

	// 2. Manually create Web ReadableStream from Node.js Readable
	const webStream = new ReadableStream<Uint8Array>({
		async start(controller) {
			// Start reading from packer
			packer.on('data', (chunk: Buffer) => {
				controller.enqueue(new Uint8Array(chunk))
			})

			packer.on('end', () => {
				controller.close()
			})

			packer.on('error', (error) => {
				controller.error(error)
			})

			// Add files to packer
			try {
				for await (const filepath of glob.scan(tilesDir)) {
					const fullPath = `${tilesDir}/${filepath}`
					const file = Bun.file(fullPath)

					// Skip directories
					if ((await file.exists()) && file.size > 0) {
						const stream = file.stream()

						const entry = Writable.toWeb(packer.entry({
							name: filepath,
							type: 'file',
							size: file.size
						}))

						await stream.pipeTo(entry)
					}
				}
				packer.finalize() // Signal that no more entries will be added
			} catch (error) {
				packer.destroy(error as Error)
			}
		}
	})

	return webStream
}
