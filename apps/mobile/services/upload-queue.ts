import * as FileSystem from "expo-file-system/legacy";

const QUEUE_FILE_PATH = `${FileSystem.documentDirectory}sitelink-upload-queue.json`;
const MAX_RETRY_COUNT = 3;

export interface PendingUpload {
	id: string;
	fileUri: string;
	fileName: string;
	projectId: string;
	organizationId: string;
	fileSize?: number;
	createdAt: number;
	retryCount: number;
	lastError?: string;
	lastAttemptAt?: number;
}

async function readQueue(): Promise<PendingUpload[]> {
	try {
		const info = await FileSystem.getInfoAsync(QUEUE_FILE_PATH);
		if (!info.exists) return [];
		const content = await FileSystem.readAsStringAsync(QUEUE_FILE_PATH);
		return JSON.parse(content);
	} catch {
		return [];
	}
}

async function writeQueue(queue: PendingUpload[]): Promise<void> {
	await FileSystem.writeAsStringAsync(
		QUEUE_FILE_PATH,
		JSON.stringify(queue),
	);
}

export async function addPendingUpload(
	upload: Omit<PendingUpload, "retryCount" | "createdAt">,
): Promise<void> {
	const queue = await readQueue();
	const existing = queue.findIndex((u) => u.id === upload.id);
	const entry: PendingUpload = {
		...upload,
		createdAt: Date.now(),
		retryCount: 0,
	};
	if (existing >= 0) {
		queue[existing] = entry;
	} else {
		queue.push(entry);
	}
	await writeQueue(queue);
}

export async function removePendingUpload(id: string): Promise<void> {
	const queue = await readQueue();
	await writeQueue(queue.filter((u) => u.id !== id));
}

export async function getPendingUploads(): Promise<PendingUpload[]> {
	return readQueue();
}

export async function updateUploadRetry(
	id: string,
	error: string,
): Promise<PendingUpload | null> {
	const queue = await readQueue();
	const idx = queue.findIndex((u) => u.id === id);
	if (idx < 0) return null;
	queue[idx] = {
		...queue[idx],
		retryCount: queue[idx].retryCount + 1,
		lastError: error,
		lastAttemptAt: Date.now(),
	};
	await writeQueue(queue);
	return queue[idx];
}

export function hasExceededMaxRetries(upload: PendingUpload): boolean {
	return upload.retryCount >= MAX_RETRY_COUNT;
}
