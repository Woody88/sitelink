import { queryDb } from "@livestore/livestore";
import { tables } from "@sitelink/domain";
import { File } from "expo-file-system";
import * as React from "react";
import { useAppStore } from "@/livestore/store";
import { useSessionContext } from "@/lib/session-context";
import {
	ensureDirectoryExists,
	getSheetDirectoryById,
	getSheetPmtilesPath,
} from "@/utils/file-paths";

const BACKEND_URL = process.env.EXPO_PUBLIC_BETTER_AUTH_URL;

interface SyncStatus {
	sheetId: string;
	status: "pending" | "downloading" | "completed" | "error";
	progress?: number;
	error?: string;
}

interface FileSyncState {
	syncStatuses: Map<string, SyncStatus>;
	getLocalPmtilesPath: (sheetId: string) => string | null;
}

const downloadingSheets = new Set<string>();

function convertR2UrlToBackendProxy(r2Url: string): string {
	// Convert https://r2.sitelink.dev/path/to/file to ${BACKEND_URL}/api/r2/path/to/file
	const r2Host = "https://r2.sitelink.dev/";
	if (r2Url.startsWith(r2Host)) {
		const path = r2Url.slice(r2Host.length);
		return `${BACKEND_URL}/api/r2/${path}`;
	}
	// If it's already a backend URL or different format, return as-is
	return r2Url;
}

async function downloadPmtiles(
	sheetId: string,
	projectId: string,
	planId: string,
	organizationId: string,
	remotePmtilesUrl: string,
	sessionToken: string,
): Promise<string> {
	const localPath = getSheetPmtilesPath(
		organizationId,
		projectId,
		planId,
		sheetId,
	);

	const dirPath = getSheetDirectoryById(
		organizationId,
		projectId,
		planId,
		sheetId,
	);
	await ensureDirectoryExists(dirPath);

	// Convert R2 URL to backend proxy URL to avoid CORS issues
	const downloadUrl = convertR2UrlToBackendProxy(remotePmtilesUrl);
	console.log(`[FileSync] Downloading PMTiles for sheet ${sheetId}`);
	console.log(`[FileSync] Original URL: ${remotePmtilesUrl}`);
	console.log(`[FileSync] Download URL: ${downloadUrl}`);
	console.log(`[FileSync] Local path: ${localPath}`);

	const response = await fetch(downloadUrl, {
		headers: {
			Authorization: `Bearer ${sessionToken}`,
		},
	});

	if (!response.ok) {
		throw new Error(`Download failed: ${response.status} ${response.statusText}`);
	}

	const arrayBuffer = await response.arrayBuffer();
	const bytes = new Uint8Array(arrayBuffer);

	const file = new File(localPath);
	file.create({ intermediates: true });
	file.write(bytes);

	console.log(`[FileSync] Downloaded ${bytes.length} bytes to ${localPath}`);
	return localPath;
}

export function useFileSyncService(projectId: string | undefined): FileSyncState {
	const { sessionToken, organizationId } = useSessionContext();
	const store = useAppStore(organizationId!, sessionToken, "");

	const [syncStatuses, setSyncStatuses] = React.useState<Map<string, SyncStatus>>(
		new Map(),
	);
	const [localPaths, setLocalPaths] = React.useState<Map<string, string>>(
		new Map(),
	);

	const sheets = store.useQuery(
		queryDb(
			tables.sheets.where(
				projectId ? { projectId } : {},
			),
		),
	);

	React.useEffect(() => {
		if (!sheets || !organizationId || !sessionToken) return;

		const sheetsArray = Array.isArray(sheets) ? sheets : [];

		const checkAndDownload = async () => {
			for (const sheet of sheetsArray) {
				if (!sheet.remotePmtilesPath) continue;
				if (downloadingSheets.has(sheet.id)) continue;

				const localPath = getSheetPmtilesPath(
					organizationId,
					sheet.projectId,
					sheet.planId,
					sheet.id,
				);

				const file = new File(localPath);
				if (file.exists) {
					setLocalPaths((prev) => new Map(prev).set(sheet.id, localPath));
					continue;
				}

				downloadingSheets.add(sheet.id);
				setSyncStatuses((prev) =>
					new Map(prev).set(sheet.id, {
						sheetId: sheet.id,
						status: "downloading",
					}),
				);

				try {
					const downloadedPath = await downloadPmtiles(
						sheet.id,
						sheet.projectId,
						sheet.planId,
						organizationId,
						sheet.remotePmtilesPath,
						sessionToken,
					);

					setLocalPaths((prev) => new Map(prev).set(sheet.id, downloadedPath));
					setSyncStatuses((prev) =>
						new Map(prev).set(sheet.id, {
							sheetId: sheet.id,
							status: "completed",
						}),
					);
				} catch (error) {
					console.error(`[FileSync] Error downloading PMTiles for ${sheet.id}:`, error);
					setSyncStatuses((prev) =>
						new Map(prev).set(sheet.id, {
							sheetId: sheet.id,
							status: "error",
							error: error instanceof Error ? error.message : "Download failed",
						}),
					);
				} finally {
					downloadingSheets.delete(sheet.id);
				}
			}
		};

		checkAndDownload();
	}, [sheets, organizationId, sessionToken]);

	const getLocalPmtilesPath = React.useCallback(
		(sheetId: string): string | null => {
			return localPaths.get(sheetId) ?? null;
		},
		[localPaths],
	);

	return {
		syncStatuses,
		getLocalPmtilesPath,
	};
}

export function useSheetPmtilesSync(
	sheetId: string,
	projectId: string,
	planId: string,
	remotePmtilesPath: string | null | undefined,
): {
	localPmtilesPath: string | null;
	isDownloading: boolean;
	error: string | null;
} {
	const { sessionToken, organizationId } = useSessionContext();
	const [localPath, setLocalPath] = React.useState<string | null>(null);
	const [isDownloading, setIsDownloading] = React.useState(false);
	const [error, setError] = React.useState<string | null>(null);

	console.log(`[FileSync] useSheetPmtilesSync called`, {
		sheetId,
		projectId,
		planId,
		remotePmtilesPath: remotePmtilesPath?.slice(0, 50),
		organizationId,
		hasSessionToken: !!sessionToken,
	});

	React.useEffect(() => {
		console.log(`[FileSync] Effect triggered`, {
			remotePmtilesPath: !!remotePmtilesPath,
			organizationId,
			sessionToken: !!sessionToken,
		});

		if (!remotePmtilesPath || !organizationId || !sessionToken) {
			console.log(`[FileSync] Bailing out - missing deps`);
			return;
		}

		const localFilePath = getSheetPmtilesPath(
			organizationId,
			projectId,
			planId,
			sheetId,
		);

		const file = new File(localFilePath);
		if (file.exists) {
			setLocalPath(localFilePath);
			return;
		}

		if (downloadingSheets.has(sheetId)) {
			setIsDownloading(true);
			return;
		}

		downloadingSheets.add(sheetId);
		setIsDownloading(true);
		setError(null);

		downloadPmtiles(
			sheetId,
			projectId,
			planId,
			organizationId,
			remotePmtilesPath,
			sessionToken,
		)
			.then((path) => {
				setLocalPath(path);
				setIsDownloading(false);
			})
			.catch((err) => {
				console.error(`[FileSync] Error:`, err);
				setError(err instanceof Error ? err.message : "Download failed");
				setIsDownloading(false);
			})
			.finally(() => {
				downloadingSheets.delete(sheetId);
			});
	}, [sheetId, projectId, planId, remotePmtilesPath, organizationId, sessionToken]);

	return { localPmtilesPath: localPath, isDownloading, error };
}
