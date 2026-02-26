/**
 * OCR Text Detection Utility
 *
 * Calls the backend API which uses PaddleOCR to extract text from photos.
 */

const BACKEND_URL = process.env.EXPO_PUBLIC_BETTER_AUTH_URL ?? "";

export interface OcrResult {
	text: string;
	confidence: number;
}

export async function detectTextInPhoto(
	photoUri: string,
	sessionToken: string,
): Promise<OcrResult | null> {
	const formData = new FormData();
	formData.append("image", {
		uri: photoUri,
		type: "image/jpeg",
		name: "photo.jpg",
	} as unknown as Blob);

	const response = await fetch(`${BACKEND_URL}/api/photos/ocr`, {
		method: "POST",
		headers: { Authorization: `Bearer ${sessionToken}` },
		body: formData,
	});

	if (!response.ok) {
		throw new Error(`OCR request failed: ${response.status}`);
	}

	const data = (await response.json()) as { text: string; confidence: number } | { text: null };
	if (!data.text) return null;

	return { text: data.text, confidence: (data as { text: string; confidence: number }).confidence };
}
