import { State } from "@livestore/livestore";
import { events } from "@sitelink/domain";
import { File } from "expo-file-system";
import * as FileSystem from "expo-file-system/legacy";
import type { ProcessedPage } from "@/components/pdf/types";
import {
	ensurePlanUploadDirectoryExists,
	ensureSheetDirectoryExists,
	getPlanSourcePath,
	getSheetFullImagePath,
	getSheetPdfPath,
	getSheetThumbnailPath,
} from "@/utils/file-paths";

export interface PlanUploadOptions {
	planId: string;
	projectId: string;
	organizationId: string;
	fileName: string;
	fileSize: number;
	mimeType: string;
	sourceUri: string;
	uploadedBy: string;
}

/**
 * Handle initial plan upload and local storage
 */
export async function uploadPlan(
	store: any,
	options: PlanUploadOptions,
): Promise<{ destinationPath: string }> {
	const {
		planId,
		projectId,
		organizationId,
		fileName,
		fileSize,
		mimeType,
		sourceUri,
		uploadedBy,
	} = options;

	await ensurePlanUploadDirectoryExists(organizationId, projectId, planId);
	const destinationPath = getPlanSourcePath(organizationId, projectId, planId);

	await FileSystem.copyAsync({
		from: sourceUri,
		to: destinationPath,
	});

	await store.commit(
		events.planUploaded({
			id: planId,
			projectId,
			fileName,
			fileSize,
			mimeType,
			localPath: destinationPath,
			remotePath: undefined,
			uploadedBy,
			uploadedAt: new Date(),
		}),
	);

	await store.commit(
		events.planProcessingStarted({
			planId,
			startedAt: new Date(),
		}),
	);

	return { destinationPath };
}

/**
 * Save a single processed sheet (single-page PDF) to the local filesystem
 * Writes bytes directly (no base64!) - same pattern as backend writing to R2
 */
export async function saveProcessedSheet(
	organizationId: string,
	projectId: string,
	planId: string,
	sheet: {
		pageNumber: number;
		pdfBytes: Uint8Array;
		width: number;
		height: number;
	},
): Promise<{
	id: string;
	number: string;
	title: string;
	discipline: string;
	localImagePath: string;
	localThumbnailPath: string;
	imagePath: undefined;
	width: number;
	height: number;
}> {
	await ensureSheetDirectoryExists(
		organizationId,
		projectId,
		planId,
		sheet.pageNumber,
	);

	const pdfPath = getSheetPdfPath(
		organizationId,
		projectId,
		planId,
		sheet.pageNumber,
	);

	// Write bytes directly using File API (no base64 conversion!)
	const file = new File(pdfPath);
	file.create();
	file.write(sheet.pdfBytes);

	const sheetId = `${planId}_sheet_${sheet.pageNumber}`;

	return {
		id: sheetId,
		number: String(sheet.pageNumber),
		title: `Sheet ${sheet.pageNumber}`,
		discipline: "GENERAL",
		localImagePath: pdfPath,
		localThumbnailPath: pdfPath,
		imagePath: undefined,
		width: sheet.width,
		height: sheet.height,
	};
}

/**
 * Legacy function - Save a single processed sheet with images
 * @deprecated Use saveProcessedSheet with ProcessedSheet instead
 */
export async function saveProcessedSheetLegacy(
	organizationId: string,
	projectId: string,
	planId: string,
	page: ProcessedPage,
): Promise<{
	id: string;
	number: string;
	title: string;
	discipline: string;
	localImagePath: string;
	localThumbnailPath: string;
	imagePath: undefined;
	width: number;
	height: number;
}> {
	await ensureSheetDirectoryExists(
		organizationId,
		projectId,
		planId,
		page.pageNumber,
	);

	const fullImagePath = getSheetFullImagePath(
		organizationId,
		projectId,
		planId,
		page.pageNumber,
	);
	const thumbnailPath = getSheetThumbnailPath(
		organizationId,
		projectId,
		planId,
		page.pageNumber,
	);

	const fullImageBase64 = page.fullImageDataUrl.split(",")[1];
	const thumbnailBase64 = page.thumbnailDataUrl.split(",")[1];

	await FileSystem.writeAsStringAsync(fullImagePath, fullImageBase64, {
		encoding: FileSystem.EncodingType.Base64,
	});

	await FileSystem.writeAsStringAsync(thumbnailPath, thumbnailBase64, {
		encoding: FileSystem.EncodingType.Base64,
	});

	// Also save the 1-page PDF if provided
	if (page.pdfData) {
		const sheetPath = fullImagePath.substring(
			0,
			fullImagePath.lastIndexOf("/"),
		);
		const pdfPath = `${sheetPath}/source.pdf`;
		await FileSystem.writeAsStringAsync(pdfPath, page.pdfData, {
			encoding: FileSystem.EncodingType.Base64,
		});
	}

	const sheetId = `${planId}_sheet_${page.pageNumber}`;

	return {
		id: sheetId,
		number: String(page.pageNumber),
		title: `Sheet ${page.pageNumber}`,
		discipline: "GENERAL",
		localImagePath: fullImagePath,
		localThumbnailPath: thumbnailPath,
		imagePath: undefined,
		width: page.width,
		height: page.height,
	};
}
