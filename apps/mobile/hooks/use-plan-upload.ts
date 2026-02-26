import { nanoid } from "@livestore/livestore";
import * as DocumentPicker from "expo-document-picker";
import { useCallback, useState } from "react";
import { useSessionContext } from "@/lib/session-context";
import { uploadPlanToBackend } from "@/services/plan-api";

export interface UsePlanUploadOptions {
	projectId: string;
	organizationId: string;
}

export interface UploadProgress {
	planId: string;
	status: "idle" | "uploading" | "complete" | "error";
	error?: Error;
}

export function usePlanUpload({
	projectId,
	organizationId,
}: UsePlanUploadOptions) {
	const { sessionToken } = useSessionContext();
	const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(
		null,
	);

	const pickAndUploadPlan = useCallback(async () => {
		if (!sessionToken) {
			throw new Error("No session token available");
		}

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
				status: "uploading",
			});

			console.log("[UPLOAD] Uploading plan to backend...");
			const response = await uploadPlanToBackend({
				fileUri: file.uri,
				fileName: file.name,
				projectId,
				organizationId,
				sessionToken,
			});

			console.log("[UPLOAD] Upload complete, backend will process:", response);

			setUploadProgress((prev) =>
				prev
					? {
							...prev,
							status: "complete",
						}
					: null,
			);

			setTimeout(() => {
				setUploadProgress(null);
			}, 2000);

			return response.planId;
		} catch (error) {
			console.error("[UPLOAD] Error uploading plan:", error);
			const err = error instanceof Error ? error : new Error(String(error));
			setUploadProgress({
				planId: "",
				status: "error",
				error: err,
			});
			throw err;
		}
	}, [sessionToken, projectId, organizationId]);

	const resetProgress = useCallback(() => {
		setUploadProgress(null);
	}, []);

	return {
		pickAndUploadPlan,
		uploadProgress,
		resetProgress,
		isUploading: uploadProgress?.status === "uploading",
	};
}
