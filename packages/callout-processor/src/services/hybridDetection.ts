import sharp from "sharp";
import { callOpenRouter } from "../api/openrouter";
import { detectCalloutsWithTesseractAndBoxes, type TesseractCalloutResult } from "./calloutTesseract";
import { calculateCalloutConfidence } from "../utils/confidenceScoring";
import type { DetectedCallout, ImageInfo } from "../types/hyperlinks";
import { validateBatch, type BatchValidationInput } from "../utils/batchValidation";

/**
 * Hybrid detection: OCR-first with LLM validation
 * 
 * Strategy:
 * 1. Tesseract finds all text candidates with precise bounding boxes
 * 2. Crop image regions around each candidate
 * 3. LLM validates which crops are actually callouts
 * 4. Use Tesseract's precise coordinates for validated callouts
 * 
 * This gives us:
 * - Precise pixel coordinates (from Tesseract)
 * - Semantic validation (from LLM)
 * - Accurate visualization boxes
 */

interface CandidateRegion {
  callout: DetectedCallout;
  boundingBox: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
}

/**
 * Build prompt for validating a single candidate crop
 */
function buildValidationPrompt(candidateRef: string, existingSheets: string[]): string {
  return `You are analyzing a cropped region from a construction plan.

**Task**: Determine if this image region contains a valid callout/sheet reference.

**What to look for**:
- A callout symbol (circle or triangle) with text like "${candidateRef}"
- The text should match the pattern: number/letter+number (e.g., "2/A5") or just letter+number (e.g., "A6")
- The symbol should be clearly visible and associated with the text

**Context**:
- Candidate text: "${candidateRef}"
- Valid sheet numbers: ${existingSheets.length > 0 ? existingSheets.join(", ") : "Any"}

**Response format** (JSON only):
{
  "isCallout": true/false,
  "detectedRef": "2/A5" or null,
  "confidence": 0.0-1.0
}

If it's a valid callout, return the exact reference text you see. If not, set "isCallout": false.`;
}

/**
 * Crop image region around a candidate
 */
async function cropCandidateRegion(
  imagePath: string,
  candidate: CandidateRegion,
  padding: number = 30
): Promise<Buffer> {
  const box = candidate.boundingBox;
  const left = Math.max(0, box.left - padding);
  const top = Math.max(0, box.top - padding);
  const width = box.width + (padding * 2);
  const height = box.height + (padding * 2);
  
  const image = sharp(imagePath);
  const metadata = await image.metadata();
  
  // Ensure we don't exceed image bounds
  const actualLeft = Math.max(0, left);
  const actualTop = Math.max(0, top);
  const actualWidth = Math.min(width, (metadata.width || 0) - actualLeft);
  const actualHeight = Math.min(height, (metadata.height || 0) - actualTop);
  
  return await image
    .extract({
      left: actualLeft,
      top: actualTop,
      width: actualWidth,
      height: actualHeight
    })
    .png()
    .toBuffer();
}

/**
 * Validate a single candidate using LLM
 */
async function validateCandidate(
  imagePath: string,
  candidate: CandidateRegion,
  existingSheets: string[],
  model: string = "google/gemini-2.5-flash"
): Promise<{ isValid: boolean; detectedRef: string | null; confidence: number }> {
  // Crop the region
  const cropBuffer = await cropCandidateRegion(imagePath, candidate);
  const base64 = cropBuffer.toString('base64');
  const dataUrl = `data:image/png;base64,${base64}`;
  
  // Build validation prompt
  const prompt = buildValidationPrompt(candidate.callout.ref, existingSheets);
  
  // Call LLM
  const response = await callOpenRouter(prompt, [dataUrl], { model });
  
  // Parse response
  try {
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
    // If parsing fails, default to invalid
    console.warn(`Failed to parse LLM validation for ${candidate.callout.ref}: ${e}`);
    return { isValid: false, detectedRef: null, confidence: 0 };
  }
}


/**
 * Hybrid detection: OCR finds candidates, LLM validates them
 */
export async function detectCalloutsHybrid(
  imageInfo: ImageInfo,
  existingSheets: string[] = [],
  model: string = "google/gemini-2.5-flash",
  batchSize: number = 5
): Promise<DetectedCallout[]> {
  console.log("🔍 Step 1: Running Tesseract OCR to find text candidates...");
  
  // Step 1: Tesseract finds all text candidates with precise coordinates and bounding boxes
  const tesseractResults = await detectCalloutsWithTesseractAndBoxes(
    imageInfo,
    existingSheets,
    'contrast' // Use contrast preprocessing for better OCR
  );
  
  console.log(`   Found ${tesseractResults.length} text candidates matching callout patterns`);
  
  if (tesseractResults.length === 0) {
    return [];
  }
  
  // Step 2: Convert to candidate regions with bounding boxes
  const candidates: CandidateRegion[] = tesseractResults.map(result => ({
    callout: result.callout,
    boundingBox: result.boundingBox
  }));
  
  // Step 3: Prepare batch inputs for LLM validation
  console.log(`🔍 Step 2: Preparing ${candidates.length} candidates for batch LLM validation...`);

  const batchInputs: BatchValidationInput[] = [];

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    try {
      const cropBuffer = await cropCandidateRegion(imageInfo.path, candidate);
      const base64 = cropBuffer.toString('base64');
      const dataUrl = `data:image/png;base64,${base64}`;

      batchInputs.push({
        index: i,
        imageDataUrl: dataUrl,
        candidateRef: candidate.callout.ref,
        centerX: candidate.callout.x,
        centerY: candidate.callout.y
      });
    } catch (e) {
      console.warn(`   Failed to crop candidate ${i}: ${e}`);
    }
  }

  // Step 4: Batch validate with LLM (true multi-image batching)
  console.log(`🔍 Step 3: Batch validating ${batchInputs.length} candidates with LLM...`);

  const batchResults = await validateBatch(batchInputs, {
    batchSize,
    model,
    existingSheets,
    verbose: true
  });

  // Process results
  const validatedCallouts: DetectedCallout[] = [];

  for (const result of batchResults) {
    if (!result.isCallout || !result.detectedRef) {
      continue;
    }

    const candidate = candidates[result.index];
    if (!candidate) continue;

    // Use Tesseract's precise coordinates with LLM validation
    validatedCallouts.push({
      ...candidate.callout,
      ref: result.detectedRef,
      targetSheet: result.targetSheet || candidate.callout.targetSheet,
      confidence: (candidate.callout.confidence || 0) * 0.5 + result.confidence * 0.5
    });
  }

  console.log(`✅ Hybrid detection complete: ${validatedCallouts.length}/${tesseractResults.length} candidates validated`);
  
  // Calculate final confidence scores
  return validatedCallouts.map(callout => {
    const finalConfidence = calculateCalloutConfidence(
      callout,
      imageInfo.width,
      imageInfo.height,
      existingSheets,
      validatedCallouts
    );
    return {
      ...callout,
      confidence: finalConfidence
    };
  });
}

