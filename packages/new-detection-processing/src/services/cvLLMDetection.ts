/**
 * CV → LLM Detection Pipeline
 * 
 * Strategy:
 * 1. OpenCV finds ALL potential callout shapes (circles, triangles, compound)
 * 2. Each shape is cropped with generous padding
 * 3. LLM validates each crop: "Is this a callout? What text does it contain?"
 * 4. Returns validated callouts with precise positions from CV
 * 
 * This leverages:
 * - CV's precision at geometric shape detection
 * - LLM's ability to read rotated/stylized text and understand context
 */

import { $ } from "bun";
import { join } from "path";
import { existsSync, mkdirSync } from "fs";
import { callOpenRouter } from "../api/openrouter";
import { convertPdfToImage } from "./pdfProcessor";
import type { DetectedCallout, ImageInfo, AnalysisResult } from "../types/hyperlinks";
import { normalizeCoordinates } from "../utils/coordinates";

interface DetectedShape {
  type: string;
  method: string;
  centerX: number;
  centerY: number;
  bbox: { x1: number; y1: number; x2: number; y2: number };
  confidence?: number;
  hasHorizontalLine?: boolean;
  radius?: number;
}

// Extended callout with bounding box from CV
interface DetectedCalloutWithBbox extends DetectedCallout {
  bbox: { x1: number; y1: number; x2: number; y2: number };
}

interface CVDetectionResult {
  shapes: DetectedShape[];
  imageWidth: number;
  imageHeight: number;
  totalDetections: number;
  byMethod: {
    contour: number;
    hough: number;
    blob: number;
  };
  error?: string;
}

interface SingleCallout {
  ref: string;
  targetSheet: string;
  calloutType: string;
  confidence: number;
}

interface LLMValidationResult {
  callouts: SingleCallout[];
  reasoning?: string;
}

/**
 * Deduplicate callouts that are close together with same ref
 */
function deduplicateCallouts(callouts: DetectedCalloutWithBbox[]): DetectedCalloutWithBbox[] {
  if (callouts.length <= 1) return callouts;
  
  const result: DetectedCalloutWithBbox[] = [];
  const used = new Set<number>();
  
  // Group by reference
  const byRef = new Map<string, { callout: DetectedCalloutWithBbox; index: number }[]>();
  for (let i = 0; i < callouts.length; i++) {
    const callout = callouts[i];
    const key = callout.ref.toUpperCase().trim();
    if (!byRef.has(key)) {
      byRef.set(key, []);
    }
    byRef.get(key)!.push({ callout, index: i });
  }
  
  // For each reference, deduplicate nearby detections (more aggressive - 200px threshold)
  for (const [ref, items] of byRef.entries()) {
    const groups: DetectedCalloutWithBbox[][] = [];
    
    for (const { callout, index } of items) {
      if (used.has(index)) continue;
      
      // Find all nearby callouts with same ref
      const group: DetectedCalloutWithBbox[] = [callout];
      used.add(index);
      
      for (const { callout: other, index: otherIndex } of items) {
        if (used.has(otherIndex)) continue;
        
        // Check if within 200px (more aggressive for overlapping crop regions)
        const dist = Math.sqrt(
          Math.pow(callout.x - other.x, 2) + Math.pow(callout.y - other.y, 2)
        );
        
        if (dist < 200) {
          group.push(other);
          used.add(otherIndex);
        }
      }
      
      groups.push(group);
    }
    
    // Keep highest confidence from each group
    for (const group of groups) {
      const best = group.reduce((a, b) => 
        (a.confidence || 0) > (b.confidence || 0) ? a : b
      );
      result.push(best);
    }
  }
  
  // Sort by position
  result.sort((a, b) => a.y - b.y || a.x - b.x);
  
  return result;
}

/**
 * Validate callout ref format - must have detail/sheet pattern
 */
