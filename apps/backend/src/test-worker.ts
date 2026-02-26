// Test worker for integration testing via Workflow-based pipeline.
import { DurableObject } from "cloudflare:workers";

// Re-export PlanProcessingWorkflow for integration testing via Workflow binding
export { PlanProcessingWorkflow } from "./workflows/plan-processing";
import type { PlanProcessingParams } from "./workflows/plan-processing";

export interface TestEnv {
	DB: D1Database;
	R2_BUCKET: R2Bucket;
	LIVESTORE_CLIENT_DO: DurableObjectNamespace;
	PDF_PROCESSOR: DurableObjectNamespace;
	PLAN_PROCESSING_WORKFLOW: Workflow<PlanProcessingParams>;
	FIXTURE_LOADER?: Fetcher;
	PDF_CONTAINER_PROXY?: Fetcher;
	TEST_MIGRATIONS?: D1Migration[];
	OPENROUTER_API_KEY?: string;
	OPENROUTER_MODEL?: string;
}

// Proxies container calls to the real Docker container via PDF_CONTAINER_PROXY service binding.
// This replaces the real PdfProcessor (which extends Container from @cloudflare/containers
// and doesn't work in WSL2/test environments).
export class TestPdfProcessor extends DurableObject<TestEnv> {
	async startAndWaitForPorts(_options?: unknown): Promise<void> {
		// No-op in test environment — container is already running via docker-compose
	}

	override async fetch(request: Request): Promise<Response> {
		if (!this.env.PDF_CONTAINER_PROXY) {
			return Response.json(
				{ error: "PDF_CONTAINER_PROXY not configured" },
				{ status: 503 },
			);
		}
		// Reconstruct the request to avoid workerd "Can't read from request stream
		// after response has been sent" error (github.com/cloudflare/workerd#1730)
		const body = await request.arrayBuffer();
		const newRequest = new Request(request.url, {
			method: request.method,
			headers: request.headers,
			body: body.byteLength > 0 ? body : undefined,
		});
		return this.env.PDF_CONTAINER_PROXY.fetch(newRequest);
	}
}

// Captures LiveStore events committed during pipeline processing.
// Tests can retrieve collected events to validate schema shapes.
// Uses durable storage to survive DO eviction during long pipeline runs.
export class LiveStoreCollector extends DurableObject<TestEnv> {
	private async loadEvents(): Promise<
		Array<{ eventName: string; data: Record<string, unknown>; timestamp: number }>
	> {
		return (await this.ctx.storage.get("events")) ?? [];
	}

	private async saveEvents(
		events: Array<{ eventName: string; data: Record<string, unknown>; timestamp: number }>,
	): Promise<void> {
		await this.ctx.storage.put("events", events);
	}

	override async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);

		if (url.pathname === "/commit" && request.method === "POST") {
			const body = (await request.json()) as {
				eventName: string;
				data: Record<string, unknown>;
			};
			const events = await this.loadEvents();
			events.push({ ...body, timestamp: Date.now() });
			await this.saveEvents(events);
			return Response.json({ success: true });
		}

		if (url.pathname === "/events") {
			const eventName = url.searchParams.get("eventName");
			const events = await this.loadEvents();
			const filtered = eventName
				? events.filter((e) => e.eventName === eventName)
				: events;
			return Response.json(filtered);
		}

		if (url.pathname === "/reset" && request.method === "POST") {
			await this.saveEvents([]);
			return Response.json({ success: true });
		}

		return Response.json({ error: "Not found" }, { status: 404 });
	}
}

