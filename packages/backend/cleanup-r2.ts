#!/usr/bin/env bun
import { S3Client } from "bun"

const credentials = {
	endpoint: process.env.R2_ENDPOINT,
	accessKeyId: process.env.R2_ACCESS_KEY_ID,
	secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
	bucket: process.env.R2_BUCKET,
}

async function deleteKeysWithPrefix(prefix: string) {
	console.log(`🔍 Listing all objects under: ${prefix}`)

	let deletedCount = 0
	let continuationToken: string | undefined

	do {
		// List objects with the prefix
		const listResult = await S3Client.list(
			{
				prefix,
				maxKeys: 1000,
				continuationToken,
			},
			credentials,
		)

		if (!listResult.contents || listResult.contents.length === 0) {
			console.log("✅ No objects found")
			break
		}

		console.log(`📦 Found ${listResult.contents.length} objects to delete`)

		// Delete each object
		for (const obj of listResult.contents) {
			try {
				if (
					obj.key ===
					"sitelink-storage-preview/organizations/4ff0ff39-1180-4fb5-b3f1-e087118b9f21/projects/daf5713b-7132-4880-bab0-868d8293f070/plans/e4b04aee-80fa-4a5e-af27-4135f8b33a48/uploads/7577f10a-3c42-47f0-8886-6711c747df9a/original.pdf"
				) {
					console.log("⏭️  Skipping original PDF...")
					continue
				}
				await S3Client.delete(obj.key, credentials)
				deletedCount++
				console.log(`🗑️  Deleted: ${obj.key}`)
			} catch (error) {
				console.error(`❌ Failed to delete ${obj.key}:`, error)
			}
		}

		// Check if there are more results
		continuationToken = listResult.nextContinuationToken
	} while (continuationToken)

	console.log(`\n✨ Cleanup complete! Deleted ${deletedCount} objects`)
}

// Run the cleanup
const prefix = "organizations/4ff0ff39-1180-4fb5-b3f1-e087118b9f21"
console.log("🧹 Starting R2 cleanup...")
console.log(`Bucket: ${credentials.bucket}`)
console.log(`Prefix: ${prefix}\n`)

deleteKeysWithPrefix(prefix)
	.then(() => {
		console.log("✅ Done!")
		process.exit(0)
	})
	.catch((error) => {
		console.error("💥 Cleanup failed:", error)
		process.exit(1)
	})