function isValidCalloutRef(ref: string): boolean {
  if (!ref) return false;
  
  // Valid formats: "1/A5", "2/A6", "3/A7", etc.
  const detailPattern = /^\d+\/[A-Z]+\d+$/i;
  if (detailPattern.test(ref)) return true;
  
  // Also allow section markers like "A" (single letter section cuts)
  // But NOT just numbers or just sheet numbers
  
  // Reject bare numbers
  if (/^\d+$/.test(ref)) return false;
  
  // Reject bare sheet numbers without detail
  if (/^[A-Z]+\d+$/i.test(ref)) return false;
  
  return false;
}

/**
 * Annotate image with red contours around detected callouts
 * Uses actual bounding boxes from CV detection for precise contours
 */
async function annotateImageWithCallouts(
  imagePath: string,
  callouts: DetectedCalloutWithBbox[],
  outputPath: string
): Promise<boolean> {
  const scriptPath = join(import.meta.dir, "annotateImage.py");
  const venvPython = join(import.meta.dir, "..", "..", "venv", "bin", "python3");

  try {
    // Pass the actual bounding boxes for precise contours
    const calloutsJson = JSON.stringify(callouts.map(c => ({
      x: c.x,
      y: c.y,
      ref: c.ref,
      bbox: c.bbox  // Include the actual CV bounding box
    })));

    const { stdout, stderr } = await $`${venvPython} ${scriptPath} ${imagePath} ${calloutsJson} ${outputPath}`.quiet();
    
    if (stderr.toString().trim()) {
      console.warn(`Annotation stderr: ${stderr.toString()}`);
    }
    
    const result = JSON.parse(stdout.toString());
    if (result.error) {
      console.error(`Annotation error: ${result.error}`);
      return false;
    }
    
    console.log(`   ✅ Annotated image saved: ${outputPath}`);
    return true;
  } catch (error) {
    console.error(`Failed to annotate image: ${error}`);
    return false;
  }
}

/**
 * Create verification crops and verify with LLM
 */
async function verifyCalloutsWithLLM(
  imagePath: string,
  callouts: DetectedCalloutWithBbox[],
  outputDir: string,
  model: string
): Promise<{ verified: DetectedCalloutWithBbox[]; needsReview: DetectedCalloutWithBbox[] }> {
  const verifyDir = join(outputDir, "verify");
  if (!existsSync(verifyDir)) {
    mkdirSync(verifyDir, { recursive: true });
  }
  
  const verified: DetectedCalloutWithBbox[] = [];
  const needsReview: DetectedCalloutWithBbox[] = [];
  
  console.log(`\n🔍 Verifying ${callouts.length} callouts with LLM...`);
  
  for (let i = 0; i < callouts.length; i++) {
    const callout = callouts[i];
    
    // Create a small crop centered on the callout position
    try {
      const sharp = (await import("sharp")).default;
      const image = sharp(imagePath);
      const metadata = await image.metadata();
      
      const cropSize = 80;
      const half = cropSize / 2;
      const left = Math.max(0, Math.round(callout.x - half));
      const top = Math.max(0, Math.round(callout.y - half));
      const width = Math.min(cropSize, (metadata.width || 0) - left);
      const height = Math.min(cropSize, (metadata.height || 0) - top);
      
      if (width <= 0 || height <= 0) {
        needsReview.push(callout);
        continue;
      }
      
      const cropPath = join(verifyDir, `verify_${i + 1}_${callout.ref.replace('/', '_')}.png`);
      // Don't draw a red dot - it blocks the text inside callouts!
      // Just crop the region centered on the detection point
      await image
        .extract({ left, top, width, height })
        .png()
        .toFile(cropPath);
      
      // Ask LLM to verify
      const imageBuffer = await Bun.file(cropPath).arrayBuffer();
      const base64 = Buffer.from(imageBuffer).toString('base64');
      const imageDataUrl = `data:image/png;base64,${base64}`;
      
      const verifyPrompt = `Look at this small crop from a construction plan.

I believe there's a callout symbol "${callout.ref}" in the CENTER of this image.

A callout is a geometric shape (circle with divider line, or triangle) with text like "1/A5" or "2/A6".

**TASKS:**
1. Is there a callout symbol in the CENTER of this image?
2. What text does the callout ACTUALLY say? (Look carefully at the number - is it 6 or 7?)

Reply with JSON:
{
  "isCentered": true/false,
  "actualRef": "what you actually see (e.g., 2/A6 or 2/A7)",
  "textMatches": true/false,
  "confidence": 0-100,
  "reason": "brief explanation, especially if text doesn't match"
}`;
      
      const response = await callOpenRouter(verifyPrompt, [imageDataUrl], { model, temperature: 0 });
      
      let cleaned = response.trim();
      if (cleaned.startsWith("```")) {
        cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
      }
      
      const verification = JSON.parse(cleaned);
      
      const textMatches = verification.textMatches !== false;
      const actualRef = verification.actualRef || callout.ref;
      
      console.log(`   [${i + 1}/${callouts.length}] ${callout.ref}: centered=${verification.isCentered}, textMatches=${textMatches}, actual="${actualRef}", confidence=${verification.confidence}%`);
      
      if (verification.isCentered && verification.confidence >= 70) {
        // If text doesn't match, use the corrected text from verification
        if (!textMatches && actualRef && actualRef !== callout.ref) {
          console.log(`      🔄 CORRECTED: "${callout.ref}" → "${actualRef}"`);
          callout.ref = actualRef.toUpperCase().trim();
          // Extract target sheet from corrected ref
          const match = callout.ref.match(/\/([A-Z]+\d+)$/i);
          if (match) {
            callout.targetSheet = match[1].toUpperCase();
          }
        }
        
        // Update confidence based on verification
        callout.confidence = (callout.confidence || 0.8) * (verification.confidence / 100);
        verified.push(callout);
      } else {
        callout.confidence = verification.confidence / 100;
        needsReview.push(callout);
        console.log(`      ⚠️ Needs review: ${verification.reason}`);
      }
    } catch (error) {
      console.error(`   Error verifying ${callout.ref}: ${error}`);
      needsReview.push(callout);
    }
  }
  
  console.log(`   Verified: ${verified.length}, Needs review: ${needsReview.length}`);
  
  return { verified, needsReview };
}

