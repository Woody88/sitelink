/**
 * Batch LLM Validation Utility
 *
 * Validates multiple callout crops in a single LLM request for 5-7x speedup.
 * Handles batch splitting, prompt generation, response parsing, and error recovery.
 */

import { callOpenRouter } from "../api/openrouter";
import type {
  BatchValidationInput,
  BatchValidationResult,
  BatchValidationResponse,
  BatchValidationOptions,
  BatchValidationStats,
} from "../types/batchValidation";

// Re-export types for convenience
export type {
  BatchValidationInput,
  BatchValidationResult,
  BatchValidationResponse,
  BatchValidationOptions,
  BatchValidationStats,
};

// ============================================================================
// Configuration Constants
// ============================================================================

/** Base token estimate for standard crop (fallback when dimensions unavailable) */
const BASE_TOKENS_PER_IMAGE = 1200;

/** Tokens per 1000 pixels of image area (for adaptive estimation) */
const TOKENS_PER_1K_PIXELS = 0.15;

/** Conservative context limit for Gemini 2.5 Flash */
const MAX_CONTEXT_TOKENS = 120000;

const DEFAULT_BATCH_SIZE = 15;
const DEFAULT_MODEL = "google/gemini-2.5-flash";

/** Default confidence threshold for accepting callouts (0.0-1.0) */
const DEFAULT_CONFIDENCE_THRESHOLD = 0.9;

/** Pattern for valid callout references (detail/sheet format) */
const CALLOUT_REF_PATTERN = /^[A-Z0-9.-]+\/[A-Z0-9.-]+$/i;

/**
 * Estimate tokens for an image based on its dimensions.
 * Uses actual bbox dimensions when available, falls back to base estimate.
 */
function estimateImageTokens(input: BatchValidationInput): number {
  if (input.bbox) {
    const width = input.bbox.x2 - input.bbox.x1;
    const height = input.bbox.y2 - input.bbox.y1;
    // Add padding that will be applied during crop
    const paddedArea = (width + 140) * (height + 140);
    return Math.ceil((paddedArea / 1000) * TOKENS_PER_1K_PIXELS) + 200; // +200 for encoding overhead
  }
  return BASE_TOKENS_PER_IMAGE;
}

/**
 * Validate that a reference matches expected callout format.
 */
function isValidCalloutRefFormat(ref: string | null): boolean {
  if (!ref) return false;
  const cleanRef = ref.toUpperCase().trim();

  // Must match detail/sheet pattern
  if (!CALLOUT_REF_PATTERN.test(cleanRef)) return false;

  // Reject scale fractions (1/4, 1/2, 3/8, etc.)
  if (/^[1-9]\/[248]$/.test(cleanRef)) return false;

  return true;
}

/**
 * Build batch validation prompt with numbered image references
 */
function buildBatchValidationPrompt(
  imageCount: number,
  existingSheets: string[] = []
): string {
  const sheetList =
    existingSheets.length > 0
      ? existingSheets.join(", ")
      : "Any valid sheet number";

  return `You are analyzing ${imageCount} cropped images from construction plan sheets.

**TASK**: For EACH image (numbered 0 to ${imageCount - 1}), determine if it contains a callout symbol.

**What ARE callouts:**
1. **Section Flags (IMPORTANT)**: A circle containing text with a solid or hollow triangle/arrow "flag" attached to the side. These indicate a section cut. (e.g., "1/A6", "2/A6").
2. **Circular Detail Markers**: Circle with a horizontal line divider. Typically has a detail number on top and sheet reference on bottom (e.g., "2/A5").
3. **Triangular Revision Markers**: Standalone triangles containing a number or letter (e.g., "1/A5").
4. **Borderless Text**: Plain "XX/XX" text that acts as a callout without a surrounding shape.

**What are NOT callouts (CRITICAL):**
- **Scale Indicators**: Any text containing an equals sign or units, such as "1/4\\" = 1'-0\\"", "1/2\\" = 1'-0\\"", or just the "1/4\\"" part of a scale.
- **Dimensions**: Measurements like "12'-6\\"", "4 1/2\\"", or "R=36\\"".
- **North Arrows**: Symbols or text indicating direction.
- **Bare numbers**: Sheet numbers without detail numbers (just "A6" alone) or single numbers not in a shape.
- **Grid bubbles**: Column/row markers (usually just a letter or number in a circle, like "A" or "1").
- **Room names**: Text labels for spaces.

**Valid target sheets:** ${sheetList}

**CRITICAL INSTRUCTIONS:**
1. Analyze EACH image in order (Image 0, Image 1, Image 2, ...)
2. Return a result for EVERY image - do not skip any.
3. The "index" field MUST match the image position (0-indexed).
4. For Section Flags (Circle+Triangle), report the text inside the circle as the "detectedRef".
5. For detectedRef, use format "detail/sheet" (e.g., "1/A6") whenever a slash is present.

**Response format (JSON only, no markdown):**
{
  "results": [
    {
      "index": 0,
      "isCallout": true,
      "detectedRef": "1/A6",
      "targetSheet": "A6",
      "calloutType": "section",
      "confidence": 0.95,
      "reasoning": "Clear section flag (circle with triangle) containing 1/A6"
    }
  ],
  "totalProcessed": ${imageCount}
}

Analyze all ${imageCount} images now:`;
}

