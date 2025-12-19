import { tmpdir } from "os"
import { join } from "path"
import { writeFile, unlink } from "fs/promises"
import { convertPdfToImage } from "../../services/pdfProcessor"
import { analyzeTitleBlock } from "../../services/titleBlockAnalysis"

export async function metadataHandler(request: Request): Promise<Response> {
  // Validate content type
  const contentType = request.headers.get("content-type")
  if (!contentType?.includes("application/pdf")) {
    return Response.json({ error: "Content-Type must be application/pdf" }, { status: 400 })
  }

  // Get PDF body
  const pdfBuffer = await request.arrayBuffer()
  if (!pdfBuffer || pdfBuffer.byteLength === 0) {
    return Response.json({ error: "Empty PDF body" }, { status: 400 })
  }

  // Process PDF and extract metadata
  const tempPdfPath = join(tmpdir(), `sheet-${Date.now()}.pdf`)
  let tempPngPath: string | null = null

  try {
    // Save PDF to temp file
    await writeFile(tempPdfPath, Buffer.from(pdfBuffer))

    // Convert to PNG
    tempPngPath = join(tmpdir(), `sheet-${Date.now()}.png`)
    const imageInfo = await convertPdfToImage(tempPdfPath, tempPngPath, 300)

    // Extract sheet number from title block
    const titleBlockInfo = await analyzeTitleBlock(imageInfo)

    return Response.json({
      sheet_number: titleBlockInfo.sheetNumber || "UNKNOWN",
      metadata: {
        width: imageInfo.width,
        height: imageInfo.height,
        dpi: imageInfo.dpi,
        title: titleBlockInfo.sheetTitle,
        notes: titleBlockInfo.notes,
        titleBlockLocation: titleBlockInfo.titleBlockLocation
      }
    })
  } catch (error) {
    console.error("Metadata extraction error:", error)
    return Response.json({ error: "Failed to extract metadata" }, { status: 500 })
  } finally {
    // Cleanup temp files
    await unlink(tempPdfPath).catch(() => {})
    if (tempPngPath) {
      await unlink(tempPngPath).catch(() => {})
    }
  }
}
