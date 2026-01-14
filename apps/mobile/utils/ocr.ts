/**
 * OCR Text Detection Utility
 *
 * In production, this will call the backend API which uses PaddleOCR
 * to extract text from photos. For now, this is a mock implementation.
 */

export interface OcrResult {
	text: string;
	confidence: number;
}

export async function detectTextInPhoto(
	photoUri: string,
): Promise<OcrResult | null> {
	// TODO: Replace with actual API call to backend OCR endpoint
	// Example: POST /api/photos/ocr with FormData containing the image

	// Mock implementation - simulate async processing
	await new Promise((resolve) => setTimeout(resolve, 1500));

	// Mock text detection (randomly returns text or null)
	if (Math.random() > 0.3) {
		return {
			text: "Junction box needs to move about six inches to the left to clear the conduit run",
			confidence: 0.92,
		};
	}

	return null;
}
