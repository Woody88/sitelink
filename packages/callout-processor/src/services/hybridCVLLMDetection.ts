import { $ } from "bun";
import { convertPdfToImage } from "./pdfProcessor";
import { parseTesseractTSV, extractCalloutPatterns, type TesseractWord } from "./calloutTesseract";
import { calculateCalloutConfidence } from "../utils/confidenceScoring";
import { normalizeCoordinates } from "../utils/coordinates";
import { callOpenRouter } from "../api/openrouter";
import type { DetectedCallout, ImageInfo, AnalysisResult } from "../types/hyperlinks";
import { join } from "path";
import sharp from "sharp";

/**
 * Hybrid Computer Vision + LLM Detection
 * 
 * Strategy:
 * 1. Use computer vision (OpenCV) to detect geometric shapes (circles/triangles)
 * 2. Extract text from detected shapes using OCR
 * 3. Use LLM to validate and refine detections
 * 4. Combine results with confidence scores
 * 
 * Benefits:
 * - CV finds actual shapes (not text patterns)
 * - LLM validates semantic meaning
 * - Works across different plan styles
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

interface ShapeWithText {
  shape: DetectedShape;
  text: string;
  words: TesseractWord[];
  patterns: string[];
}

/**
 * Check if OpenCV is available
 */
async function checkOpenCVAvailable(): Promise<boolean> {
  try {
    await $`python3 -c "import cv2; import numpy; print('ok')"`.quiet();
    return true;
  } catch {
    return false;
  }
}

/**
 * Detect shapes using OpenCV (via Python script)
 */
async function detectShapesWithCV(imagePath: string, dpi: number): Promise<DetectedShape[]> {
  const scriptPath = join(import.meta.dir, "shapeDetection.py");
  
  try {
    const { stdout } = await $`python3 ${scriptPath} ${imagePath} ${dpi}`.quiet();
    const shapes = JSON.parse(stdout.toString()) as DetectedShape[];
    return shapes;
  } catch (error) {
    console.warn(`Computer vision detection failed: ${error}`);
    return [];
  }
}

/**
 * Preprocess image for better detection (contrast adjustment)
 */
async function preprocessImage(
  imagePath: string,
  outputPath: string,
  contrast: number = 1.0
): Promise<string> {
  if (contrast === 1.0) {
    return imagePath; // No preprocessing needed
  }
  
  try {
    const image = sharp(imagePath);
    
    // Adjust contrast using linear transformation
    // contrast > 1.0 increases contrast, < 1.0 decreases
    const alpha = contrast; // Contrast multiplier
    const beta = 0; // Brightness offset
    
    await image
      .linear(alpha, beta)
      .png()
      .toFile(outputPath);
    
    return outputPath;
  } catch (error) {
    console.warn(`Image preprocessing failed: ${error}, using original`);
    return imagePath;
  }
}

/**
 * Extract text from a detected shape using OCR
 */
async function extractTextFromShape(
  imagePath: string,
  shape: DetectedShape,
  padding: number = 15
): Promise<{ text: string; words: TesseractWord[] } | null> {
  const left = Math.max(0, shape.x - padding);
  const top = Math.max(0, shape.y - padding);
  const width = shape.width + (padding * 2);
  const height = shape.height + (padding * 2);
  
  const image = sharp(imagePath);
  const metadata = await image.metadata();
  
  const actualLeft = Math.max(0, left);
  const actualTop = Math.max(0, top);
  const actualWidth = Math.min(width, (metadata.width || 0) - actualLeft);
  const actualHeight = Math.min(height, (metadata.height || 0) - actualTop);
  
  const tempPath = `/tmp/shape-ocr-${Date.now()}.png`;
  await image
    .extract({
      left: actualLeft,
      top: actualTop,
      width: actualWidth,
      height: actualHeight
    })
    .png()
    .toFile(tempPath);
  
  try {
    const { stdout } = await $`tesseract ${tempPath} stdout -l eng tsv`.quiet();
    const tsv = stdout.toString();
    const words = parseTesseractTSV(tsv);
    
    const text = words.map(w => w.text).join(" ").trim();
    
    const adjustedWords = words.map(word => ({
      ...word,
      left: word.left + actualLeft,
      top: word.top + actualTop
    }));
    
    return { text, words: adjustedWords };
  } catch (error) {
    return null;
  } finally {
    try {
      await Bun.file(tempPath).unlink();
    } catch (e) {
      // Ignore
    }
  }
}

