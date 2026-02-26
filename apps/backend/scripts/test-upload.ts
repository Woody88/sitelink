#!/usr/bin/env bun

import { readFileSync } from "node:fs";
import { join } from "node:path";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8787";

async function testUpload() {
	const fixturePath = join(
		import.meta.dir,
		"../tests/fixtures/sample-plan.pdf",
	);

	console.log("📄 Reading PDF from:", fixturePath);
	const pdfBuffer = readFileSync(fixturePath);
	console.log(`   Size: ${pdfBuffer.byteLength} bytes`);

	const formData = new FormData();
	formData.append(
		"file",
		new Blob([pdfBuffer], { type: "application/pdf" }),
		"sample-plan.pdf",
	);
	formData.append("projectId", "test-project-123");
	formData.append("organizationId", "test-org-456");
	formData.append("totalPages", "6");

	console.log("\n🚀 Uploading to:", `${BACKEND_URL}/api/test/upload-pdf`);

	const response = await fetch(`${BACKEND_URL}/api/test/upload-pdf`, {
		method: "POST",
		body: formData,
	});

	const result = await response.json();

	if (response.ok) {
		console.log("\n✅ Upload successful!");
		console.log("   Plan ID:", result.planId);
		console.log("   R2 Path:", result.pdfPath);
		console.log("   File Size:", result.fileSize, "bytes");
		console.log("   Total Pages:", result.totalPages);
		console.log("\n📊 Check localflare R2 bucket to see the uploaded file");
	} else {
		console.error("\n❌ Upload failed:", result);
	}
}

testUpload().catch(console.error);
