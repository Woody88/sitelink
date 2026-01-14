// apps/backend/src/sync/livestore-client.ts
import { createStoreDoPromise } from "@livestore/adapter-cloudflare";
import { events, schema } from "@sitelink/domain";
import type { Env } from "../types/env";

/**
 * LiveStoreClientDO - Server-side LiveStore client running in a Durable Object
 *
 * This DO provides a server-side LiveStore instance that can:
 * - Commit events to the sync backend
 * - React to database changes (via Better Auth hooks)
 * - Emit events that sync to all connected clients
 *
 * ref: https://next.livestore.dev/patterns/server-side-clients
 */
export class LiveStoreClientDO implements DurableObject {
	// Use any for now due to complex type inference issues with @cloudflare/workers-types
	__DURABLE_OBJECT_BRAND: never = undefined as never;
	private store: any | undefined;

	constructor(
		private ctx: DurableObjectState,
		private env: Env,
	) {}

	/**
	 * Initialize the server-side LiveStore instance
	 */
	private async getStore(): Promise<any> {
		if (this.store) {
			return this.store;
		}

		// Get the sync backend stub
		const syncBackendStub: any = this.env.SYNC_BACKEND_DO.get(
			// Use a deterministic ID for the sync backend
			this.env.SYNC_BACKEND_DO.idFromName("default"),
		);

		// Create the server-side LiveStore instance
		this.store = await createStoreDoPromise({
			schema,
			storeId: "server-store",
			clientId: this.ctx.id.toString(),
			sessionId: "server-session",
			durableObject: {
				ctx: this.ctx,
				env: this.env,
				bindingName: "LIVESTORE_CLIENT_DO",
			},
			syncBackendStub,
		} as any);

		return this.store;
	}

	/**
	 * Generic commit method that handles any event from the domain package
	 */
	async commit(eventName: string, data: any): Promise<void> {
		const store = await this.getStore();
		const eventCreator = (events as any)[eventName];

		if (!eventCreator) {
			throw new Error(`Unknown event: ${eventName}`);
		}

		await store.commit(eventCreator(data));
		console.log(`[LiveStoreClientDO] Committed ${eventName}`);
	}

	/**
	 * Handle HTTP requests to this DO
	 * Provides RPC-style endpoints for backend operations
	 */
	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);

		// Generic endpoint for committing any domain event
		if (url.pathname === "/commit" && request.method === "POST") {
			try {
				const { eventName, data } = (await request.json()) as {
					eventName: string;
					data: any;
				};
				await this.commit(eventName, data);
				return Response.json({ success: true });
			} catch (error) {
				console.error("[LiveStoreClientDO] Error committing event:", error);
				const errorMessage =
					error instanceof Error ? error.message : "Unknown error";
				return Response.json({ error: errorMessage }, { status: 500 });
			}
		}

		return Response.json({ error: "Not found" }, { status: 404 });
	}
}

/**
 * Type-safe interface for calling LiveStoreClientDO from the main worker
 */
export interface LiveStoreClient {
	commit<T extends keyof typeof events>(
		eventName: T,
		data: Parameters<(typeof events)[T]>[0],
		storeId: string,
	): Promise<void>;
}

/**
 * Create a LiveStoreClient instance from a DO stub
 */
export function createLiveStoreClient(
	stub: DurableObjectStub,
): LiveStoreClient {
	return {
		async commit(eventName, data, storeId) {
			// Pass storeId for multi-tenant isolation (typically organizationId)
			const response = await stub.fetch(
				`http://internal/commit?storeId=${encodeURIComponent(storeId)}`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ eventName, data }),
				},
			);

			if (!response.ok) {
				const errorData = (await response.json()) as { error?: string };
				throw new Error(
					errorData.error || `Failed to commit event: ${eventName}`,
				);
			}
		},
	};
}
