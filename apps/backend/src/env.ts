import type { ClientDoWithRpcCallback } from "@livestore/adapter-cloudflare";
import type {
	CfTypes,
	SyncBackendRpcInterface,
} from "@livestore/sync-cf/cf-worker";
import type { PlanCoordinator } from "./processing/plan-coordinator";

export interface Env {
	// Durable Objects
	CLIENT_DO: CfTypes.DurableObjectNamespace<ClientDoWithRpcCallback>;
	SYNC_BACKEND_DO: CfTypes.DurableObjectNamespace<SyncBackendRpcInterface>;
	LIVESTORE_CLIENT_DO: DurableObjectNamespace;
	PLAN_COORDINATOR_DO: DurableObjectNamespace<PlanCoordinator>;

	// Database
	DB: CfTypes.D1Database;

	// Storage
	R2_BUCKET: R2Bucket;

	// Queues for PDF processing pipeline
	IMAGE_GENERATION_QUEUE: Queue;
	METADATA_EXTRACTION_QUEUE: Queue;
	CALLOUT_DETECTION_QUEUE: Queue;
	TILE_GENERATION_QUEUE: Queue;

	// Cloudflare Container for VIPS/Python processing
	PDF_PROCESSOR_CONTAINER: Fetcher;

	// Auth
	GOOGLE_CLIENT_ID: string;
	GOOGLE_CLIENT_SECRET: string;
	MICROSOFT_CLIENT_ID: string;
	MICROSOFT_CLIENT_SECRET: string;
	BETTER_AUTH_SECRET: string;
	BETTER_AUTH_URL: string;
}