/**
 * Validate shape detection with LLM
 */
async function validateWithLLM(
  shapeWithText: ShapeWithText,
  imagePath: string,
  existingSheets: string[],
  model: string = "google/gemini-2.5-flash"
): Promise<{ isValid: boolean; detectedRef: string | null; confidence: number }> {
  // Crop the shape region
  const shape = shapeWithText.shape;
  const padding = 20;
  const left = Math.max(0, shape.x - padding);
  const top = Math.max(0, shape.y - padding);
  const width = shape.width + (padding * 2);
  const height = shape.height + (padding * 2);
  
  const image = sharp(imagePath);
  const metadata = await image.metadata();
  
  const actualLeft = Math.max(0, left);
  const actualTop = Math.max(0, top);
  const actualWidth = Math.min(width, (metadata.width || 0) - actualLeft);
  const actualHeight = Math.min(height, (metadata.height || 0) - actualTop);
  
  const cropBuffer = await image
    .extract({
      left: actualLeft,
      top: actualTop,
      width: actualWidth,
      height: actualHeight
    })
    .png()
    .toBuffer();
  
  const base64 = cropBuffer.toString('base64');
  const dataUrl = `data:image/png;base64,${base64}`;
  
  const prompt = `You are analyzing a cropped region from a construction plan that contains a ${shape.type} shape.

**Detected by computer vision:**
- Shape type: ${shape.type}
- OCR text found: "${shapeWithText.text}"
- Possible callout patterns: ${shapeWithText.patterns.join(", ") || "none"}

**Task**: Determine if this is a valid callout symbol (sheet reference).

**What to look for:**
- A ${shape.type} symbol (circle or triangle) with text like "2/A5", "1/A6", or "A6"
- The text should match callout patterns: number/letter+number or just letter+number
- Valid sheet numbers: ${existingSheets.length > 0 ? existingSheets.join(", ") : "Any"}

**Response format** (JSON only):
{
  "isCallout": true/false,
  "detectedRef": "2/A5" or null,
  "confidence": 0.0-1.0
}

If it's a valid callout, return the exact reference text you see. If not, set "isCallout": false.`;
  
  try {
    const response = await callOpenRouter(prompt, [dataUrl], { model });
    let cleaned = response.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }
    const parsed = JSON.parse(cleaned) as {
      isCallout: boolean;
      detectedRef: string | null;
      confidence: number;
    };
    
    return {
      isValid: parsed.isCallout === true,
      detectedRef: parsed.detectedRef || null,
      confidence: parsed.confidence || 0.5
    };
  } catch (e) {
    console.warn(`LLM validation failed for ${shapeWithText.patterns[0] || 'unknown'}: ${e}`);
    return { isValid: false, detectedRef: null, confidence: 0 };
  }
}

/**
 * Hybrid CV + LLM detection
 */
