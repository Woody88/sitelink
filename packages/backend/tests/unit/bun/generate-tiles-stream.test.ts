import { describe, expect, it, beforeEach, afterEach } from "bun:test"
import { PDFDocument } from "pdf-lib"
import { extract } from "tar-stream"
import { Readable } from "node:stream"
import path from "node:path"
import fs from "node:fs/promises"
import { generateTilesStream } from "../../../src/core/pdf-manager/tile-processor"

// Helper to load sample PDF (replicated from helpers/fixtures.ts for bun:test)
async function loadSamplePDF(): Promise<Uint8Array> {
	const fixturePath = path.join(__dirname, "../../fixtures/sample-plan-2.pdf")
	const file = Bun.file(fixturePath)
	return new Uint8Array(await file.arrayBuffer())
}

describe("generateTilesStream", () => {
	const testUploadId = crypto.randomUUID()
	const sheetNumber = "1"
	const sheetId = `sheet-${sheetNumber}` // Matches server.ts line 62
	const fixturesBase = path.join(__dirname, "../../fixtures/tmp")
	const pdfPath = path.join(fixturesBase, testUploadId, `${sheetId}.pdf`) // Matches server.ts line 63 format
	const vipsTmpDir = `/tmp/uploads/${testUploadId}`

	beforeEach(async () => {
		// 1. Load sample PDF
		const samplePdf = await loadSamplePDF()

		// 2. Extract first page using pdf-lib
		const pdfDoc = await PDFDocument.load(samplePdf)
		const singlePageDoc = await PDFDocument.create()
		const [firstPage] = await singlePageDoc.copyPages(pdfDoc, [0])
		singlePageDoc.addPage(firstPage)
		const singlePageBytes = await singlePageDoc.save()

		// 3. Save to fixtures/tmp/${uploadId}/${sheetId}.pdf
		await Bun.write(pdfPath, singlePageBytes, { createPath: true })

		// 4. Create /tmp/uploads/${uploadId}/ directory for vips processing
		await fs.mkdir(vipsTmpDir, { recursive: true })
	})

	afterEach(async () => {
		// Cleanup: Remove both fixtures and vips temp directories
		await fs.rm(path.join(fixturesBase, testUploadId), {
			recursive: true,
			force: true,
		})
		await fs.rm(vipsTmpDir, {
			recursive: true,
			force: true,
		})
	})

	it("should generate DZI tiles from PDF and return tar stream", async () => {
		// Call function exactly as server.ts does
		const stream = await generateTilesStream(pdfPath, sheetId, testUploadId)

		// Convert ReadableStream to Node.js Readable for tar-stream
		const nodeStream = Readable.fromWeb(stream as any)
		const extractor = extract()

		// Collect all files from tar
		const files = new Map<string, Buffer>()

		extractor.on("entry", (header, entryStream, next) => {
			const chunks: Buffer[] = []
			entryStream.on("data", (chunk: Buffer) => chunks.push(chunk))
			entryStream.on("end", () => {
				files.set(header.name, Buffer.concat(chunks))
				next()
			})
			entryStream.resume()
		})

		// Wait for extraction to complete
		await new Promise<void>((resolve, reject) => {
			nodeStream.pipe(extractor)
			extractor.on("finish", () => resolve())
			extractor.on("error", reject)
		})

		// Verify tar contents
		const fileNames = Array.from(files.keys())
		console.log(fileNames)

		// 1. Check for .dzi file
		const dziFiles = fileNames.filter((name) => name.endsWith(".dzi"))
		expect(dziFiles).toHaveLength(1)

		// 2. Verify DZI XML structure
		const dziContent = files.get(dziFiles[0])!.toString("utf-8")
		expect(dziContent).toContain('<?xml version="1.0"')
		expect(dziContent).toContain("<Image")
		expect(dziContent).toContain('Format="jpg"') // vips uses "jpg" not "jpeg"
		expect(dziContent).toContain('TileSize="254"')
		expect(dziContent).toContain('Overlap="1"')

		// 3. Check for .jpg tile files
		const jpgFiles = fileNames.filter((name) => name.endsWith(".jpg"))
		expect(jpgFiles.length).toBeGreaterThan(0)

		// 4. Verify JPEG magic number for at least one tile
		const firstJpg = files.get(jpgFiles[0])!
		expect(firstJpg[0]).toBe(0xff)
		expect(firstJpg[1]).toBe(0xd8)
	})
})
