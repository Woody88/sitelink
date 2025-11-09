/**
 * Setup script to initialize dev database with required system users
 * Run this before starting the dev server
 */

const SYSTEM_PDF_PROCESSOR_EMAIL = "system-pdf-processor@sitelink.com"

async function setupDevDatabase() {
	console.log("🔧 Setting up dev database...")

	// Create system PDF processor user
	const response = await fetch("http://localhost:8787/api/auth/sign-up/email", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			email: SYSTEM_PDF_PROCESSOR_EMAIL,
			password: "system-password-dev-only",
			name: "System PDF Processor",
		}),
	})

	if (!response.ok) {
		const errorText = await response.text()
		console.error(`❌ Failed to create system user: ${response.status}`)
		console.error(errorText)
		process.exit(1)
	}

	console.log("✅ System PDF processor user created successfully")
	console.log(`   Email: ${SYSTEM_PDF_PROCESSOR_EMAIL}`)
}

setupDevDatabase().catch((error) => {
	console.error("❌ Setup failed:", error)
	process.exit(1)
})
