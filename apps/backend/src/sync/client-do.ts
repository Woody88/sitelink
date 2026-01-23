import { DurableObject } from "cloudflare:workers";
import {
	type ClientDoWithRpcCallback,
	createStoreDoPromise,
} from "@livestore/adapter-cloudflare";
import { nanoid, type Unsubscribe } from "@livestore/livestore";
import { handleSyncUpdateRpc } from "@livestore/sync-cf/client";
import { events, schema } from "@sitelink/domain";
import type { Env } from "../types/env";
import { storeIdFromRequest } from "./shared";

export class LiveStoreClientDO
	extends DurableObject<Env>
	implements ClientDoWithRpcCallback
{
	override __DURABLE_OBJECT_BRAND: never = undefined as never;

	private storeId: string | undefined;
	private cachedStore: any | undefined;
	private storeSubscription: Unsubscribe | undefined;

	override async fetch(request: Request): Promise<Response> {
		this.storeId = storeIdFromRequest(request as any);
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

		// Get all events for the viewer
		if (url.pathname === "/events" && request.method === "GET") {
			try {
				const store = await this.getStore();
				const eventlog = store.eventlog;

				// Query all events from eventlog
				const allEvents: any[] = [];
				const cursor = eventlog.query({
					live: false,
					seqNumRange: [0, Infinity],
				});

				for (const event of cursor) {
					allEvents.push({
						type: event.type,
						name: event.name,
						seqNum: event.seqNum,
						parentSeqNum: event.parentSeqNum,
						timestamp: event.timestamp,
						data: event.data,
					});
				}

				return Response.json(allEvents);
			} catch (error) {
				console.error("[LiveStoreClientDO] Error fetching events:", error);
				const errorMessage =
					error instanceof Error ? error.message : "Unknown error";
				return Response.json({ error: errorMessage }, { status: 500 });
			}
		}

		return Response.json({ error: "Not found" }, { status: 404 });
	}

	async commit(eventName: string, data: any): Promise<void> {
		try {
			const store = await this.getStore();
			const eventCreator = (events as any)[eventName];

			if (!eventCreator) {
				throw new Error(`Unknown event: ${eventName}`);
			}

			await store.commit(eventCreator(data));
			console.log(`[LiveStoreClientDO] Committed ${eventName}`);
		} catch (error) {
			// If store was shut down, clear cache and retry once
			if (
				error instanceof Error &&
				error.message.includes("shut down")
			) {
				console.log("[LiveStoreClientDO] Store shut down, recreating...");
				this.cachedStore = undefined;
				this.storeSubscription?.();
				this.storeSubscription = undefined;

				const store = await this.getStore();
				const eventCreator = (events as any)[eventName];

				if (!eventCreator) {
					throw new Error(`Unknown event: ${eventName}`);
				}

				await store.commit(eventCreator(data));
				console.log(`[LiveStoreClientDO] Committed ${eventName} after recreate`);
			} else {
				throw error;
			}
		}
	}

	private async getStore() {
		if (this.cachedStore !== undefined) {
			return this.cachedStore;
		}

		const storeId = this.storeId ?? nanoid();

		const store = await createStoreDoPromise({
			schema,
			storeId,
			clientId: "client-do",
			sessionId: nanoid(),
			durableObject: {
				ctx: this.ctx as any,
				env: this.env as any,
				bindingName: "LIVESTORE_CLIENT_DO",
			},
			syncBackendStub: this.env.SYNC_BACKEND_DO.get(
				this.env.SYNC_BACKEND_DO.idFromName(storeId),
			) as any,
			livePull: true,
		} as any);

		this.cachedStore = store;
		return store;
	}

	async syncUpdateRpc(payload: unknown) {
		await handleSyncUpdateRpc(payload);
	}
}
