import type { Env } from "../types/env";

/**
 * R2 wrapper that simulates event notifications in local dev.
 * In production, R2 event notifications trigger queues automatically.
 * Locally, miniflare doesn't support this, so we trigger manually.
 */

interface PlanUploadMetadata {
	planId: string;
	projectId: string;
	organizationId: string;
	totalPages: number;
	planName: string;
}

/**
 * Upload PDF to R2 and automatically trigger the processing pipeline.
 * Works the same in local dev and production.
 */
export async function uploadPdfAndTriggerPipeline(
	env: Env,
	pdfPath: string,
	pdfData: ArrayBuffer,
	metadata: PlanUploadMetadata,
): Promise<void> {
	// 1. Upload to R2
	await env.R2_BUCKET.put(pdfPath, pdfData, {
		httpMetadata: { contentType: "application/pdf" },
		customMetadata: {
			planId: metadata.planId,
			projectId: metadata.projectId,
			organizationId: metadata.organizationId,
		},
	});

	console.log(`[R2] Uploaded PDF to ${pdfPath}`);

	// 2. Trigger pipeline (simulates R2 event notification)
	// In production with R2 event notifications configured, this would be redundant
	// but it's safe because PlanCoordinator is idempotent
	await env.IMAGE_GENERATION_QUEUE.send({
		planId: metadata.planId,
		projectId: metadata.projectId,
		organizationId: metadata.organizationId,
		pdfPath,
		totalPages: metadata.totalPages,
		planName: metadata.planName,
	});

	console.log(
		`[R2] Triggered IMAGE_GENERATION_QUEUE for plan ${metadata.planId}`,
	);
}

/**
 * For future: R2 event notification handler
 * When we enable R2 event notifications in production, this handles the events.
 *
 * wrangler.json would have:
 * "r2_buckets": [{
 *   "binding": "R2_BUCKET",
 *   "bucket_name": "sitelink-files",
 *   "event_notifications": {
 *     "queue": "sitelink-image-generation",
 *     "prefix": "organizations/",
 *     "suffix": "/source.pdf"
 *   }
 * }]
 */
export interface R2EventNotification {
	account: string;
	bucket: string;
	object: {
		key: string;
		size: number;
		eTag: string;
	};
	action: "PutObject" | "DeleteObject" | "CompleteMultipartUpload";
	eventTime: string;
}

export function parseR2EventPath(key: string): PlanUploadMetadata | null {
	// Expected format: organizations/{orgId}/projects/{projectId}/plans/{planId}/source.pdf
	const match = key.match(
		/^organizations\/([^/]+)\/projects\/([^/]+)\/plans\/([^/]+)\/source\.pdf$/,
	);

	if (!match) return null;

	return {
		organizationId: match[1],
		projectId: match[2],
		planId: match[3],
		totalPages: 1, // Will be determined by container
	};
}
