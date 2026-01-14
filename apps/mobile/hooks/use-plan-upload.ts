import { nanoid } from "@livestore/livestore";
import { events } from "@sitelink/domain";
import * as DocumentPicker from "expo-document-picker";
import { useCallback, useState } from "react";
import { useSessionContext } from "@/lib/session-context";
import { useAppStore } from "@/livestore/store";
import { processPDF } from "@/services/pdf-processor";
import { saveProcessedSheet, uploadPlan } from "@/services/plan-upload-service";

export interface UsePlanUploadOptions {
	projectId: string;
	organizationId: string;
	uploadedBy: string;
}

export interface UploadProgress {
	planId: string;
	progress: number;
	currentPage: number;
	totalPages: number;
	status: "idle" | "uploading" | "processing" | "complete" | "error";
	error?: Error;
}

export function usePlanUpload({
	projectId,
	organizationId,
	uploadedBy,
}: UsePlanUploadOptions) {
	const { sessionToken, sessionId } = useSessionContext();
	const store = useAppStore(organizationId, sessionToken, sessionId);
	const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(
		null,
	);

	const pickAndUploadPlan = useCallback(async () => {
		try {
			console.log("[UPLOAD] Opening document picker...");
			const result = await DocumentPicker.getDocumentAsync({
				type: ["application/pdf"],
				copyToCacheDirectory: true,
				multiple: false,
			});

			if (result.canceled) {
				console.log("[UPLOAD] User canceled file selection");
				return null;
			}

			const file = result.assets[0];
			const planId = nanoid();
			console.log("[UPLOAD] File selected:", {
				fileName: file.name,
				size: file.size,
				planId,
			});

			setUploadProgress({
				planId,
				progress: 0,
				currentPage: 0,
				totalPages: 0,
				status: "uploading",
			});

			console.log("[UPLOAD] Uploading plan to local storage...");
			const { destinationPath } = await uploadPlan(store, {
				planId,
				projectId,
				organizationId,
				fileName: file.name,
				fileSize: file.size || 0,
				mimeType: file.mimeType || "application/pdf",
				sourceUri: file.uri,
				uploadedBy,
			});

			console.log("[UPLOAD] Starting PDF processing...");
			setUploadProgress((prev) =>
				prev ? { ...prev, status: "processing" } : null,
			);

			// Process PDF directly - no base64 conversion!
			const sheets = await processPDF(destinationPath, (current, total) => {
				const progress = Math.round((current / total) * 100);
				console.log(
					"[UPLOAD] Progress:",
					`${current}/${total}`,
					`(${progress}%)`,
				);

				setUploadProgress((prev) =>
					prev
						? {
								...prev,
								progress,
								currentPage: current,
								totalPages: total,
								status: "processing",
							}
						: null,
				);

				store.commit(
					events.planProcessingProgress({
						planId,
						progress,
						currentPage: current,
						totalPages: total,
					}),
				);
			});

			console.log("[UPLOAD] PDF processing complete, saving sheets...");

			// Save each sheet
			for (const sheet of sheets) {
				console.log("[UPLOAD] Saving sheet:", sheet.pageNumber);
				const savedSheet = await saveProcessedSheet(
					organizationId,
					projectId,
					planId,
					sheet,
				);

				console.log("[UPLOAD] Committing sheet to store:", savedSheet.id);
				store.commit(
					events.sheetsReceived({
						projectId,
						planId,
						sheets: [savedSheet],
					}),
				);
			}

			// Complete
			console.log("[UPLOAD] All sheets saved, completing plan");
			store.commit(
				events.planProcessingCompleted({
					planId,
					sheetCount: sheets.length,
					completedAt: new Date(),
				}),
			);

			setUploadProgress((prev) =>
				prev
					? {
							...prev,
							progress: 100,
							status: "complete",
						}
					: null,
			);

			console.log("[UPLOAD] Plan processing complete!");
			setTimeout(() => {
				setUploadProgress(null);
			}, 2000);

			return planId;
		} catch (error) {
			console.error("[UPLOAD] Error processing plan:", error);
			const err = error instanceof Error ? error : new Error(String(error));
			setUploadProgress({
				planId: "",
				progress: 0,
				currentPage: 0,
				totalPages: 0,
				status: "error",
				error: err,
			});
			throw err;
		}
	}, [store, projectId, organizationId, uploadedBy]);

	const resetProgress = useCallback(() => {
		setUploadProgress(null);
	}, []);

	return {
		pickAndUploadPlan,
		uploadProgress,
		resetProgress,
		isUploading:
			uploadProgress?.status === "uploading" ||
			uploadProgress?.status === "processing",
	};
}