export async function detectCalloutsHybridCVLLM(
  pdfPath: string,
  existingSheets: string[] = [],
  outputDir: string = "./output",
  dpi: number = 300,
  contrast: number = 1.5,
  totalSheetCount?: number,
  model: string = "google/gemini-2.5-flash",
  useLLMValidation: boolean = true
): Promise<AnalysisResult> {
  const startTime = Date.now();
  
  try {
    // Step 1: Convert PDF to PNG
    const outputPath = `${outputDir}/${Date.now()}.png`;
    const imageInfo: ImageInfo = await convertPdfToImage(pdfPath, outputPath, dpi);
    
    console.log(`📄 Image: ${imageInfo.width}x${imageInfo.height}px at ${dpi} DPI`);
    
    // Step 2: Preprocess image (contrast adjustment)
    let processedImagePath = imageInfo.path;
    if (contrast !== 1.0) {
      console.log(`🎨 Preprocessing image with contrast: ${contrast}x...`);
      const preprocessedPath = `${imageInfo.path}.preprocessed.png`;
      processedImagePath = await preprocessImage(imageInfo.path, preprocessedPath, contrast);
    }
    
    // Step 3: Detect shapes using computer vision
    const cvAvailable = await checkOpenCVAvailable();
    let shapes: DetectedShape[] = [];
    
    if (cvAvailable) {
      console.log("🔍 Step 1: Detecting geometric shapes with computer vision...");
      shapes = await detectShapesWithCV(processedImagePath, dpi);
      console.log(`   Found ${shapes.length} shapes (${shapes.filter(s => s.type === 'circle').length} circles, ${shapes.filter(s => s.type === 'triangle').length} triangles)`);
    } else {
      console.log("⚠️  OpenCV not available - install with: pip install opencv-python numpy");
      console.log("   Falling back to LLM-based detection with improved preprocessing...");
      // Return early - we'll fall back to LLM-only in the main index.ts
      return {
        success: false,
        sheetNumber: "",
        sheetTitle: null,
        calloutsFound: 0,
        calloutsMatched: 0,
        hyperlinks: [],
        unmatchedCallouts: [],
        processingTimeMs: Date.now() - startTime,
        error: "OpenCV not available. Install with: pip install opencv-python numpy"
      };
    }
    
    // Step 4: Extract text from shapes
    const shapesWithText: ShapeWithText[] = [];
    
    if (shapes.length > 0) {
      console.log(`🔍 Step 2: Extracting text from ${shapes.length} detected shapes...`);
      
      for (let i = 0; i < shapes.length; i++) {
        const shape = shapes[i];
        const textResult = await extractTextFromShape(processedImagePath, shape);
        
        if (textResult && textResult.text) {
          const patterns = extractCalloutPatterns(textResult.text);
          
          if (patterns.length > 0) {
            shapesWithText.push({
              shape,
              text: textResult.text,
              words: textResult.words,
              patterns
            });
          }
        }
      }
      
      console.log(`   Found ${shapesWithText.length} shapes with callout text`);
    }
    
    // Step 5: Validate with LLM (optional)
    const validatedCallouts: DetectedCallout[] = [];
    
    if (useLLMValidation && shapesWithText.length > 0) {
      console.log(`🔍 Step 3: Validating ${shapesWithText.length} candidates with LLM...`);
      
      for (let i = 0; i < shapesWithText.length; i++) {
        const swt = shapesWithText[i];
        const validation = await validateWithLLM(swt, processedImagePath, existingSheets, model);
        
        if (validation.isValid && validation.detectedRef) {
          const targetSheet = validation.detectedRef.includes('/') 
            ? validation.detectedRef.split('/')[1] 
            : validation.detectedRef;
          
          // Filter by existing sheets if provided
          if (existingSheets.length > 0 && !existingSheets.includes(targetSheet)) {
            continue;
          }
          
          validatedCallouts.push({
            ref: validation.detectedRef,
            targetSheet,
            type: swt.shape.type === 'circle' 
              ? (validation.detectedRef.includes('/') ? 'detail' : 'section')
              : 'revision',
            x: swt.shape.centerX,
            y: swt.shape.centerY,
            confidence: 0.7 * 0.8 + validation.confidence * 0.2 // Weight CV higher
          });
        }
      }
      
      console.log(`   Validated ${validatedCallouts.length}/${shapesWithText.length} candidates`);
    } else if (shapesWithText.length > 0) {
      // Use shapes without LLM validation
      for (const swt of shapesWithText) {
        for (const pattern of swt.patterns) {
          const targetSheet = pattern.includes('/') 
            ? pattern.split('/')[1] 
            : pattern;
          
          if (existingSheets.length > 0 && !existingSheets.includes(targetSheet)) {
            continue;
          }
          
          validatedCallouts.push({
            ref: pattern,
            targetSheet,
            type: swt.shape.type === 'circle' 
              ? (pattern.includes('/') ? 'detail' : 'section')
              : 'revision',
            x: swt.shape.centerX,
            y: swt.shape.centerY,
            confidence: 0.8
          });
        }
      }
    }
    
    // Step 6: Normalize coordinates and build result
    const hyperlinks = validatedCallouts.map(callout => {
      const normalized = normalizeCoordinates(
        { x: callout.x, y: callout.y },
        imageInfo.width,
        imageInfo.height
      );
      
      const finalConfidence = calculateCalloutConfidence(
        callout,
        imageInfo.width,
        imageInfo.height,
        existingSheets,
        validatedCallouts
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
      calloutsFound: validatedCallouts.length,
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

