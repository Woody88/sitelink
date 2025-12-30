/**
 * CV → LLM Detection Pipeline
 *
 * Pipeline: OpenCV shape detection → Crop shapes → LLM batch validation → Deduplication
 */

import { $ } from "bun";
import { join } from "path";
import { existsSync, mkdirSync } from "fs";
import { convertPdfToImage } from "./pdfProcessor";
import type { DetectedCallout, ImageInfo, AnalysisResult } from "../types/hyperlinks";
import { normalizeCoordinates } from "../utils/coordinates";
import { getPythonInterpreter } from "../utils/pythonInterpreter";
import { validateBatch, type BatchValidationInput, type BatchValidationResult } from "../utils/batchValidation";

// ============================================================================
// Configuration Constants (extracted from magic numbers)
// ============================================================================

/** Distance threshold in pixels for deduplicating nearby callouts with same reference */
const DEDUP_DISTANCE_PX = 200;

/** Padding around standard shapes (circles, triangles) when cropping for LLM */
const STANDARD_CROP_PADDING_PX = 70;

/** Padding around complex shapes (section flags, text callouts) when cropping */
const COMPLEX_CROP_PADDING_PX = 95;

/** Default confidence value when not provided */
const DEFAULT_CONFIDENCE = 0.8;

/** Regex pattern for valid callout references (e.g., "1/A6", "A/S2.1", "3.1/A-101") */
const CALLOUT_REF_PATTERN = /^[A-Z0-9.-]+\/[A-Z0-9.-]+$/i;

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

/**
 * Deduplicate callouts
 */
function deduplicateCallouts(callouts: DetectedCalloutWithBbox[]): DetectedCalloutWithBbox[] {
  if (callouts.length <= 1) return callouts;
  const result: DetectedCalloutWithBbox[] = [];
  const used = new Set<number>();
  const byRef = new Map<string, { callout: DetectedCalloutWithBbox; index: number }[]>();
  
  for (let i = 0; i < callouts.length; i++) {
    const key = callouts[i].ref.toUpperCase().trim();
    if (!byRef.has(key)) byRef.set(key, []);
    byRef.get(key)!.push({ callout: callouts[i], index: i });
  }
  
  for (const [ref, items] of byRef.entries()) {
    const groups: DetectedCalloutWithBbox[][] = [];
    for (const { callout, index } of items) {
      if (used.has(index)) continue;
      const group: DetectedCalloutWithBbox[] = [callout];
      used.add(index);
      for (const { callout: other, index: otherIndex } of items) {
        if (used.has(otherIndex)) continue;
        
        // Calculate distance between two detections of the same REF (e.g., both are "1/A6")
        const dist = Math.sqrt(Math.pow(callout.x - other.x, 2) + Math.pow(callout.y - other.y, 2));

        if (dist < DEDUP_DISTANCE_PX) { group.push(other); used.add(otherIndex); }
      }
      groups.push(group);
    }
    for (const group of groups) {
      const best = group.reduce((a, b) => (a.confidence || 0) > (b.confidence || 0) ? a : b);
      result.push(best);
    }
  }
  result.sort((a, b) => a.y - b.y || a.x - b.x);
  return result;
}

/**
 * Validate that a detected reference matches the expected callout format.
 * Valid formats: "1/A6", "A/S2.1", "3.1/A-101", "SIM/A5"
 * Invalid: bare numbers "1", "42", scale notations "1/4", single letters "A"
 */
function isValidCalloutRef(ref: string): boolean {
  if (!ref || typeof ref !== 'string') return false;
  const cleanRef = ref.toUpperCase().trim();

  // Must match pattern: detail/sheet (e.g., "1/A6", "A/S2.1")
  if (!CALLOUT_REF_PATTERN.test(cleanRef)) return false;

  // Reject scale notations that look like fractions (e.g., "1/4", "1/2", "3/8")
  // These are common false positives from scale indicators
  if (/^[1-9]\/[248]$/.test(cleanRef)) return false;

  return true;
}

async function annotateImageWithCallouts(imagePath: string, callouts: DetectedCalloutWithBbox[], outputPath: string): Promise<boolean> {
  const scriptPath = join(import.meta.dir, "annotateImage.py");
  const pythonCmd = await getPythonInterpreter();
  try {
    const calloutsJson = JSON.stringify(callouts.map(c => ({ x: c.x, y: c.y, ref: c.ref, bbox: c.bbox })));
    const { stdout } = await $`${pythonCmd} ${scriptPath} ${imagePath} ${calloutsJson} ${outputPath}`.quiet();
    const result = JSON.parse(stdout.toString());
    return !result.error;
  } catch (error) { return false; }
}