/**
 * Run enhanced CV shape detection
 */
async function detectShapesWithCV(
  imagePath: string, 
  dpi: number,
  outputDir: string
): Promise<CVDetectionResult> {
  const scriptPath = join(import.meta.dir, "enhancedShapeDetection.py");
  const venvPython = join(import.meta.dir, "..", "..", "venv", "bin", "python3");

  try {
    const { stdout, stderr } = await $`${venvPython} ${scriptPath} ${imagePath} ${dpi} ${outputDir}`.quiet();
    
    if (stderr.toString().trim()) {
      console.warn(`CV detection stderr: ${stderr.toString()}`);
    }
    
    const result = JSON.parse(stdout.toString()) as CVDetectionResult;
    return result;
  } catch (error) {
    console.error(`CV detection failed: ${error}`);
    return {
      shapes: [],
      imageWidth: 0,
      imageHeight: 0,
      totalDetections: 0,
      byMethod: { contour: 0, hough: 0, blob: 0 },
      error: String(error)
    };
  }
}

/**
 * Crop a shape from the image with generous padding
 * Returns the path to the cropped image
 */
async function cropShape(
  imagePath: string,
  shape: DetectedShape,
  outputPath: string,
  padding: number = 100
): Promise<string | null> {
  try {
    const sharp = (await import("sharp")).default;
    const image = sharp(imagePath);
    const metadata = await image.metadata();
    
    const { x1, y1, x2, y2 } = shape.bbox;
    
    // Add generous padding to include adjacent text
    const left = Math.max(0, x1 - padding);
    const top = Math.max(0, y1 - padding);
    const right = Math.min(metadata.width || x2 + padding, x2 + padding);
    const bottom = Math.min(metadata.height || y2 + padding, y2 + padding);
    
    const width = right - left;
    const height = bottom - top;
    
    if (width <= 0 || height <= 0) {
      return null;
    }
    
    await image
      .extract({ left, top, width, height })
      .png()
      .toFile(outputPath);
    
    return outputPath;
  } catch (error) {
    console.error(`Failed to crop shape: ${error}`);
    return null;
  }
}

