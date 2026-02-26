import { env, SELF } from "cloudflare:test";
import { describe, expect, it, beforeAll } from "vitest";

const TEST_PATH = "organizations/test-org/projects/test-proj/plans/test-plan/sheets/s1/tiles.pmtiles";
const TEST_PDF_PATH = "organizations/test-org/projects/test-proj/plans/test-plan/source.pdf";

describe("R2 range requests", () => {
	beforeAll(async () => {
		const content = new Uint8Array(32768);
		for (let i = 0; i < content.length; i++) content[i] = i % 256;
		await env.R2_BUCKET.put(TEST_PATH, content.buffer, {
			httpMetadata: { contentType: "application/octet-stream" },
		});
		await env.R2_BUCKET.put(TEST_PDF_PATH, content.buffer.slice(0, 1024), {
			httpMetadata: { contentType: "application/pdf" },
		});
	});

	it("returns full file with 200 when no Range header", async () => {
		const res = await SELF.fetch(`http://localhost/api/r2/${TEST_PATH}`);
		expect(res.status).toBe(200);
		expect(res.headers.get("Content-Length")).toBe("32768");
		expect(res.headers.get("Accept-Ranges")).toBe("bytes");
		const body = await res.arrayBuffer();
		expect(body.byteLength).toBe(32768);
	});

	it("returns 206 with correct bytes for Range request", async () => {
		const res = await SELF.fetch(`http://localhost/api/r2/${TEST_PATH}`, {
			headers: { Range: "bytes=0-16383" },
		});
		expect(res.status).toBe(206);
		expect(res.headers.get("Content-Range")).toBe("bytes 0-16383/32768");
		expect(res.headers.get("Content-Length")).toBe("16384");
		const body = await res.arrayBuffer();
		expect(body.byteLength).toBe(16384);

		const bytes = new Uint8Array(body);
		expect(bytes[0]).toBe(0);
		expect(bytes[255]).toBe(255);
	});

	it("returns correct bytes for mid-file Range request", async () => {
		const res = await SELF.fetch(`http://localhost/api/r2/${TEST_PATH}`, {
			headers: { Range: "bytes=256-511" },
		});
		expect(res.status).toBe(206);
		expect(res.headers.get("Content-Range")).toBe("bytes 256-511/32768");
		expect(res.headers.get("Content-Length")).toBe("256");
		const body = new Uint8Array(await res.arrayBuffer());
		expect(body[0]).toBe(0);
		expect(body[255]).toBe(255);
	});

	it("handles open-ended Range (bytes=N-)", async () => {
		const res = await SELF.fetch(`http://localhost/api/r2/${TEST_PATH}`, {
			headers: { Range: "bytes=32000-" },
		});
		expect(res.status).toBe(206);
		expect(res.headers.get("Content-Range")).toBe("bytes 32000-32767/32768");
		expect(res.headers.get("Content-Length")).toBe("768");
		const body = await res.arrayBuffer();
		expect(body.byteLength).toBe(768);
	});

	it("returns 404 for non-existent path", async () => {
		const res = await SELF.fetch("http://localhost/api/r2/nonexistent/file.pmtiles");
		expect(res.status).toBe(404);
	});

	it("sets immutable cache headers for .pmtiles files", async () => {
		const res = await SELF.fetch(`http://localhost/api/r2/${TEST_PATH}`);
		expect(res.headers.get("Cache-Control")).toBe("public, max-age=31536000, immutable");
	});

	it("sets short cache headers for non-tile files", async () => {
		const res = await SELF.fetch(`http://localhost/api/r2/${TEST_PDF_PATH}`);
		expect(res.headers.get("Cache-Control")).toBe("public, max-age=3600");
	});

	it("sets CORS and Accept-Ranges headers", async () => {
		const res = await SELF.fetch(`http://localhost/api/r2/${TEST_PATH}`);
		expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
		expect(res.headers.get("Accept-Ranges")).toBe("bytes");
	});
});
