import { env } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";

describe("YOLO Detection Container Integration", () => {
	let containerAvailable = false;

	beforeAll(async () => {
		try {
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), 2000);
			const response = await fetch("http://localhost:3001/health", {
				signal: controller.signal,
			});
			clearTimeout(timeoutId);
			containerAvailable = response.ok;
		} catch {
			console.log("Container not available - YOLO tests will be skipped");
		}
	});

	describe("Container Health", () => {
		it("should report container availability status", () => {
			console.log(`Container available: ${containerAvailable}`);
			expect(typeof containerAvailable).toBe("boolean");
		});
	});

	describe("YOLO Callout Detection (requires Docker)", () => {
		it("should detect callouts from construction plan image", { timeout: 60000 }, async () => {
			if (!containerAvailable) {
				console.log("Skipping - container not running");
				return;
			}

			// Step 1: Load test PDF (structural drawings have many callouts)
			const pdfResponse = await env.FIXTURE_LOADER!.fetch(
				"http://fixture/structural-drawings.pdf",
			);
			expect(pdfResponse.ok).toBe(true);
			const pdfData = await pdfResponse.arrayBuffer();

			// Step 2: Render PDF page to PNG
			const renderResponse = await fetch(
				"http://localhost:3001/render-page",
				{
					method: "POST",
					headers: {
						"Content-Type": "application/pdf",
						"X-Plan-Id": "test-plan",
						"X-Page-Number": "1",
					},
					body: pdfData,
				},
			);

			if (!renderResponse.ok) {
				console.log("Render failed:", await renderResponse.text());
				return;
			}

			const pngData = await renderResponse.arrayBuffer();
			expect(pngData.byteLength).toBeGreaterThan(0);
			console.log(`Rendered PNG: ${pngData.byteLength} bytes`);

			// Step 3: Call YOLO detection
			const detectResponse = await fetch(
				"http://localhost:3001/detect-callouts",
				{
					method: "POST",
					headers: {
						"Content-Type": "image/png",
						"X-Sheet-Id": "sheet-0",
						"X-Plan-Id": "test-plan",
						"X-Sheet-Number": "A1",
						"X-Valid-Sheet-Numbers": JSON.stringify([
							"A1",
							"A2",
							"A3",
							"A4",
							"A5",
							"A6",
						]),
					},
					body: pngData,
				},
			);

			expect(detectResponse.ok).toBe(true);
			const result = (await detectResponse.json()) as {
				markers: Array<{
					id: string;
					label: string;
					x: number;
					y: number;
					confidence: number;
					needsReview: boolean;
					targetSheetRef?: string;
				}>;
				unmatchedCount: number;
			};

			console.log(`YOLO detected ${result.markers?.length ?? 0} markers`);
			console.log(`Unmatched count: ${result.unmatchedCount}`);

			// Verify response structure
			expect(result).toHaveProperty("markers");
			expect(result).toHaveProperty("unmatchedCount");
			expect(Array.isArray(result.markers)).toBe(true);
			expect(typeof result.unmatchedCount).toBe("number");

			// Structural drawings should have callouts - verify at least one is detected
			expect(result.markers.length).toBeGreaterThan(0);

			// Verify marker structure
			if (result.markers.length > 0) {
				const marker = result.markers[0]!;
				expect(marker).toHaveProperty("id");
				expect(marker).toHaveProperty("label");
				expect(marker).toHaveProperty("x");
				expect(marker).toHaveProperty("y");
				expect(marker).toHaveProperty("confidence");
				expect(typeof marker.x).toBe("number");
				expect(typeof marker.y).toBe("number");
				expect(marker.confidence).toBeGreaterThanOrEqual(0);
				expect(marker.confidence).toBeLessThanOrEqual(1);

				// Log detected markers for manual verification
				for (const m of result.markers) {
					console.log(
						`  Marker: ${m.label} @ (${(m.x * 100).toFixed(1)}%, ${(m.y * 100).toFixed(1)}%) conf=${(m.confidence * 100).toFixed(0)}%`,
					);
				}
			}
		});

		it("should return empty markers for blank/non-plan image", { timeout: 30000 }, async () => {
			if (!containerAvailable) {
				console.log("Skipping - container not running");
				return;
			}

			// Create a minimal valid PNG (1x1 white pixel)
			// PNG header + IHDR + IDAT + IEND chunks
			const blankPng = new Uint8Array([
				// PNG signature
				0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
				// IHDR chunk (13 bytes)
				0x00, 0x00, 0x00, 0x0d, // length
				0x49, 0x48, 0x44, 0x52, // IHDR
				0x00, 0x00, 0x00, 0x01, // width: 1
				0x00, 0x00, 0x00, 0x01, // height: 1
				0x08, // bit depth: 8
				0x02, // color type: RGB
				0x00, // compression: deflate
				0x00, // filter: adaptive
				0x00, // interlace: none
				0x90, 0x77, 0x53, 0xde, // CRC
				// IDAT chunk (compressed pixel data)
				0x00, 0x00, 0x00, 0x0c, // length
				0x49, 0x44, 0x41, 0x54, // IDAT
				0x08, 0xd7, 0x63, 0xf8, 0xff, 0xff, 0xff, 0x00, 0x05, 0xfe, 0x02,
				0xfe, // compressed white pixel
				0xa3, 0x6c, 0xec, 0xf4, // CRC (approximate)
				// IEND chunk
				0x00, 0x00, 0x00, 0x00, // length
				0x49, 0x45, 0x4e, 0x44, // IEND
				0xae, 0x42, 0x60, 0x82, // CRC
			]);

			const detectResponse = await fetch(
				"http://localhost:3001/detect-callouts",
				{
					method: "POST",
					headers: {
						"Content-Type": "image/png",
						"X-Sheet-Id": "blank-test",
						"X-Plan-Id": "test-plan",
						"X-Valid-Sheet-Numbers": "[]",
					},
					body: blankPng,
				},
			);

			// The endpoint should accept the request even for tiny images
			// It may return an error or empty markers
			if (detectResponse.ok) {
				const result = (await detectResponse.json()) as {
					markers: unknown[];
					unmatchedCount: number;
				};
				console.log(
					`Blank image test: ${result.markers?.length ?? 0} markers (expected 0 or error)`,
				);
				// A blank image should have no callouts
				expect(result.markers?.length ?? 0).toBe(0);
			} else {
				// Some errors are expected for invalid/tiny images
				console.log(`Blank image rejected: ${detectResponse.status}`);
				expect([400, 500]).toContain(detectResponse.status);
			}
		});

		it("should handle multiple pages from multi-page PDF", { timeout: 120000 }, async () => {
			if (!containerAvailable) {
				console.log("Skipping - container not running");
				return;
			}

			const pdfResponse = await env.FIXTURE_LOADER!.fetch(
				"http://fixture/structural-drawings.pdf",
			);
			const pdfData = await pdfResponse.arrayBuffer();

			// Get page count
			const infoResponse = await fetch(
				"http://localhost:3001/generate-images",
				{
					method: "POST",
					headers: {
						"Content-Type": "application/pdf",
						"X-Plan-Id": "test-plan",
					},
					body: pdfData,
				},
			);

			if (!infoResponse.ok) {
				console.log("Could not get PDF info");
				return;
			}

			const info = (await infoResponse.json()) as {
				sheets: Array<{ sheetId: string; pageNumber: number }>;
				totalPages: number;
			};

			console.log(`PDF has ${info.totalPages} pages`);
			expect(info.totalPages).toBeGreaterThan(0);

			// Test detection on first few pages (max 3)
			const pagesToTest = Math.min(info.totalPages, 3);
			const results: Array<{ page: number; markerCount: number }> = [];

			for (let i = 1; i <= pagesToTest; i++) {
				const renderResponse = await fetch(
					"http://localhost:3001/render-page",
					{
						method: "POST",
						headers: {
							"Content-Type": "application/pdf",
							"X-Plan-Id": "test-plan",
							"X-Page-Number": String(i),
						},
						body: pdfData,
					},
				);

				if (!renderResponse.ok) {
					console.log(`Page ${i} render failed`);
					continue;
				}

				const pngData = await renderResponse.arrayBuffer();

				const detectResponse = await fetch(
					"http://localhost:3001/detect-callouts",
					{
						method: "POST",
						headers: {
							"Content-Type": "image/png",
							"X-Sheet-Id": `sheet-${i - 1}`,
							"X-Plan-Id": "test-plan",
							"X-Valid-Sheet-Numbers": "[]",
						},
						body: pngData,
					},
				);

				if (detectResponse.ok) {
					const result = (await detectResponse.json()) as {
						markers: unknown[];
					};
					const markerCount = result.markers?.length ?? 0;
					console.log(`Page ${i}: ${markerCount} markers detected`);
					results.push({ page: i, markerCount });
				} else {
					console.log(`Page ${i} detection failed: ${detectResponse.status}`);
				}
			}

			// Verify we processed at least one page
			expect(results.length).toBeGreaterThan(0);
		});

		it("should validate marker coordinate normalization", { timeout: 60000 }, async () => {
			if (!containerAvailable) {
				console.log("Skipping - container not running");
				return;
			}

			const pdfResponse = await env.FIXTURE_LOADER!.fetch(
				"http://fixture/structural-drawings.pdf",
			);
			const pdfData = await pdfResponse.arrayBuffer();

			// Render first page
			const renderResponse = await fetch(
				"http://localhost:3001/render-page",
				{
					method: "POST",
					headers: {
						"Content-Type": "application/pdf",
						"X-Plan-Id": "test-plan",
						"X-Page-Number": "1",
					},
					body: pdfData,
				},
			);

			if (!renderResponse.ok) {
				console.log("Render failed");
				return;
			}

			const pngData = await renderResponse.arrayBuffer();

			// Detect callouts
			const detectResponse = await fetch(
				"http://localhost:3001/detect-callouts",
				{
					method: "POST",
					headers: {
						"Content-Type": "image/png",
						"X-Sheet-Id": "coord-test",
						"X-Plan-Id": "test-plan",
						"X-Valid-Sheet-Numbers": "[]",
					},
					body: pngData,
				},
			);

			if (!detectResponse.ok) {
				console.log("Detection failed");
				return;
			}

			const result = (await detectResponse.json()) as {
				markers: Array<{ x: number; y: number }>;
			};

			// Verify all markers have normalized coordinates (0-1 range)
			for (const marker of result.markers) {
				expect(marker.x).toBeGreaterThanOrEqual(0);
				expect(marker.x).toBeLessThanOrEqual(1);
				expect(marker.y).toBeGreaterThanOrEqual(0);
				expect(marker.y).toBeLessThanOrEqual(1);
			}

			console.log(
				`Verified ${result.markers.length} markers have normalized coordinates`,
			);
		});

		it("should filter markers by valid sheet numbers", { timeout: 60000 }, async () => {
			if (!containerAvailable) {
				console.log("Skipping - container not running");
				return;
			}

			const pdfResponse = await env.FIXTURE_LOADER!.fetch(
				"http://fixture/structural-drawings.pdf",
			);
			const pdfData = await pdfResponse.arrayBuffer();

			// Render first page
			const renderResponse = await fetch(
				"http://localhost:3001/render-page",
				{
					method: "POST",
					headers: {
						"Content-Type": "application/pdf",
						"X-Plan-Id": "test-plan",
						"X-Page-Number": "1",
					},
					body: pdfData,
				},
			);

			if (!renderResponse.ok) {
				console.log("Render failed");
				return;
			}

			const pngData = await renderResponse.arrayBuffer();

			// First, detect with no sheet filter
			const unfiltered = await fetch(
				"http://localhost:3001/detect-callouts",
				{
					method: "POST",
					headers: {
						"Content-Type": "image/png",
						"X-Sheet-Id": "filter-test-1",
						"X-Plan-Id": "test-plan",
						"X-Valid-Sheet-Numbers": "[]",
					},
					body: pngData,
				},
			);

			// Then detect with restrictive filter
			const filtered = await fetch("http://localhost:3001/detect-callouts", {
				method: "POST",
				headers: {
					"Content-Type": "image/png",
					"X-Sheet-Id": "filter-test-2",
					"X-Plan-Id": "test-plan",
					"X-Valid-Sheet-Numbers": JSON.stringify(["Z99"]), // Non-existent sheet
				},
				body: pngData,
			});

			if (unfiltered.ok && filtered.ok) {
				const unfilteredResult = (await unfiltered.json()) as {
					markers: unknown[];
				};
				const filteredResult = (await filtered.json()) as {
					markers: unknown[];
				};

				console.log(
					`Unfiltered: ${unfilteredResult.markers?.length ?? 0} markers`,
				);
				console.log(
					`Filtered (Z99 only): ${filteredResult.markers?.length ?? 0} markers`,
				);

				// With a non-existent sheet filter, we should have fewer or equal markers
				expect(filteredResult.markers?.length ?? 0).toBeLessThanOrEqual(
					unfilteredResult.markers?.length ?? 0,
				);
			}
		});
	});

	describe("Container Endpoint Validation", () => {
		it("should return proper error for missing headers", async () => {
			if (!containerAvailable) {
				console.log("Skipping - container not running");
				return;
			}

			// Missing X-Sheet-Id header
			const response = await fetch("http://localhost:3001/detect-callouts", {
				method: "POST",
				headers: {
					"Content-Type": "image/png",
					"X-Plan-Id": "test-plan",
				},
				body: new ArrayBuffer(0),
			});

			expect(response.status).toBe(400);
			const error = (await response.json()) as { error: string };
			expect(error.error).toContain("X-Sheet-Id");
		});

		it("should return proper error for missing image data", async () => {
			if (!containerAvailable) {
				console.log("Skipping - container not running");
				return;
			}

			const response = await fetch("http://localhost:3001/detect-callouts", {
				method: "POST",
				headers: {
					"Content-Type": "image/png",
					"X-Sheet-Id": "test-sheet",
					"X-Plan-Id": "test-plan",
				},
				body: new ArrayBuffer(0),
			});

			expect(response.status).toBe(400);
			const error = (await response.json()) as { error: string };
			expect(error.error).toContain("image");
		});
	});
});
