import { $ } from "bun";
import { existsSync, mkdirSync } from "fs";
import { dirname } from "path";
import type { ImageInfo } from "../types/hyperlinks";

/**
 * Convert PDF to image using VIPS CLI
 */
export async function convertPdfToImage(
  pdfPath: string,
  outputPath: string,
  dpi: number = 200
): Promise<ImageInfo> {
  // Check if PDF exists
  if (!existsSync(pdfPath)) {
    throw new Error(`PDF file not found: ${pdfPath}`);
  }

  // Ensure output directory exists
  const outputDir = dirname(outputPath);
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  try {
    // Use VIPS pdfload to convert PDF to PNG
    await $`vips pdfload ${pdfPath} ${outputPath} --dpi=${dpi}`;
    
    // Get image dimensions - try multiple methods
    let width = 0;
    let height = 0;
    
    try {
      // Method 1: Use vipsheader command
      const widthStr = (await $`vipsheader -f width ${outputPath}`.text()).trim();
      const heightStr = (await $`vipsheader -f height ${outputPath}`.text()).trim();
      width = parseInt(widthStr);
      height = parseInt(heightStr);
    } catch {
      // Method 2: Use vips im_header_int (older API)
      try {
        width = parseInt((await $`vips im_header_int ${outputPath} width`.text()).trim());
        height = parseInt((await $`vips im_header_int ${outputPath} height`.text()).trim());
      } catch {
        // Method 3: Read image file directly (fallback)
        // This would require additional image reading library
        // For now, we'll throw an error
        throw new Error("Could not determine image dimensions from VIPS");
      }
    }
    
    if (width === 0 || height === 0 || isNaN(width) || isNaN(height)) {
      throw new Error("Invalid image dimensions from VIPS");
    }
    
    return { path: outputPath, width, height, dpi };
  } catch (error: any) {
    if (error.message?.includes("No such file") ||
        error.message?.includes("not found")) {
      throw new Error(`VIPS command failed: ${error.message}. Make sure vips is installed.`);
    }
    throw new Error(`Failed to convert PDF to image: ${error.message}`);
  }
}