export default {
	async fetch(request: Request, env: TestEnv): Promise<Response> {
		const url = new URL(request.url);

		if (url.pathname === "/api/plans/upload" && request.method === "POST") {
			try {
				const authHeader = request.headers.get("authorization");
				const authToken = authHeader?.replace("Bearer ", "");

				if (!authToken) {
					return Response.json({ error: "Missing authorization token" }, { status: 401 });
				}

				const sessionResult = await env.DB.prepare(
					"SELECT s.*, u.id as user_id, u.email, u.name FROM session s JOIN user u ON s.user_id = u.id WHERE s.token = ? AND s.expires_at > ?",
				)
					.bind(authToken, Date.now())
					.first<{ user_id: string; email: string; name?: string }>();

				if (!sessionResult) {
					return Response.json({ error: "Invalid or expired session" }, { status: 401 });
				}

				const formData = await request.formData();
				const file = formData.get("file") as File;
				const projectId = formData.get("projectId") as string;
				const organizationId = formData.get("organizationId") as string;

				if (!file || !projectId || !organizationId) {
					return Response.json(
						{ error: "Missing required fields: file, projectId, organizationId" },
						{ status: 400 },
					);
				}

				if (file.type !== "application/pdf") {
					return Response.json({ error: "File must be a PDF" }, { status: 400 });
				}

				// Use crypto.randomUUID() to avoid nanoid dynamic import issues in workerd
				const planId = crypto.randomUUID();
				const pdfPath = `organizations/${organizationId}/projects/${projectId}/plans/${planId}/source.pdf`;
				const totalPages = 1;
				const planName = file.name.replace(/\.pdf$/i, "");

				// Upload PDF to R2
				await env.R2_BUCKET.put(pdfPath, await file.arrayBuffer(), {
					httpMetadata: { contentType: "application/pdf" },
					customMetadata: { planId, projectId, organizationId, ...(planName ? { planName } : {}) },
				});

				// Trigger Workflow pipeline
				const instance = await env.PLAN_PROCESSING_WORKFLOW.create({
					id: planId,
					params: { planId, projectId, organizationId, pdfPath, totalPages, planName },
				});
				console.log(`[Upload] Workflow instance created: ${instance.id}`);

				// Commit planUploaded event via LiveStoreCollector
				const liveStoreStub = env.LIVESTORE_CLIENT_DO.get(
					env.LIVESTORE_CLIENT_DO.idFromName(organizationId),
				);
				await liveStoreStub.fetch("http://internal/commit?storeId=" + organizationId, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						eventName: "planUploaded",
						data: {
							id: planId,
							projectId,
							fileName: file.name,
							fileSize: file.size,
							mimeType: file.type,
							localPath: `file://plans/${planId}/source.pdf`,
							remotePath: pdfPath,
							uploadedBy: sessionResult.user_id,
							uploadedAt: Date.now(),
						},
					}),
				});

				return Response.json({
					success: true,
					planId,
					message: "Plan uploaded, processing started",
				});
			} catch (error) {
				console.error("Plan upload error:", error);
				return Response.json(
					{ error: error instanceof Error ? error.message : "Upload failed" },
					{ status: 500 },
				);
			}
		}

		// Serve R2 files (mirrors production handler for testing)
		if (url.pathname.startsWith("/api/r2/") && request.method === "GET") {
			const r2Path = decodeURIComponent(url.pathname.replace("/api/r2/", ""));
			if (!r2Path) {
				return Response.json({ error: "Missing path" }, { status: 400 });
			}

			const isImmutable = /\.(pmtiles|png|webp)$/i.test(r2Path);

			try {
				const rangeHeader = request.headers.get("Range");
				let rangeStart: number | undefined;
				let rangeEnd: number | undefined;

				if (rangeHeader) {
					const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
					if (match) {
						rangeStart = parseInt(match[1]!, 10);
						rangeEnd = match[2] ? parseInt(match[2]!, 10) : undefined;
					}
				}

				const object = await env.R2_BUCKET.get(
					r2Path,
					rangeStart !== undefined
						? {
								range:
									rangeEnd !== undefined
										? { offset: rangeStart, length: rangeEnd - rangeStart + 1 }
										: { offset: rangeStart },
							}
						: undefined,
				);

				if (!object) {
					return Response.json({ error: "Not found", path: r2Path }, { status: 404 });
				}

				const headers = new Headers();
				headers.set(
					"Content-Type",
					object.httpMetadata?.contentType || "application/octet-stream",
				);
				headers.set("Access-Control-Allow-Origin", "*");
				headers.set("Accept-Ranges", "bytes");
				headers.set(
					"Cache-Control",
					isImmutable ? "public, max-age=31536000, immutable" : "public, max-age=3600",
				);

				if (rangeStart !== undefined) {
					const end = rangeEnd !== undefined ? rangeEnd : object.size - 1;
					const length =
						rangeEnd !== undefined
							? rangeEnd - rangeStart + 1
							: object.size - rangeStart;
					headers.set("Content-Range", `bytes ${rangeStart}-${end}/${object.size}`);
					headers.set("Content-Length", String(length));
					return new Response(object.body, { status: 206, headers });
				}

				headers.set("Content-Length", String(object.size));
				return new Response(object.body, { headers });
			} catch (error) {
				console.error("[R2] Error fetching:", r2Path, error);
				return Response.json({ error: String(error) }, { status: 500 });
			}
		}

		return new Response("Test worker");
	},
};
