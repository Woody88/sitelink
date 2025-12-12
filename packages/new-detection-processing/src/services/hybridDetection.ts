import sharp from "sharp";
import { callOpenRouter } from "../api/openrouter";
import { detectCalloutsWithTesseractAndBoxes, type TesseractCalloutResult } from "./calloutTesseract";
import { calculateCalloutConfidence } from "../utils/confidenceScoring";
import type { DetectedCallout, ImageInfo } from "../types/hyperlinks";

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
  
  // Step 3: Validate candidates with LLM in batches
  console.log(`🔍 Step 2: Validating ${candidates.length} candidates with LLM (batch size: ${batchSize})...`);
  
  const validatedCallouts: DetectedCallout[] = [];
  
  // Process in batches to avoid rate limits
  for (let i = 0; i < candidates.length; i += batchSize) {
    const batch = candidates.slice(i, i + batchSize);
    console.log(`   Validating batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(candidates.length / batchSize)}...`);
    
    const validationPromises = batch.map(async (candidate) => {
      const validation = await validateCandidate(
        imageInfo.path,
        candidate,
        existingSheets,
        model
      );
      
      if (validation.isValid) {
        // Use Tesseract's precise coordinates
        const validatedCallout: DetectedCallout = {
          ...candidate.callout,
          confidence: (candidate.callout.confidence || 0) * 0.5 + validation.confidence * 0.5 // Combine OCR and LLM confidence
        };
        return validatedCallout;
      }
      
      return null;
    });
    
    const results = await Promise.all(validationPromises);
    const valid = results.filter((r): r is DetectedCallout => r !== null);
    validatedCallouts.push(...valid);
    
    console.log(`   ✅ Validated ${valid.length}/${batch.length} candidates`);
  }
  
  console.log(`✅ Hybrid detection complete: ${validatedCallouts.length}/${tesseractCallouts.length} candidates validated`);
  
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

