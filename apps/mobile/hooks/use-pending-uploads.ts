import * as Network from "expo-network";
import { useCallback, useEffect, useRef, useState } from "react";
import { uploadPlanToBackend } from "@/services/plan-api";
import {
	addPendingUpload,
	getPendingUploads,
	hasExceededMaxRetries,
	removePendingUpload,
	updateUploadRetry,
	type PendingUpload,
} from "@/services/upload-queue";
import { useSessionContext } from "@/lib/session-context";

export interface UsePendingUploadsReturn {
	pendingUploads: PendingUpload[];
	addToQueue: (
		upload: Omit<PendingUpload, "retryCount" | "createdAt">,
	) => Promise<void>;
	retryUpload: (id: string) => Promise<void>;
	retryAll: () => Promise<void>;
	dismissUpload: (id: string) => Promise<void>;
	isRetrying: boolean;
}

export function usePendingUploads(projectId?: string): UsePendingUploadsReturn {
	const { sessionToken } = useSessionContext();
	const [pendingUploads, setPendingUploads] = useState<PendingUpload[]>([]);
	const [isRetrying, setIsRetrying] = useState(false);
	const wasOfflineRef = useRef(false);
	const sessionTokenRef = useRef(sessionToken);
	sessionTokenRef.current = sessionToken;

	const refresh = useCallback(async () => {
		const uploads = await getPendingUploads();
		setPendingUploads(
			projectId ? uploads.filter((u) => u.projectId === projectId) : uploads,
		);
	}, [projectId]);

	const attemptUpload = useCallback(
		async (upload: PendingUpload): Promise<boolean> => {
			const token = sessionTokenRef.current;
			if (!token) return false;
			if (hasExceededMaxRetries(upload)) return false;

			try {
				await uploadPlanToBackend({
					fileUri: upload.fileUri,
					fileName: upload.fileName,
					projectId: upload.projectId,
					organizationId: upload.organizationId,
					sessionToken: token,
				});
				await removePendingUpload(upload.id);
				return true;
			} catch (error) {
				const errorMsg =
					error instanceof Error ? error.message : String(error);
				await updateUploadRetry(upload.id, errorMsg);
				return false;
			}
		},
		[],
	);

	const handleRetryAll = useCallback(
		async (uploads?: PendingUpload[]) => {
			if (!sessionTokenRef.current) return;
			setIsRetrying(true);
			const toRetry = uploads ?? (await getPendingUploads());
			const retryable = toRetry.filter((u) => !hasExceededMaxRetries(u));
			await Promise.all(retryable.map((u) => attemptUpload(u)));
			await refresh();
			setIsRetrying(false);
		},
		[attemptUpload, refresh],
	);

	const handleRetryAllRef = useRef(handleRetryAll);
	handleRetryAllRef.current = handleRetryAll;

	// Load queue on mount
	useEffect(() => {
		refresh();
	}, [refresh]);

	// Watch network state: retry when coming back online
	useEffect(() => {
		const subscription = Network.addNetworkStateListener(async (state) => {
			const isOnline = state.isConnected && state.isInternetReachable;
			if (isOnline && wasOfflineRef.current) {
				wasOfflineRef.current = false;
				const uploads = await getPendingUploads();
				if (uploads.length > 0) {
					handleRetryAllRef.current(uploads);
				}
			} else if (!isOnline) {
				wasOfflineRef.current = true;
			}
		});

		return () => {
			subscription.remove();
		};
	}, []);

	const retryUpload = useCallback(
		async (id: string) => {
			const uploads = await getPendingUploads();
			const upload = uploads.find((u) => u.id === id);
			if (!upload) return;
			setIsRetrying(true);
			await attemptUpload(upload);
			await refresh();
			setIsRetrying(false);
		},
		[attemptUpload, refresh],
	);

	const addToQueue = useCallback(
		async (upload: Omit<PendingUpload, "retryCount" | "createdAt">) => {
			await addPendingUpload(upload);
			await refresh();
		},
		[refresh],
	);

	const dismissUpload = useCallback(
		async (id: string) => {
			await removePendingUpload(id);
			await refresh();
		},
		[refresh],
	);

	return {
		pendingUploads,
		addToQueue,
		retryUpload,
		retryAll: () => handleRetryAll(),
		dismissUpload,
		isRetrying,
	};
}
