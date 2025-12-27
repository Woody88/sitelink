import { $ } from "bun";
import { join } from "path";
import { parseTesseractTSV, type TesseractWord } from "./calloutTesseract";

/**
 * OCR Engine type
 */
export type OCREngine = "tesseract" | "paddleocr";

/**
 * OCR Adapter - allows swapping between Tesseract and PaddleOCR
 */
export interface OCRAdapter {
  /**
   * Extract text with bounding boxes from an image
   */
  extractText(imagePath: string): Promise<TesseractWord[]>;
  
  /**
   * Extract text from a cropped region
   * @param preprocess - Optional preprocessing: 'invert' (for black bg/white text), 'contrast' (enhance contrast), or 'none'
   */
  extractTextFromRegion(
    imagePath: string,
    bbox: { x1: number; y1: number; x2: number; y2: number },
    padding?: number,
    preprocess?: 'invert' | 'contrast' | 'none'
  ): Promise<TesseractWord[]>;
}

/**
 * Tesseract OCR implementation
 */
class TesseractAdapter implements OCRAdapter {
  async extractText(imagePath: string): Promise<TesseractWord[]> {
    try {
      const { stdout } = await $`tesseract ${imagePath} stdout -l eng tsv`.quiet();
      const tsv = stdout.toString();
      return this.parseTSV(tsv);
    } catch (error) {
      console.error(`Tesseract OCR failed: ${error}`);
      return [];
    }
  }

  async extractTextFromRegion(
    imagePath: string,
    bbox: { x1: number; y1: number; x2: number; y2: number },
    padding: number = 20,
    preprocess: 'invert' | 'contrast' | 'none' = 'none'
  ): Promise<TesseractWord[]> {
    // For Tesseract, we need to crop the image first
    const sharp = (await import("sharp")).default;
    
    const left = Math.max(0, bbox.x1 - padding);
    const top = Math.max(0, bbox.y1 - padding);
    const width = bbox.x2 - bbox.x1 + (padding * 2);
    const height = bbox.y2 - bbox.y1 + (padding * 2);
    
    const image = sharp(imagePath);
    const metadata = await image.metadata();
    
    const actualLeft = Math.max(0, left);
    const actualTop = Math.max(0, top);
    const actualWidth = Math.min(width, (metadata.width || 0) - actualLeft);
    const actualHeight = Math.min(height, (metadata.height || 0) - actualTop);
    
    const tempPath = `/tmp/tesseract-region-${Date.now()}.png`;
    let pipeline = image
      .extract({
        left: actualLeft,
        top: actualTop,
        width: actualWidth,
        height: actualHeight
      });
    
    // Apply preprocessing if requested
    if (preprocess === 'invert') {
      // Invert colors (black background -> white, white text -> black)
      pipeline = pipeline.negate();
    } else if (preprocess === 'contrast') {
      // Enhance contrast
      pipeline = pipeline.modulate({ brightness: 1.1, saturation: 1.1 });
    }
    
    await pipeline.png().toFile(tempPath);
    
    try {
      const { stdout } = await $`tesseract ${tempPath} stdout -l eng tsv`.quiet();
      const tsv = stdout.toString();
      const words = parseTesseractTSV(tsv);
      
      // Adjust coordinates back to full image space
      return words.map(word => ({
        ...word,
        left: word.left + actualLeft,
        top: word.top + actualTop
      }));
    } finally {
      try {
        await Bun.file(tempPath).unlink();
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  }

  private parseTSV(tsv: string): TesseractWord[] {
    return parseTesseractTSV(tsv);
  }
}

/**
 * PaddleOCR implementation
 */
class PaddleOCRAdapter implements OCRAdapter {
  private scriptPath: string;

  constructor() {
    this.scriptPath = join(import.meta.dir, "paddleOCR.py");
  }

  async extractText(imagePath: string): Promise<TesseractWord[]> {
    try {
      const { stdout, stderr } = await $`python3 ${this.scriptPath} ${imagePath}`.quiet();
      
      if (stderr.toString().trim()) {
        const error = JSON.parse(stderr.toString());
        if (error.error) {
          throw new Error(error.error);
        }
      }
      
      const result = JSON.parse(stdout.toString());
      
      if (Array.isArray(result) && result.length > 0 && result[0].error) {
        throw new Error(result[0].error);
      }
      
      return result as TesseractWord[];
    } catch (error) {
      console.error(`PaddleOCR failed: ${error}`);
      return [];
    }
  }

  async extractTextFromRegion(
    imagePath: string,
    bbox: { x1: number; y1: number; x2: number; y2: number },
    padding: number = 20,
    preprocess: 'invert' | 'contrast' | 'none' = 'none'
  ): Promise<TesseractWord[]> {
    // For PaddleOCR, we also need to crop the image first
    const sharp = (await import("sharp")).default;
    
    const left = Math.max(0, bbox.x1 - padding);
    const top = Math.max(0, bbox.y1 - padding);
    const width = bbox.x2 - bbox.x1 + (padding * 2);
    const height = bbox.y2 - bbox.y1 + (padding * 2);
    
    const image = sharp(imagePath);
    const metadata = await image.metadata();
    
    const actualLeft = Math.max(0, left);
    const actualTop = Math.max(0, top);
    const actualWidth = Math.min(width, (metadata.width || 0) - actualLeft);
    const actualHeight = Math.min(height, (metadata.height || 0) - actualTop);
    
    const tempPath = `/tmp/paddleocr-region-${Date.now()}.png`;
    let pipeline = image
      .extract({
        left: actualLeft,
        top: actualTop,
        width: actualWidth,
        height: actualHeight
      });
    
    // Apply preprocessing if requested
    if (preprocess === 'invert') {
      pipeline = pipeline.negate();
    } else if (preprocess === 'contrast') {
      pipeline = pipeline.modulate({ brightness: 1.1, saturation: 1.1 });
    }
    
    await pipeline.png().toFile(tempPath);
    
    try {
      const words = await this.extractText(tempPath);
      
      // Adjust coordinates back to full image space
      return words.map(word => ({
        ...word,
        left: word.left + actualLeft,
        top: word.top + actualTop
      }));
    } finally {
      try {
        await Bun.file(tempPath).unlink();
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  }
}

/**
 * Factory function to create OCR adapter
 */
export function createOCRAdapter(engine: OCREngine = "tesseract"): OCRAdapter {
  switch (engine) {
    case "tesseract":
      return new TesseractAdapter();
    case "paddleocr":
      return new PaddleOCRAdapter();
    default:
      throw new Error(`Unknown OCR engine: ${engine}`);
  }
}

/**
 * Check if PaddleOCR is available
 */
export async function isPaddleOCRAvailable(): Promise<boolean> {
  try {
    const { stdout } = await $`python3 -c "import paddleocr; print('ok')"`.quiet();
    return stdout.toString().trim() === "ok";
  } catch {
    return false;
  }
}

