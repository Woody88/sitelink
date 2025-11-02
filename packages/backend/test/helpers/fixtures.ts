import { env } from "cloudflare:test"

/**
 * Load the sample construction plan PDF from fixtures
 * Uses FIXTURE_LOADER service binding to read files from Node.js context
 *
 * @returns PDF data as Uint8Array
 */
export async function loadSamplePDF(): Promise<Uint8Array> {
	const response = await env.FIXTURE_LOADER.fetch(
		new Request("http://localhost/test/fixtures/sample-plan.pdf"),
	)

	if (!response.ok) {
		throw new Error(`Failed to load fixture: ${await response.text()}`)
	}

	const buffer = await response.arrayBuffer()
	return new Uint8Array(buffer)
}

/**
 * Create a minimal valid PDF for tests that don't need real content
 * This is faster and lighter weight than loading the full sample PDF
 *
 * @returns Minimal PDF data as Uint8Array
 */
export function createMinimalPDF(): Uint8Array {
	const pdfContent = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /Resources 4 0 R /MediaBox [0 0 612 792] /Contents 5 0 R >>
endobj
4 0 obj
<< /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >>
endobj
5 0 obj
<< /Length 44 >>
stream
BT
/F1 12 Tf
100 700 Td
(Test PDF) Tj
ET
endstream
endobj
xref
0 6
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000229 00000 n
0000000327 00000 n
trailer
<< /Size 6 /Root 1 0 R >>
startxref
420
%%EOF`
	return new TextEncoder().encode(pdfContent)
}