/**
 * Build prompt for LLM to validate a cropped shape
 * 
 * The LLM's job is simple:
 * 1. Validate if this is a callout
 * 2. Read the text
 * 
 * Position comes from CV detection, not LLM.
 */
function buildValidationPrompt(): string {
  return `You are analyzing a cropped region from a construction plan sheet.

**TASK**: Determine if this image contains a callout symbol and read its text.

**What are callouts?**
Callouts are symbols that reference other sheets. They typically consist of:
- A geometric shape (circle, triangle, or combination)
- Text indicating a detail number and/or sheet number (e.g., "1/A5", "2/A6")
- Sometimes a horizontal divider line
- Sometimes an arrow or pointer

**Common formats:**
- "1/A5" or "2/A5" = Detail 1 or 2 on sheet A5
- Number above line, sheet below (in circles with dividers)

**What are NOT callouts:**
- Dimension numbers (like "24'-0"")
- Scale indicators
- North arrows
- Bare sheet numbers without detail numbers (like just "A6")
- Random text or symbols

**Response format (JSON):**
{
  "callouts": [
    {
      "ref": "1/A5",
      "targetSheet": "A5",
      "calloutType": "detail",
      "confidence": 0.95
    }
  ],
  "reasoning": "Brief explanation"
}

If no callouts found, return: { "callouts": [], "reasoning": "..." }

**IMPORTANT**: 
- If you see exactly ONE callout symbol, return it
- If you see MULTIPLE callout symbols, return ALL of them
- Text may be rotated, small, or stylized - look carefully
- Each callout must have format "N/SHEET" (e.g., "1/A5", "2/A6")`;
}

/**
 * Validate a cropped shape with LLM
 */
async function validateShapeWithLLM(
  croppedPath: string,
  model: string = "google/gemini-2.5-flash"
): Promise<LLMValidationResult> {
  try {
    const imageBuffer = await Bun.file(croppedPath).arrayBuffer();
    const base64 = Buffer.from(imageBuffer).toString('base64');
    const imageDataUrl = `data:image/png;base64,${base64}`;
    
    const prompt = buildValidationPrompt();
    const response = await callOpenRouter(prompt, [imageDataUrl], { model, temperature: 0 });
    
    // Parse response
    let cleaned = response.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }
    
    const parsed = JSON.parse(cleaned) as LLMValidationResult;
    
    // Ensure callouts array exists
    if (!parsed.callouts) {
      parsed.callouts = [];
    }
    
    return parsed;
  } catch (error) {
    console.error(`LLM validation failed: ${error}`);
    return {
      callouts: [],
      reasoning: `Error: ${error}`
    };
  }
}

/**
 * Main CV → LLM detection pipeline
 */