/**
 * Post-validation step for callouts (currently a pass-through).
 *
 * NOTE: Actual LLM verification is now handled by validateBatch() in Step 3.
 * This function exists for potential future two-stage verification where
 * high-confidence callouts are verified differently from low-confidence ones.
 *
 * @returns All callouts as "verified" since batch validation already filtered them
 */
async function verifyCalloutsWithLLM(
  _imagePath: string,
  callouts: DetectedCalloutWithBbox[],
  outputDir: string,
  _model: string
): Promise<{ verified: DetectedCalloutWithBbox[]; needsReview: DetectedCalloutWithBbox[] }> {
  // Create verify directory for potential future use
  const verifyDir = join(outputDir, "verify");
  if (!existsSync(verifyDir)) mkdirSync(verifyDir, { recursive: true });

  if (callouts.length === 0) return { verified: [], needsReview: [] };

  // All callouts passed batch validation, so mark as verified
  // Future: implement confidence-based splitting here if needed
  console.log(`✅ All ${callouts.length} callouts passed batch validation (no additional verification needed)`);
  return { verified: callouts, needsReview: [] };
}

async function detectShapesWithCV(imagePath: string, dpi: number, outputDir: string): Promise<CVDetectionResult> {
  const scriptPath = join(import.meta.dir, "enhancedShapeDetection.py");
  const pythonCmd = await getPythonInterpreter();
  try {
    const { stdout } = await $`${pythonCmd} ${scriptPath} ${imagePath} ${dpi} ${outputDir}`.quiet();
    return JSON.parse(stdout.toString()) as CVDetectionResult;
  } catch (error) {
    return { shapes: [], imageWidth: 0, imageHeight: 0, totalDetections: 0, byMethod: { contour: 0, hough: 0, blob: 0 }, error: String(error) };
  }
}

