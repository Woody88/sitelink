import { createCompleteTestEnvironment } from "./helpers/standalone-setup"

const env = await createCompleteTestEnvironment({
	email: "test@example.com",
	orgName: "Test Org",
	projectName: "Test Project",
	planName: "Test Plan",
	baseUrl: "http://localhost:8787", // Custom URL for dev server
})

console.log("\n✨ Test environment ready!")
console.log("📋 Summary:")
console.log(`   - Organization ID: ${env.organizationId}`)
console.log(`   - Project ID: ${env.projectId}`)
console.log(`   - Plan ID: ${env.planId}`)
console.log(`   - Job ID: ${env.jobId}`)
console.log(`   - Upload ID: ${env.uploadId}`)
console.log(`   - File ID: ${env.fileId}`)