export async function detectCalloutsWithCVLLM(
  pdfPath: string,
  existingSheets: string[] = [],
  outputDir: string = "./output",
  dpi: number = 300,
  totalSheetCount?: number,
  model: string = "google/gemini-2.5-flash",
  currentSheet?: string  // Current sheet number to filter self-references
): Promise<AnalysisResult> {
  const startTime = Date.now();
  
  // Create debug output directory
  const debugDir = join(outputDir, "cv_llm_debug");
  if (!existsSync(debugDir)) {
    mkdirSync(debugDir, { recursive: true });
  }
  
  try {
    // Step 1: Convert PDF to PNG
    console.log("📄 Converting PDF to image...");
    const imagePath = join(outputDir, `${Date.now()}.png`);
    const imageInfo: ImageInfo = await convertPdfToImage(pdfPath, imagePath, dpi);
    console.log(`   Image: ${imageInfo.width}x${imageInfo.height}px at ${dpi} DPI`);
    
    // Step 2: Run enhanced CV shape detection
    console.log("\n🔍 Step 1: OpenCV multi-technique shape detection...");
    const cvResult = await detectShapesWithCV(imagePath, dpi, debugDir);
    
    if (cvResult.error) {
      console.error(`   CV detection error: ${cvResult.error}`);
    }
    
    console.log(`   Found ${cvResult.totalDetections} shapes:`);
    console.log(`     - Contour detection: ${cvResult.byMethod.contour}`);
    console.log(`     - Hough circles: ${cvResult.byMethod.hough}`);
    console.log(`     - Blob detection: ${cvResult.byMethod.blob}`);
    console.log(`   Debug image saved to: ${debugDir}/cv_detection_debug.png`);
    
    if (cvResult.shapes.length === 0) {
      console.log("   No shapes found!");
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
    
    // Step 3: Crop each shape and validate with LLM
    console.log(`\n🔍 Step 2: Cropping ${cvResult.shapes.length} shapes and validating with LLM...`);
    
    const detectedCallouts: DetectedCalloutWithBbox[] = [];
    const cropsDir = join(debugDir, "crops");
    if (!existsSync(cropsDir)) {
      mkdirSync(cropsDir, { recursive: true });
    }
    
    for (let i = 0; i < cvResult.shapes.length; i++) {
      const shape = cvResult.shapes[i];
      console.log(`\n   [${i + 1}/${cvResult.shapes.length}] ${shape.type} at (${shape.centerX}, ${shape.centerY})`);
      
      // Crop shape with generous padding
      const cropPath = join(cropsDir, `shape_${i + 1}_${shape.type}.png`);
      // Balance: 70px padding - enough for text but limits multi-callout crops
      const croppedPath = await cropShape(imagePath, shape, cropPath, 70);
      
      if (!croppedPath) {
        console.log(`      ❌ Failed to crop`);
        continue;
      }
      
      console.log(`      Cropped to: ${cropPath}`);
      
      // Validate with LLM - LLM tells us WHAT the callout says
      // CV tells us WHERE the callout is (shape.centerX, shape.centerY)
      const validation = await validateShapeWithLLM(croppedPath, model);
      
      console.log(`      LLM found ${validation.callouts.length} callout(s)`);
      if (validation.reasoning) {
        console.log(`      Reasoning: ${validation.reasoning}`);
      }
      
      // Accept callouts from this shape
      // If multiple callouts found, only take the FIRST one (using CV's shape center)
      // Deduplication will handle if we detect the same callout from multiple shapes
      if (validation.callouts.length > 0) {
        const calloutsToProcess = validation.callouts.slice(0, 1); // Only first callout
        for (const callout of calloutsToProcess) {
          const normalizedRef = callout.ref?.toUpperCase().trim() || "";
          
          // Validate the ref format
          if (!normalizedRef || !isValidCalloutRef(normalizedRef)) {
            console.log(`      ⚠️ REJECTED: "${callout.ref}" - invalid format (must be detail/sheet like "1/A5")`);
            continue;
          }
          
          // Filter out self-references (callouts pointing to current sheet)
          const targetSheet = callout.targetSheet?.toUpperCase().trim() || "";
          if (currentSheet && targetSheet === currentSheet.toUpperCase().trim()) {
            console.log(`      ⚠️ REJECTED: "${callout.ref}" - self-reference to current sheet ${currentSheet}`);
            continue;
          }
          
          // Use the shape center - since we only accept single-callout detections,
          // the shape center IS the callout center
          const absoluteX = shape.centerX;
          const absoluteY = shape.centerY;
          console.log(`      ✅ CALLOUT: ${callout.ref} @ shape center (${absoluteX}, ${absoluteY})`);
          
          detectedCallouts.push({
            ref: normalizedRef,
            targetSheet: callout.targetSheet?.toUpperCase().trim() || "",
            type: callout.calloutType || "unknown",
            x: absoluteX,
            y: absoluteY,
            confidence: callout.confidence || 0.8,
            bbox: shape.bbox  // Store the actual CV bounding box
          });
        }
      } else {
        console.log(`      ❌ Not a callout`);
      }
    }
    
    // Step 4: Deduplicate nearby detections
    console.log(`\n📊 Deduplicating nearby detections...`);
    console.log(`   Before dedup: ${detectedCallouts.length} callouts`);
    const dedupedCallouts = deduplicateCallouts(detectedCallouts);
    console.log(`   After dedup: ${dedupedCallouts.length} callouts`);
    
    // Step 5: Verify each callout with LLM (check if dot is centered on symbol)
    const { verified, needsReview } = await verifyCalloutsWithLLM(
      imagePath,
      dedupedCallouts,
      debugDir,
      model
    );
    
    // Step 6: Build results
    console.log(`\n📊 Results:`);
    console.log(`   CV found ${cvResult.shapes.length} shapes`);
    console.log(`   LLM validated ${dedupedCallouts.length} callouts (after dedup)`);
    console.log(`   Verified with high confidence: ${verified.length}`);
    console.log(`   Needs manual review: ${needsReview.length}`);
    
    // Use verified callouts for hyperlinks (high confidence)
    // Also include needs-review ones but with lower confidence
    const allCallouts = [...verified, ...needsReview];
    
    // Normalize coordinates
    const hyperlinks = allCallouts.map(callout => {
      const normalized = normalizeCoordinates(
        { x: callout.x, y: callout.y },
        cvResult.imageWidth,
        cvResult.imageHeight
      );
      
      return {
        calloutRef: callout.ref,
        targetSheetRef: callout.targetSheet,
        x: normalized.x,
        y: normalized.y,
        pixelX: callout.x,
        pixelY: callout.y,
        confidence: callout.confidence || 0.8
      };
    });
    
    // Group by ref for display
    const byRef = new Map<string, number>();
    for (const callout of allCallouts) {
      byRef.set(callout.ref, (byRef.get(callout.ref) || 0) + 1);
    }
    console.log(`   By reference:`);
    for (const [ref, count] of byRef.entries()) {
      console.log(`      ${ref}: ${count} instance(s)`);
    }
    
    // Step 7: Annotate image with contours
    // - Red for verified callouts
    // - Yellow for needs-review callouts
    const annotatedPath = join(debugDir, "callouts_annotated.png");
    console.log(`\n📍 Annotating image with callout contours...`);
    
    // Annotate verified callouts in red
    await annotateImageWithCallouts(imagePath, verified, annotatedPath);
    
    // Log needs-review callouts (not annotated since positions may be wrong)
    if (needsReview.length > 0) {
      console.log(`\n⚠️  ${needsReview.length} callout(s) need manual review (NOT shown on annotated image - positions may be incorrect):`);
      for (const callout of needsReview) {
        console.log(`   - ${callout.ref} at (${callout.x}, ${callout.y}) - position may be wrong, please add manually`);
      }
    }
    
    const processingTimeMs = Date.now() - startTime;
    console.log(`\n   Processing time: ${(processingTimeMs / 1000).toFixed(1)}s`);
    
    // Build list of callouts needing review with their reasons
    const needsReviewRefs = needsReview.map(c => c.ref);
    
    // Log summary of what needs attention
    if (needsReview.length > 0 || verified.length < allCallouts.length) {
      console.log(`\n📋 DETECTION SUMMARY:`);
      console.log(`   ✅ Verified (high confidence): ${verified.length}`);
      console.log(`   ⚠️  Needs manual review: ${needsReview.length}`);
      if (needsReview.length > 0) {
        console.log(`      Refs needing review: ${needsReviewRefs.join(', ')}`);
      }
    }
    
    return {
      success: true,
      sheetNumber: "",
      sheetTitle: null,
      calloutsFound: allCallouts.length,
      calloutsMatched: verified.length,  // Only count verified as matched
      hyperlinks,
      unmatchedCallouts: needsReviewRefs,  // Return refs that need review
      processingTimeMs,
      confidenceStats: {
        highConfidence: verified.length,
        lowConfidence: needsReview.length,
        averageConfidence: hyperlinks.length > 0
          ? hyperlinks.reduce((sum, h) => sum + h.confidence, 0) / hyperlinks.length
          : 0,
        needsManualReview: needsReview.length > 0
      }
    };
  } catch (error) {
    console.error(`CV-LLM detection failed: ${error}`);
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

