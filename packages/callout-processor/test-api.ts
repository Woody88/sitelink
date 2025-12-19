#!/usr/bin/env bun
/**
 * Simple test script for the callout-processor REST API
 *
 * Usage:
 *   1. Start the server: bun run dev
 *   2. Run this test: bun run test-api.ts path/to/sheet.pdf
 */

const API_BASE = "http://localhost:8000"

async function testHealthCheck() {
  console.log("\n1. Testing health check...")
  const response = await fetch(`${API_BASE}/health`)
  const data = await response.json()
  console.log(`   Status: ${response.status}`)
  console.log(`   Response:`, data)
  return response.ok
}

async function testExtractMetadata(pdfPath: string) {
  console.log("\n2. Testing metadata extraction...")
  const file = Bun.file(pdfPath)
  const buffer = await file.arrayBuffer()

  const response = await fetch(`${API_BASE}/api/extract-metadata`, {
    method: "POST",
    headers: {
      "Content-Type": "application/pdf",
    },
    body: buffer,
  })

  const data = await response.json()
  console.log(`   Status: ${response.status}`)
  console.log(`   Sheet Number: ${data.sheet_number}`)
  console.log(`   Dimensions: ${data.metadata?.width}x${data.metadata?.height}`)
  console.log(`   Title: ${data.metadata?.title || "N/A"}`)
  return response.ok
}

async function testDetectMarkers(pdfPath: string) {
  console.log("\n3. Testing marker detection...")
  const file = Bun.file(pdfPath)
  const buffer = await file.arrayBuffer()

  const response = await fetch(`${API_BASE}/api/detect-markers`, {
    method: "POST",
    headers: {
      "Content-Type": "application/pdf",
      "X-Valid-Sheets": "A1,A2,A3,A4,A5,A6,A7",
      "X-Sheet-Number": "A2",
    },
    body: buffer,
  })

  const data = await response.json()
  console.log(`   Status: ${response.status}`)
  console.log(`   Total Detected: ${data.total_detected}`)
  console.log(`   Processing Time: ${data.processing_time_ms}ms`)

  if (data.markers && data.markers.length > 0) {
    console.log(`\n   Markers:`)
    for (const marker of data.markers) {
      console.log(`     - ${marker.text} @ (${marker.bbox.x.toFixed(4)}, ${marker.bbox.y.toFixed(4)}) [confidence: ${(marker.confidence * 100).toFixed(1)}%]`)
    }
  }

  return response.ok
}

async function main() {
  const pdfPath = process.argv[2]

  if (!pdfPath) {
    console.error("Usage: bun run test-api.ts <path-to-pdf>")
    process.exit(1)
  }

  console.log("Testing Callout Processor API")
  console.log("==============================")
  console.log(`PDF: ${pdfPath}`)

  try {
    // Test health check
    const healthOk = await testHealthCheck()
    if (!healthOk) {
      console.error("\n❌ Health check failed - is the server running?")
      process.exit(1)
    }

    // Test metadata extraction
    const metadataOk = await testExtractMetadata(pdfPath)
    if (!metadataOk) {
      console.error("\n❌ Metadata extraction failed")
    }

    // Test marker detection
    const markersOk = await testDetectMarkers(pdfPath)
    if (!markersOk) {
      console.error("\n❌ Marker detection failed")
    }

    console.log("\n✅ API tests complete")
  } catch (error) {
    console.error("\n❌ Error:", error)
    process.exit(1)
  }
}

main()
