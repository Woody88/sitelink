#!/usr/bin/env bun
import { S3Client } from "bun"

const credentials = {
	endpoint: process.env.R2_ENDPOINT,
	accessKeyId: process.env.R2_ACCESS_KEY_ID,
	secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
	bucket: process.env.R2_BUCKET,
}

const ORG_ID = "4ff0ff39-1180-4fb5-b3f1-e087118b9f21"
const PROJECT_ID = "daf5713b-7132-4880-bab0-868d8293f070"
const PLAN_ID = "582c321e-94f9-42a7-a6e4-09ec8ee81c7c"
const SHEET_ID = "sheet-1"

const basePath = `organizations/${ORG_ID}/projects/${PROJECT_ID}/plans/${PLAN_ID}/sheets/${SHEET_ID}/tiles`

// Presign the DZI file
const dziPath = `${basePath}/${SHEET_ID}.dzi`
const dziUrl = S3Client.presign(dziPath, {
	...credentials,
	expiresIn: 3600, // 1 hour
	method: "GET",
})

console.log("🗺️ Presigned URLs for OpenSeadragon:\n")
console.log("DZI File URL:")
console.log(dziUrl)
console.log("\n")
console.log("Example Tile URL (0/0_0.jpeg):")
const tilePath = `${basePath}/${SHEET_ID}_files/0/0_0.jpeg`
const tileUrl = S3Client.presign(tilePath, {
	...credentials,
	expiresIn: 3600,
	method: "GET",
})
console.log(tileUrl)
console.log("\n")
console.log("⚠️ Note: These URLs expire in 1 hour")
console.log("💡 For production, you'll need a Worker endpoint to serve authenticated tiles")
