import { File } from "expo-file-system";
import { PDFDocument } from "pdf-lib";

export interface ProcessedSheet {
	pageNumber: number;
	pdfBytes: Uint8Array;
	width: number;
	height: number;
}

/**
 * Process a PDF by splitting it into individual pages
 * Runs directly in React Native (no WebView needed)
 * Matches backend implementation pattern - works with bytes throughout
 */
export async function processPDF(
	pdfFilePath: string,
	onProgress?: (current: number, total: number) => void,
): Promise<ProcessedSheet[]> {
	// Read PDF as ArrayBuffer directly (no base64!)
	const file = new File(pdfFilePath);
	const arrayBuffer = await file.arrayBuffer();
	const bytes = new Uint8Array(arrayBuffer);

	const pdfDoc = await PDFDocument.load(bytes);
	const pageCount = pdfDoc.getPageCount();
	const sheets: ProcessedSheet[] = [];

	for (let i = 0; i < pageCount; i++) {
		onProgress?.(i + 1, pageCount);

		// Create single-page PDF (same as backend)
		const singlePageDoc = await PDFDocument.create();
		const [copiedPage] = await singlePageDoc.copyPages(pdfDoc, [i]);
		singlePageDoc.addPage(copiedPage);

		// Get dimensions from original page
		const page = pdfDoc.getPage(i);
		const { width, height } = page.getSize();

		// Save as Uint8Array (same as backend)
		const pdfBytes = await singlePageDoc.save();

		sheets.push({ pageNumber: i + 1, pdfBytes, width, height });
	}

	return sheets;
}
