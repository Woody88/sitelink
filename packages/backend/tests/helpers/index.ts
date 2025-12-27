/**
 * Test Helpers
 *
 * Shared utilities for integration tests
 */

export {
	createAuthenticatedUser,
	createOrgWithSubscription,
	createProject,
	createPlan,
	setupUserOrgAndProject,
	waitFor,
	wrappedFetch,
} from "./setup"

export { createMinimalPDF, loadSamplePDF } from "./fixtures"

export {
	createApiKeyForUser,
	createSystemPdfProcessorUser,
	SYSTEM_PDF_PROCESSOR_EMAIL,
} from "./api-keys"

/**
 * Check if plan-ocr-service container is available
 * Returns true if health endpoint responds, false otherwise
 */
export async function isPlanOcrServiceAvailable(): Promise<boolean> {
	try {
		const response = await fetch("http://localhost:8000/health", {
			signal: AbortSignal.timeout(2000), // 2 second timeout
		})
		return response.ok
	} catch {
		return false
	}
}

/**
 * Check if callout-processor container is available on port 8001
 * Returns true if health endpoint responds with status "ready", false otherwise
 */
export async function isCalloutProcessorAvailable(): Promise<boolean> {
	try {
		const response = await fetch("http://localhost:8001/health", {
			signal: AbortSignal.timeout(2000), // 2 second timeout
		})
		if (!response.ok) return false

		const data = (await response.json()) as { status?: string }
		return data.status === "ready"
	} catch {
		return false
	}
}
