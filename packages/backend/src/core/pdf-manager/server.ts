import { S3Client } from "bun"
import {
	executePlanTileGeneration,
	generateTilesStream,
	type TileGeneratorData,
} from "./tile-processor"


interface SheetDataHeaders {
	sheetKey: string,
	sheetNumber: string,
	sheetTotalCount: number,
	uploadId: string,
	organizationId: string,
	projectId: string,
	planId: string
}

const credentials = {
	endpoint: process.env.R2_ENDPOINT,
	accessKeyId: process.env.R2_ACCESS_KEY_ID,
	secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
	bucket: process.env.R2_BUCKET,
}

async function checkR2Connection() {
	try {
	await S3Client.list({ maxKeys: 1 }, credentials)

		return true
	} catch (error) {
		console.error("R2 connection check failed:", error)
		return false
	}
}

checkR2Connection()
	.then(() => console.log("Successfully connected to R2!"))
	.catch(() => {
		console.log("connection failed!")
		process.exit(1)
	})

const server = Bun.serve({
	port: 3000,
	routes: {
		"/health": () => Response.json({ health: "ok" }),
		"/generate-tiles": {
			POST: async (req) => {
				const headers = req.headers
				const sheetHeaders = {
					sheetKey: headers.get("X-Sheet-Key") || '',
					sheetNumber: headers.get("X-Sheet-Number") || '',
					sheetTotalCount: Number.parseInt(headers.get("X-Sheet-Total-Count") || '0'),
					uploadId: headers.get("X-Upload-Id") || '',
					organizationId: headers.get("X-Organization-Id") || '',
					projectId: headers.get("X-Project-Id") || '',
					planId: headers.get("X-Plan-Id") || ''
				} satisfies SheetDataHeaders
				

				const sheetId = `sheet-${sheetHeaders.sheetNumber}`
				const sheetPdfFilePath = `/tmp/${sheetHeaders.uploadId}/${sheetId}.pdf`

				const fileStream = new Response(req.body, { headers: { 'Content-Type': headers.get('Content-Type') || ''}})
				await Bun.write(sheetPdfFilePath, fileStream,  { createPath: true } )

				const tilesTarFilename = `${sheetHeaders.organizationId}_${sheetHeaders.projectId}_${sheetHeaders.planId}_${sheetHeaders.uploadId}_${sheetId}.tar`
				const tiles = await generateTilesStream(sheetPdfFilePath, sheetId, sheetHeaders.uploadId)

				return Response.json(tiles, { headers: { 
					'Content-Type': 'application/x-tar',
          'Content-Disposition': `attachment; filename="${tilesTarFilename}"`
				}})
			}
		},
		"/processPdf": {
			POST: async (req: Bun.BunRequest) => {
				try {
					const data = (await req.json()) as {
						pdfPath: string
						organizationId: string
						projectId: string
						planId: string
						uploadId: string
					}

					console.log("Received PDF processing request:", {
						pdfPath: data.pdfPath,
						uploadId: data.uploadId,
						planId: data.planId,
					})

					const s3Client = new S3Client(credentials)

					// Empty callback - all uploading is handled by tile-processor
					const uploadCallback: TileGeneratorData["uploadCallback"] = async (
						path: string,
						orgId: string,
						projectId: string,
						planId: string,
						sheetId: string,
					) => {
						// No-op: R2 upload is handled in tile-processor
						console.log(`Completed processing for ${sheetId}`)
						return await Promise.resolve(void 0)
					}

					const totalPages = await executePlanTileGeneration({
						pdfPath: data.pdfPath,
						organizationId: data.organizationId,
						projectId: data.projectId,
						planId: data.planId,
						uploadId: data.uploadId,
						uploadCallback,
						s3Client,
						tempOutputCleanup: true, // Always cleanup in containers
					})

					console.log(
						`Successfully processed ${totalPages} pages for plan ${data.planId}`,
					)

					return Response.json({
						success: true,
						totalPages,
						uploadId: data.uploadId,
						planId: data.planId,
					})
				} catch (error) {
					console.error("PDF processing failed:", error)
					return Response.json(
						{
							success: false,
							error: error instanceof Error ? error.message : String(error),
						},
						{ status: 500 },
					)
				}
			},
		},
	},
})

console.log(`Server running at ${server.url}`)
