import Bun, { $ } from "bun"
import fs from "fs/promises"
import { PDFDocument } from "pdf-lib"
import sharp from "sharp"

async function startProcessing() {
	console.info("Starting tile processing...")

	const pdfBuffer = await Bun.file(
		`${import.meta.dir}/../assets/sample-construction-plan-set.pdf`,
	)
	console.dir(await pdfBuffer.stat())

	const pdfArrayBuffer = await pdfBuffer.arrayBuffer()
	const pdfDoc = await PDFDocument.load(pdfArrayBuffer)

	const totalPages = pdfDoc.getPageCount()

	// extractPdfPages(pdfDoc)
	//await pdfToImageBuffer(totalPages)
	await generateAndStreamTiles(1)
	console.log(`Total pages in PDF: ${totalPages}`)
}

function extractPdfPages(pdfDoc: PDFDocument) {
	const organizationId = "1"
	const projectId = "building-1"
	const rootDir = `${import.meta.dir}/../assets/organizations/${organizationId}/projects/${projectId}/sheets`

	pdfDoc.getPages().forEach(async (page, index) => {
		const pageNumber = index + 1
		const sheetId = `sheet-${pageNumber}`
		const sheetDir = `${rootDir}/${sheetId}/source`
		const pdfPath = `${rootDir}/${sheetId}/source/${sheetId}.pdf`

		console.info(`Creating temporary single page PDF for page ${pageNumber}...`)
		const singlePageDoc = await PDFDocument.create()
		const [pageCopy] = await singlePageDoc.copyPages(pdfDoc, [index])
		singlePageDoc.addPage(pageCopy)
		const pdfFile = await singlePageDoc.save()

		console.info(`Writing PDF page ${pageNumber} to ${pdfPath}...`)
		await fs.mkdir(sheetDir, { recursive: true })
		await Bun.write(pdfPath, pdfFile)
	})
}

async function processPDF() {}

async function pdfToImageBuffer(pageCount: number) {
	const organizationId = "1"
	const projectId = "building-1"
	const rootDir = `${import.meta.dir}/../assets/organizations/${organizationId}/projects/${projectId}/sheets`

	for (let pageNumber = 1; pageNumber <= pageCount; pageNumber++) {
		const sheetId = `sheet-${pageNumber}`
		const pdfPath = `${rootDir}/${sheetId}/source/${sheetId}.pdf`
		const imageDir = `${rootDir}/${sheetId}/source`
		const imagePath = `${imageDir}/${sheetId}`
		try {
			console.info(`Converting PDF page ${pageNumber} to image...`)
			await $`pdftoppm -progress -singlefile -png -r 300 ${pdfPath} ${imagePath}`.quiet()

			// const imageBuffer = await Bun.file(tempImagePath).arrayBuffer()
			// return imageBuffer
		} catch (e) {
			console.error(e)
		}
	}
}

async function generateAndStreamTiles(pageCount: number) {
	const organizationId = "1"
	const projectId = "building-1"
	const rootDir = `${import.meta.dir}/../assets/organizations/${organizationId}/projects/${projectId}/sheets`

	for (let pageNumber = 1; pageNumber <= pageCount; pageNumber++) {
		const sheetId = `sheet-${pageNumber}`
		const imagePath = `${rootDir}/${sheetId}/source/${sheetId}.png`
		const tilesDir = `${rootDir}/${sheetId}/tiles`
		const dziPath = `${tilesDir}/${sheetId}.dzi`

		console.info(`Generating tiles for sheet ${pageNumber}...`)

		// Ensure tiles directory exists
		await fs.mkdir(tilesDir, { recursive: true })

		// Generate DZI tiles
		await sharp(imagePath)
			.tile({
				layout: "dz", // Deep Zoom format
				size: 256, // Tile size
				overlap: 1, // 1px overlap for smoother rendering
				basename: sheetId, // Base name for the _files directory
			})
			.toFile(dziPath)

		console.info(
			`Generated tiles at ${dziPath} and ${tilesDir}/${sheetId}_files/`,
		)
	}
}

startProcessing().catch((error) => console.error(error))
