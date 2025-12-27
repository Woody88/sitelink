import { tmpdir } from "os"
import { join } from "path"
import { writeFile, unlink, rm } from "fs/promises"
import { detectCalloutsWithCVLLM } from "../../services/cvLLMDetection"

export async function markersHandler(request: Request): Promise<Response> {
  // Validate content type
  const contentType = request.headers.get("content-type")
  if (!contentType?.includes("application/pdf")) {
    return Response.json({ error: "Content-Type must be application/pdf" }, { status: 400 })
  }

  // Get headers
  const validSheetsHeader = request.headers.get("x-valid-sheets") || ""
  const validSheets = validSheetsHeader.split(",").map(s => s.trim()).filter(Boolean)
  const sheetNumber = request.headers.get("x-sheet-number") || ""

  // Get PDF body
  const pdfBuffer = await request.arrayBuffer()
  if (!pdfBuffer || pdfBuffer.byteLength === 0) {
    return Response.json({ error: "Empty PDF body" }, { status: 400 })
  }

  const tempPdfPath = join(tmpdir(), `markers-${Date.now()}.pdf`)
  const tempOutputDir = join(tmpdir(), `markers-output-${Date.now()}`)

  try {
    await writeFile(tempPdfPath, Buffer.from(pdfBuffer))

    // Use existing detection pipeline
    const result = await detectCalloutsWithCVLLM(
      tempPdfPath,
      validSheets,
      tempOutputDir,
      300,
      undefined,
      "google/gemini-2.5-flash",
      sheetNumber || undefined
    )

    // Map to expected response format (matching queue handler expectations)
    // Use actual bbox dimensions from CV detection if available, otherwise use small default
    // Callout symbols are typically ~30-40px on a ~3000px image = ~0.012 (1.2%)
    const markers = (result.hyperlinks || []).map((h: any) => ({
      marker_text: h.calloutRef,
      detail: h.calloutRef.split("/")[0] || "",
      sheet: h.targetSheetRef,
      marker_type: "detail",
      confidence: h.confidence || 0.8,
      is_valid: validSheets.length === 0 || validSheets.includes(h.targetSheetRef),
      fuzzy_matched: false,
      bbox: {
        x: h.x,
        y: h.y,
        w: h.w || 0.012,  // Use CV bbox width or small default (~1.2% of image)
        h: h.h || 0.012,  // Use CV bbox height or small default (~1.2% of image)
      },
    }))

    return Response.json({
      markers,
      total_detected: markers.length,
      processing_time_ms: result.processingTimeMs || 0,
    })
  } catch (error) {
    console.error("Marker detection error:", error)
    return Response.json({ error: "Failed to detect markers" }, { status: 500 })
  } finally {
    // Cleanup temp files
    await unlink(tempPdfPath).catch(() => {})
    await rm(tempOutputDir, { recursive: true, force: true }).catch(() => {})
  }
}
