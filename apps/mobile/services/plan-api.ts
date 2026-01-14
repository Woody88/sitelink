import { File } from "expo-file-system";

const BACKEND_URL = process.env.EXPO_PUBLIC_BETTER_AUTH_URL;

if (!BACKEND_URL) {
	throw new Error("EXPO_PUBLIC_BETTER_AUTH_URL is not defined");
}

export interface UploadPlanToBackendOptions {
	fileUri: string;
	fileName: string;
	projectId: string;
	organizationId: string;
	sessionToken: string;
}

export interface UploadPlanResponse {
	success: boolean;
	planId: string;
	message?: string;
}

export async function uploadPlanToBackend(
	options: UploadPlanToBackendOptions,
): Promise<UploadPlanResponse> {
	const { fileUri, fileName, projectId, organizationId, sessionToken } =
		options;

	const file = new File(fileUri);
	const arrayBuffer = await file.arrayBuffer();
	const blob = new Blob([arrayBuffer], { type: "application/pdf" });

	const formData = new FormData();
	formData.append("file", blob, fileName);
	formData.append("projectId", projectId);
	formData.append("organizationId", organizationId);

	const response = await fetch(`${BACKEND_URL}/api/plans/upload`, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${sessionToken}`,
		},
		body: formData,
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(
			`Upload failed: ${response.status} ${response.statusText} - ${errorText}`,
		);
	}

	return await response.json();
}
