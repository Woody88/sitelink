import { S3Client } from "bun"
import {
	executePlanTileGeneration,
	type TileGeneratorData,
} from "./tile-processor"

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
