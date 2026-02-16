import type { Env } from "../types/env";
import type { events } from "@sitelink/domain";

type EventName = keyof typeof events;
type EventData<T extends EventName> = Parameters<(typeof events)[T]>[0];

async function commitEvent<T extends EventName>(
	env: Env,
	organizationId: string,
	eventName: T,
	data: EventData<T>,
): Promise<void> {
	const liveStoreStub = env.LIVESTORE_CLIENT_DO.get(
		env.LIVESTORE_CLIENT_DO.idFromName(organizationId),
	);
	await liveStoreStub.fetch("http://internal/commit?storeId=" + organizationId, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ eventName, data }),
	});
}

interface PlanUploadMetadata {
	planId: string;
	projectId: string;
	organizationId: string;
	totalPages: number;
	planName?: string;
}

export interface R2EventNotification {
	account: string;
	bucket: string;
	object: {
		key: string;
		size: number;
		eTag: string;
	};
	action: "PutObject" | "DeleteObject" | "CompleteMultipartUpload" | "CopyObject";
	eventTime: string;
	copySource?: {
		bucket: string;
		object: string;
	};
}

export function parseR2EventPath(key: string): PlanUploadMetadata | null {
	const match = key.match(
		/^organizations\/([^/]+)\/projects\/([^/]+)\/plans\/([^/]+)\/source\.pdf$/,
	);

	if (!match) return null;

	const planName = match[3];

	return {
		organizationId: match[1],
		projectId: match[2],
		planId: match[3],
		totalPages: 1,
		planName,
	};
}

export async function handleR2NotificationQueue(
	batch: MessageBatch<R2EventNotification>,
	env: Env,
): Promise<void> {
	for (const message of batch.messages) {
		const notification = message.body;

		console.log(
			`[R2Notification] Received ${notification.action} for ${notification.object.key}`,
		);

		if (notification.action !== "PutObject" && notification.action !== "CompleteMultipartUpload") {
			console.log(`[R2Notification] Ignoring action: ${notification.action}`);
			message.ack();
			continue;
		}

		if (!notification.object.key.endsWith("/source.pdf")) {
			console.log(`[R2Notification] Ignoring non-PDF upload: ${notification.object.key}`);
			message.ack();
			continue;
		}

		const metadata = parseR2EventPath(notification.object.key);
		if (!metadata) {
			console.error(`[R2Notification] Could not parse path: ${notification.object.key}`);
			message.ack();
			continue;
		}

		console.log(
			`[R2Notification] Triggering pipeline for plan ${metadata.planId} in org ${metadata.organizationId}`,
		);

		try {
			await commitEvent(env, metadata.organizationId, "planProcessingStarted", {
				planId: metadata.planId,
				startedAt: Date.now(),
			});
		} catch (liveStoreError) {
			console.warn(
				`[R2Notification] LiveStore emit failed:`,
				liveStoreError,
			);
		}

		await env.IMAGE_GENERATION_QUEUE.send({
			planId: metadata.planId,
			projectId: metadata.projectId,
			organizationId: metadata.organizationId,
			pdfPath: notification.object.key,
			totalPages: metadata.totalPages,
			planName: metadata.planName || metadata.planId,
		});

		console.log(
			`[R2Notification] Queued IMAGE_GENERATION for plan ${metadata.planId}`,
		);

		message.ack();
	}
}

export async function uploadPdfAndTriggerPipeline(
	env: Env,
	pdfPath: string,
	pdfData: ArrayBuffer,
	metadata: PlanUploadMetadata,
): Promise<void> {
	await env.R2_BUCKET.put(pdfPath, pdfData, {
		httpMetadata: { contentType: "application/pdf" },
		customMetadata: {
			planId: metadata.planId,
			projectId: metadata.projectId,
			organizationId: metadata.organizationId,
		},
	});

	console.log(`[R2] Uploaded PDF to ${pdfPath}`);

	const hasR2Notifications = false;

	if (!hasR2Notifications) {
		console.log(`[R2] Simulating R2 notification (R2 event notifications not enabled)`);

		const simulatedNotification: R2EventNotification = {
			account: "simulated",
			bucket: "sitelink-files",
			object: {
				key: pdfPath,
				size: pdfData.byteLength,
				eTag: `simulated-${Date.now()}`,
			},
			action: "PutObject",
			eventTime: new Date().toISOString(),
		};

		await env.R2_NOTIFICATION_QUEUE.send(simulatedNotification);

		console.log(`[R2] Sent simulated R2 notification to queue`);
	} else {
		console.log(`[R2] R2 event notification will trigger automatically`);
	}
}

export async function simulateR2Notification(
	env: Env,
	pdfPath: string,
	fileSize: number = 0,
): Promise<void> {
	const notification: R2EventNotification = {
		account: "simulated",
		bucket: "sitelink-files",
		object: {
			key: pdfPath,
			size: fileSize,
			eTag: `simulated-${Date.now()}`,
		},
		action: "PutObject",
		eventTime: new Date().toISOString(),
	};

	await env.R2_NOTIFICATION_QUEUE.send(notification);

	console.log(`[R2] Simulated R2 notification sent for ${pdfPath}`);
}
