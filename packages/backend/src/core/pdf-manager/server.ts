import { S3Client } from "bun"

async function checkR2Connection() {
	try {
		const credentials = {
			endpoint: process.env.R2_ENDPOINT,
			accessKeyId: process.env.R2_ACCESS_KEY_ID,
			secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
			bucket: process.env.R2_BUCKET,
		}

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
		"/processPdf": (req: Bun.BunRequest) => {
			console.log("[DEBUG]: ", req.headers)
			return Response.json("processingPdf...")
		},
	},
})

console.log(`Server running at ${server.url}`)