/**
 * Parse and validate batch response from LLM
 */
function parseBatchResponse(
  raw: string,
  expectedCount: number
): BatchValidationResponse {
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  let parsed: BatchValidationResponse;
  try {
    parsed = JSON.parse(cleaned) as BatchValidationResponse;
  } catch (e) {
    throw new Error(
      `Failed to parse batch response JSON: ${e instanceof Error ? e.message : String(e)}`
    );
  }

  if (!Array.isArray(parsed.results)) {
    throw new Error("Response missing 'results' array");
  }

  const resultsByIndex = new Map<number, BatchValidationResult>();
  for (const result of parsed.results) {
    if (typeof result.index === "number") {
      resultsByIndex.set(result.index, {
        index: result.index,
        isCallout: Boolean(result.isCallout),
        detectedRef: result.detectedRef?.toUpperCase().trim() || null,
        targetSheet: result.targetSheet?.toUpperCase().trim() || null,
        calloutType: result.calloutType || "unknown",
        confidence:
          typeof result.confidence === "number"
            ? Math.min(1, Math.max(0, result.confidence))
            : 0,
        reasoning: result.reasoning,
      });
    }
  }

  const completeResults: BatchValidationResult[] = [];
  for (let i = 0; i < expectedCount; i++) {
    if (resultsByIndex.has(i)) {
      completeResults.push(resultsByIndex.get(i)!);
    } else {
      completeResults.push({
        index: i,
        isCallout: false,
        detectedRef: null,
        targetSheet: null,
        calloutType: "unknown",
        confidence: 0,
        reasoning: "No result returned by LLM for this image",
      });
    }
  }

  return {
    results: completeResults,
    totalProcessed: expectedCount,
    notes: parsed.notes,
  };
}

/**
 * Calculate optimal batch size based on adaptive token estimation.
 * Uses actual image dimensions when available for more accurate sizing.
 */
function calculateBatchSize(
  inputs: BatchValidationInput[],
  maxBatchSize: number = DEFAULT_BATCH_SIZE
): number {
  if (inputs.length === 0) return 0;

  // Calculate average tokens per image using adaptive estimation
  const totalTokens = inputs.slice(0, maxBatchSize).reduce(
    (sum, input) => sum + estimateImageTokens(input),
    0
  );
  const avgTokensPerImage = totalTokens / Math.min(inputs.length, maxBatchSize);

  // Calculate how many images we can fit in context
  const maxByTokens = Math.floor(MAX_CONTEXT_TOKENS / avgTokensPerImage);

  return Math.min(maxBatchSize, maxByTokens, inputs.length);
}

/**
 * Extract target sheet from callout reference
 */
function extractTargetSheet(ref: string): string {
  if (ref.includes("/")) {
    const parts = ref.split("/");
    return parts[parts.length - 1];
  }
  return ref;
}

/**
 * Main batch validation function
 */
