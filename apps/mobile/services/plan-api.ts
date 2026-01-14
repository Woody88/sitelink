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

	const formData = new FormData();
	formData.append("file", {
		uri: fileUri,
		type: "application/pdf",
		name: fileName,
	} as any);
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
