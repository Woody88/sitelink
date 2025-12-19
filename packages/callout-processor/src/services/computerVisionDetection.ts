import { $ } from "bun";
import { convertPdfToImage } from "./pdfProcessor";
import { extractCalloutPatterns, type TesseractWord } from "./calloutTesseract";
import { calculateCalloutConfidence } from "../utils/confidenceScoring";
import { normalizeCoordinates } from "../utils/coordinates";
import type { DetectedCallout, ImageInfo, AnalysisResult } from "../types/hyperlinks";
import { join } from "path";
import { createOCRAdapter, type OCREngine } from "./ocrAdapter";

/**
 * Computer Vision-based detection: Detect shapes first, then extract text
 * 
 * Strategy:
 * 1. Use OpenCV (via Python) to detect circles and triangles
 * 2. Extract text from each detected shape using OCR
 * 3. Validate text matches callout patterns
 * 4. Use precise shape positions for coordinates
 * 
 * This is more robust than LLM-based detection because:
 * - Detects actual geometric shapes, not text patterns
 * - Works across different plan styles
 * - Provides precise pixel coordinates
 */

interface DetectedShape {
  type: "circle" | "triangle";
  x: number;
  y: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  radius?: number;
}

/**
 * Detect shapes using OpenCV (via Python script)
 */
async function detectShapes(imagePath: string, dpi: number): Promise<DetectedShape[]> {
  const scriptPath = join(import.meta.dir, "shapeDetection.py");
  
  try {
    const { stdout } = await $`python3 ${scriptPath} ${imagePath} ${dpi}`.quiet();
    const shapes = JSON.parse(stdout.toString()) as DetectedShape[];
    return shapes;
  } catch (error) {
    console.error(`Shape detection failed: ${error}`);
    return [];
  }
}

/**
 * Extract text from a detected shape using OCR
 */
