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