export async function validateBatch(
  inputs: BatchValidationInput[],
  options: BatchValidationOptions = {}
): Promise<BatchValidationResult[]> {
  const {
    batchSize = DEFAULT_BATCH_SIZE,
    model = DEFAULT_MODEL,
    existingSheets = [],
    currentSheet,
    retryFailures = true,
    maxRetries = 2,
    verbose = false,
    confidenceThreshold = DEFAULT_CONFIDENCE_THRESHOLD,
  } = options;

  if (inputs.length === 0) return [];

  const startTime = Date.now();
  const actualBatchSize = calculateBatchSize(inputs, batchSize);

  const batches: BatchValidationInput[][] = [];
  for (let i = 0; i < inputs.length; i += actualBatchSize) {
    batches.push(inputs.slice(i, i + actualBatchSize));
  }

  if (verbose) {
    console.log(`   Batch validation: ${inputs.length} images in ${batches.length} batch(es)`);
  }

  const allResults: BatchValidationResult[] = [];
  const failedInputs: BatchValidationInput[] = [];

  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];

    try {
      const prompt = buildBatchValidationPrompt(batch.length, existingSheets);
      const images = batch.map((input) => input.imageDataUrl);
      const response = await callOpenRouter(prompt, images, { model, temperature: 0 });
      const parsed = parseBatchResponse(response, batch.length);

      for (let i = 0; i < parsed.results.length; i++) {
        const result = parsed.results[i];
        const originalInput = batch[i];

        const globalResult: BatchValidationResult = {
          ...result,
          index: originalInput.index,
        };

        if (globalResult.detectedRef && !globalResult.targetSheet) {
          globalResult.targetSheet = extractTargetSheet(globalResult.detectedRef);
        }

        // --- 1. CONFIDENCE THRESHOLD FILTER ---
        // Scale indicators and dimensions usually result in lower confidence (70% range).
        // Real callouts are consistently 90%+. Threshold is now configurable.
        if (globalResult.isCallout && globalResult.confidence < confidenceThreshold) {
          globalResult.isCallout = false;
          globalResult.reasoning = `Low confidence (${(globalResult.confidence * 100).toFixed(0)}%) below threshold (${(confidenceThreshold * 100).toFixed(0)}%) - likely noise or scale reference.`;
        }

        // --- 1b. FORMAT VALIDATION FILTER ---
        // Reject callouts that don't match the expected detail/sheet format
        if (globalResult.isCallout && !isValidCalloutRefFormat(globalResult.detectedRef)) {
          globalResult.isCallout = false;
          globalResult.reasoning = `Invalid reference format: "${globalResult.detectedRef}" - expected detail/sheet pattern.`;
        }

        // --- 2. IMPROVED SELF-REFERENCE FILTER ---
        if (
          currentSheet &&
          globalResult.targetSheet === currentSheet.toUpperCase() &&
          globalResult.detectedRef === currentSheet.toUpperCase()
        ) {
          globalResult.isCallout = false;
          globalResult.confidence = 0;
          globalResult.reasoning = `Bare self-reference to sheet ${currentSheet} - filtered`;
        }

        // --- 3. SHEET REGISTRY FILTER ---
        if (globalResult.isCallout && existingSheets.length > 0 && globalResult.targetSheet) {
          const normalizedSheets = existingSheets.map((s) => s.toUpperCase());
          if (!normalizedSheets.includes(globalResult.targetSheet)) {
            globalResult.isCallout = false;
            globalResult.confidence = 0;
            globalResult.reasoning = `Target sheet ${globalResult.targetSheet} not in valid sheets list`;
          }
        }

        allResults.push(globalResult);
      }
    } catch (error) {
      console.error(`   Batch ${batchIndex + 1} failed: ${error}`);
      for (const input of batch) failedInputs.push(input);
    }
  }

  // Handle Retries
  if (retryFailures && failedInputs.length > 0) {
    for (const input of failedInputs) {
      let success = false;
      for (let r = 0; r < maxRetries; r++) {
        try {
          const single = await validateBatch([input], { ...options, batchSize: 1, retryFailures: false, verbose: false });
          if (single.length > 0) { allResults.push(single[0]); success = true; break; }
        } catch (e) {}
      }
      if (!success) {
        allResults.push({ index: input.index, isCallout: false, detectedRef: null, targetSheet: null, calloutType: "unknown", confidence: 0, reasoning: `Failed after ${maxRetries} retries` });
      }
    }
  }

  allResults.sort((a, b) => a.index - b.index);
  return allResults;
}

export async function validateSingle(input: BatchValidationInput, options: BatchValidationOptions = {}): Promise<BatchValidationResult> {
  const results = await validateBatch([input], { ...options, batchSize: 1 });
  return results[0] || { index: input.index, isCallout: false, detectedRef: null, targetSheet: null, calloutType: "unknown", confidence: 0, reasoning: "Validation failed" };
}

export function getBatchStats(results: BatchValidationResult[], processingTimeMs: number, batchCount: number): BatchValidationStats {
  const calloutsFound = results.filter((r) => r.isCallout).length;
  const failedItems = results.filter((r) => r.reasoning?.includes("Failed") || r.reasoning?.includes("No result")).length;
  return { totalInputs: results.length, batchCount, calloutsFound, retriedItems: 0, failedItems, processingTimeMs };
}