async function extractTextFromShape(
  imagePath: string,
  shape: DetectedShape,
  ocrAdapter: ReturnType<typeof createOCRAdapter>,
  padding: number = 30  // Increased padding to catch text near shape edges
): Promise<{ text: string; words: TesseractWord[] } | null> {
  // Create bounding box with padding - use larger padding for better text capture
  const bbox = {
    x1: Math.max(0, shape.x - padding),
    y1: Math.max(0, shape.y - padding),
    x2: shape.x + shape.width + padding,
    y2: shape.y + shape.height + padding
  };
  
  try {
    // Preprocess the region for better OCR - enhance contrast and sharpen
    const sharp = (await import("sharp")).default;
    const image = sharp(imagePath);
    const metadata = await image.metadata();
    
    const left = Math.max(0, bbox.x1);
    const top = Math.max(0, bbox.y1);
    const width = Math.min(bbox.x2 - bbox.x1, (metadata.width || 0) - left);
    const height = Math.min(bbox.y2 - bbox.y1, (metadata.height || 0) - top);
    
    const tempPath = `/tmp/cv-shape-${Date.now()}-${Math.random().toString(36).substring(7)}.png`;
    
    // Extract and preprocess: enhance contrast, sharpen, resize if too small
    await image
      .extract({ left, top, width, height })
      .normalize()  // Enhance contrast
      .sharpen()    // Sharpen edges
      .png()
      .toFile(tempPath);
    
    try {
      // Use full image OCR on preprocessed region
      const words = await ocrAdapter.extractText(tempPath);
      
      // Adjust coordinates back to full image space
      const adjustedWords = words.map(word => ({
        ...word,
        left: word.left + left,
        top: word.top + top
      }));
      
      // Combine words into text
      const text = adjustedWords.map(w => w.text).join(" ").trim();
      
      return { text, words: adjustedWords };
    } finally {
      try {
        await Bun.file(tempPath).unlink();
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  } catch (error) {
    console.warn(`OCR failed for shape at (${shape.centerX}, ${shape.centerY}): ${error}`);
    return null;
  }
}

/**
 * Computer vision-based callout detection
 */
export async function detectCalloutsComputerVision(
  pdfPath: string,
  existingSheets: string[] = [],
  outputDir: string = "./output",
  dpi: number = 300,
  totalSheetCount?: number,
  ocrEngine: OCREngine = "tesseract"
): Promise<AnalysisResult> {
  const startTime = Date.now();
  
  try {
    // Step 1: Convert PDF to PNG
    const outputPath = `${outputDir}/${Date.now()}.png`;
    const imageInfo: ImageInfo = await convertPdfToImage(pdfPath, outputPath, dpi);
    
    console.log(`📄 Image: ${imageInfo.width}x${imageInfo.height}px at ${dpi} DPI`);
    
    // Step 2: Detect shapes using OpenCV
    console.log("🔍 Step 1: Detecting geometric shapes (circles and triangles)...");
    const shapes = await detectShapes(imageInfo.path, dpi);
    console.log(`   Found ${shapes.length} shapes (${shapes.filter(s => s.type === 'circle').length} circles, ${shapes.filter(s => s.type === 'triangle').length} triangles)`);
    
    if (shapes.length === 0) {
      return {
        success: true,
        sheetNumber: "",
        sheetTitle: null,
        calloutsFound: 0,
        calloutsMatched: 0,
        hyperlinks: [],
        unmatchedCallouts: [],
        processingTimeMs: Date.now() - startTime
      };
    }
    
    // Step 3: Extract text from each shape using OCR
    console.log(`🔍 Step 2: Extracting text from ${shapes.length} detected shapes using ${ocrEngine.toUpperCase()}...`);
    const ocrAdapter = createOCRAdapter(ocrEngine);
    const detectedCallouts: DetectedCallout[] = [];
    
    for (let i = 0; i < shapes.length; i++) {
      const shape = shapes[i];
      console.log(`   Processing shape ${i + 1}/${shapes.length}: ${shape.type} at (${shape.centerX}, ${shape.centerY})`);
      
      let textResult: { text: string; words: TesseractWord[] } | null = null;
      try {
        textResult = await extractTextFromShape(imageInfo.path, shape, ocrAdapter);
      } catch (error) {
        if (i < 5) {
          console.log(`      Shape ${i + 1}: OCR error: ${error}`);
        }
        continue;
      }
      
      if (!textResult || !textResult.text) {
        if (i < 5) {
          console.log(`      Shape ${i + 1}: No text found at (${shape.centerX}, ${shape.centerY}), radius: ${shape.radius || 'N/A'}`);
        }
        continue;
      }
      
      // Debug: log what text was found (first 15 shapes)
      if (i < 15) {
        console.log(`      Shape ${i + 1}: Found text "${textResult.text}" at (${shape.centerX}, ${shape.centerY}), radius: ${shape.radius || 'N/A'}`);
      }
      
      // Extract callout patterns from the text
      const patterns = extractCalloutPatterns(textResult.text);
      
      if (patterns.length === 0) {
        if (i < 15) {
          console.log(`      Shape ${i + 1}: No callout patterns in "${textResult.text}"`);
        }
        continue;
      }
      
      if (i < 15) {
        console.log(`      Shape ${i + 1}: ✅ Found callout pattern(s): ${patterns.join(', ')}`);
      }
      
      for (const pattern of patterns) {
        // Extract target sheet
        const targetSheet = pattern.includes('/') 
          ? pattern.split('/')[1] 
          : pattern;
        
        // Filter by existing sheets if provided
        if (existingSheets.length > 0 && !existingSheets.includes(targetSheet)) {
          continue;
        }
        
        // Determine type
        let type: DetectedCallout['type'] = 'unknown';
        if (shape.type === 'circle') {
          type = pattern.includes('/') ? 'detail' : 'section';
        } else if (shape.type === 'triangle') {
          type = 'revision';
        }
        
        // Use shape center as position (more accurate than OCR text position)
        detectedCallouts.push({
          ref: pattern,
          targetSheet,
          type,
          x: shape.centerX,
          y: shape.centerY,
          confidence: 0.8 // Base confidence from shape detection
        });
      }
    }
    
    console.log(`   Found ${detectedCallouts.length} callouts from ${shapes.length} shapes`);
    
    // Step 4: Normalize coordinates and build result
    const hyperlinks = detectedCallouts.map(callout => {
      const normalized = normalizeCoordinates(
        { x: callout.x, y: callout.y },
        imageInfo.width,
        imageInfo.height
      );
      
      // Calculate final confidence
      const finalConfidence = calculateCalloutConfidence(
        callout,
        imageInfo.width,
        imageInfo.height,
        existingSheets,
        detectedCallouts
      );
      
      return {
        calloutRef: callout.ref,
        targetSheetRef: callout.targetSheet,
        x: normalized.x,
        y: normalized.y,
        pixelX: callout.x,
        pixelY: callout.y,
        confidence: finalConfidence
      };
    });
    
    const processingTimeMs = Date.now() - startTime;
    
    const highConfidence = hyperlinks.filter(h => (h.confidence || 0) >= 0.5);
    const lowConfidence = hyperlinks.filter(h => (h.confidence || 0) < 0.5);
    
    return {
      success: true,
      sheetNumber: "",
      sheetTitle: null,
      calloutsFound: detectedCallouts.length,
      calloutsMatched: 0,
      hyperlinks,
      unmatchedCallouts: [],
      processingTimeMs,
      confidenceStats: {
        highConfidence: highConfidence.length,
        lowConfidence: lowConfidence.length,
        averageConfidence: hyperlinks.length > 0
          ? hyperlinks.reduce((sum, h) => sum + (h.confidence || 0), 0) / hyperlinks.length
          : 0,
        needsManualReview: lowConfidence.length > 0
      }
    };
  } catch (error) {
    return {
      success: false,
      sheetNumber: "",
      sheetTitle: null,
      calloutsFound: 0,
      calloutsMatched: 0,
      hyperlinks: [],
      unmatchedCallouts: [],
      processingTimeMs: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