export async function detectCalloutsWithCVLLM(
  pdfPath: string,
  existingSheets: string[] = [],
  outputDir: string = "./output",
  dpi: number = 300,
  totalSheetCount?: number,
  model: string = "google/gemini-2.5-flash",
  currentSheet?: string
): Promise<AnalysisResult> {
  const startTime = Date.now();
  const debugDir = join(outputDir, "cv_llm_debug");
  if (!existsSync(debugDir)) mkdirSync(debugDir, { recursive: true });
  
  try {
    console.log("📄 Converting PDF to image...");
    const imagePath = join(outputDir, `${Date.now()}.png`);
    const imageInfo: ImageInfo = await convertPdfToImage(pdfPath, imagePath, dpi);
    console.log(`   Image: ${imageInfo.width}x${imageInfo.height}px at ${dpi} DPI`);
    
    console.log("\n🔍 Step 1: OpenCV multi-technique shape detection...");
    const cvResult = await detectShapesWithCV(imagePath, dpi, debugDir);
    console.log(`   Found ${cvResult.totalDetections} shapes:`);
    console.log(`     - Contour detection: ${cvResult.byMethod.contour}`);
    console.log(`     - Hough circles: ${cvResult.byMethod.hough}`);
    console.log(`     - Blob detection: ${cvResult.byMethod.blob}`);
    console.log(`   Debug image saved to: ${join(debugDir, "cv_detection_debug.png")}`);
    
    if (cvResult.shapes.length === 0) {
      return { success: true, sheetNumber: currentSheet || "", sheetTitle: null, calloutsFound: 0, calloutsMatched: 0, hyperlinks: [], unmatchedCallouts: [], processingTimeMs: Date.now() - startTime };
    }
    
    console.log(`\n🔍 Step 2: Cropping ${cvResult.shapes.length} shapes for batch validation...`);
    console.log(`   Prepared ${cvResult.shapes.length} crops for batch validation`);
    const detectedCallouts: DetectedCalloutWithBbox[] = [];
    const cropsDir = join(debugDir, "crops");
    if (!existsSync(cropsDir)) mkdirSync(cropsDir, { recursive: true });

    const batchInputs: BatchValidationInput[] = [];
    const shapeMap: Map<number, DetectedShape> = new Map();

    const sharp = (await import("sharp")).default;
    const metadata = await sharp(imagePath).metadata();

    for (let i = 0; i < cvResult.shapes.length; i++) {
      const shape = cvResult.shapes[i];
      let normType: 'circle' | 'triangle' | 'section_flag' | 'text_callout' | 'unknown' = 'unknown';
      if (shape.type === 'circle' || shape.type === 'detail_marker') normType = 'circle';
      else if (shape.type === 'triangle') normType = 'triangle';
      else if (shape.type === 'section_flag') normType = 'section_flag';
      else if (shape.type === 'text_callout') normType = 'text_callout';

      const padding = (shape.type === 'section_flag' || shape.type === 'text_callout')
        ? COMPLEX_CROP_PADDING_PX
        : STANDARD_CROP_PADDING_PX;
      const left = Math.max(0, shape.bbox.x1 - padding);
      const top = Math.max(0, shape.bbox.y1 - padding);
      const width = Math.min(metadata.width! - left, (shape.bbox.x2 - shape.bbox.x1) + (padding * 2));
      const height = Math.min(metadata.height! - top, (shape.bbox.y2 - shape.bbox.y1) + (padding * 2));

      const cropPath = join(cropsDir, `shape_${i + 1}_${shape.type}.png`);
      await sharp(imagePath).extract({ left, top, width, height }).png().toFile(cropPath);
      const base64 = Buffer.from(await Bun.file(cropPath).arrayBuffer()).toString('base64');
      
      batchInputs.push({ index: i, imageDataUrl: `data:image/png;base64,${base64}`, shapeType: normType, bbox: shape.bbox, centerX: shape.centerX, centerY: shape.centerY });
      shapeMap.set(i, shape);
    }

    console.log(`\n🔍 Step 3: Batch validating ${batchInputs.length} shapes with LLM...`);
    const batchResults = await validateBatch(batchInputs, { batchSize: 15, model, existingSheets, currentSheet, verbose: true });

    for (const result of batchResults) {
      if (!result.isCallout || !result.detectedRef) continue;
      const shape = shapeMap.get(result.index);
      if (!shape || !isValidCalloutRef(result.detectedRef)) continue;

      const normRef = result.detectedRef.toUpperCase().trim();
      console.log(`   [${result.index + 1}] ✅ CALLOUT: ${normRef} @ (${shape.centerX}, ${shape.centerY}) conf=${(result.confidence * 100).toFixed(0)}%`);

      detectedCallouts.push({
        ref: normRef, targetSheet: result.targetSheet || "",
        type: result.calloutType || "unknown",
        x: shape.centerX, y: shape.centerY,
        confidence: result.confidence, bbox: shape.bbox
      });
    }
    
    console.log(`   Batch validation found ${detectedCallouts.length} valid callouts`);
    console.log(`\n📊 Deduplicating nearby detections...`);
    const initialCount = detectedCallouts.length;
    const dedupedCallouts = deduplicateCallouts(detectedCallouts);
    console.log(`   Before dedup: ${initialCount} callouts`);
    console.log(`   After dedup: ${dedupedCallouts.length} callouts\n`);

    const { verified, needsReview } = await verifyCalloutsWithLLM(imagePath, dedupedCallouts, debugDir, model);
    console.log(`   Verified: ${verified.length}, Needs review: ${needsReview.length}`);
    
    const annotatedPath = join(debugDir, "callouts_annotated.png");
    console.log(`\n📍 Annotating image with callout contours...`);
    const annotated = await annotateImageWithCallouts(imagePath, verified, annotatedPath);
    if (annotated) console.log(`   ✅ Annotated image saved: ${annotatedPath}`);

    const hyperlinks = [...verified, ...needsReview].map(callout => {
      const normalized = normalizeCoordinates({ x: callout.x, y: callout.y }, cvResult.imageWidth, cvResult.imageHeight);
      return {
        calloutRef: callout.ref, targetSheetRef: callout.targetSheet,
        x: normalized.x, y: normalized.y,
        w: (callout.bbox.x2 - callout.bbox.x1) / cvResult.imageWidth,
        h: (callout.bbox.y2 - callout.bbox.y1) / cvResult.imageHeight,
        pixelX: callout.x, pixelY: callout.y,
        confidence: callout.confidence || DEFAULT_CONFIDENCE
      };
    });
    
    return {
      success: true, sheetNumber: currentSheet || "", sheetTitle: "SECTIONS",
      calloutsFound: dedupedCallouts.length, calloutsMatched: verified.length,
      hyperlinks, unmatchedCallouts: needsReview.map(c => c.ref),
      processingTimeMs: Date.now() - startTime
    };
  } catch (error) {
    return { success: false, sheetNumber: "", sheetTitle: null, calloutsFound: 0, calloutsMatched: 0, hyperlinks: [], unmatchedCallouts: [], processingTimeMs: Date.now() - startTime, error: String(error) };
  }
}