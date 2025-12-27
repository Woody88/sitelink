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

// Token estimation: ~1200 tokens per 80px base64 crop
const ESTIMATED_TOKENS_PER_IMAGE = 1200;
const MAX_CONTEXT_TOKENS = 120000; // Conservative limit for Gemini 2.5 Flash
const DEFAULT_BATCH_SIZE = 15;
const DEFAULT_MODEL = "google/gemini-2.5-flash";

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
- Circular markers with sheet references like "1/A5", "2/A6", "A/S1.1"
- Detail circles: Circle with horizontal line divider, number above (detail #), sheet below
- Section markers: Circle with arrow indicating cut direction
- Triangular revision markers with letters/numbers inside

**What are NOT callouts:**
- Dimension numbers (like "12'-6"")
- Scale indicators (like "1/4" = 1'-0"")
- North arrows or compass symbols
- Bare sheet numbers without detail numbers (just "A6" alone)
- Grid bubbles (column/row markers)
- Random decorative elements

**Valid target sheets:** ${sheetList}

**CRITICAL INSTRUCTIONS:**
1. Analyze EACH image in order (Image 0, Image 1, Image 2, ...)
2. Return a result for EVERY image - do not skip any
3. The "index" field MUST match the image position (0-indexed)
4. If uncertain, set isCallout: false with low confidence
5. For detectedRef, use format "detail/sheet" (e.g., "2/A5") when both are visible

**Response format (JSON only, no markdown):**
{
  "results": [
    {
      "index": 0,
      "isCallout": true,
      "detectedRef": "2/A5",
      "targetSheet": "A5",
      "calloutType": "detail",
      "confidence": 0.95,
      "reasoning": "Clear circle with 2 above horizontal line and A5 below"
    },
    {
      "index": 1,
      "isCallout": false,
      "detectedRef": null,
      "targetSheet": null,
      "calloutType": "unknown",
      "confidence": 0.1,
      "reasoning": "Dimension text, not a callout symbol"
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
  // Strip markdown code blocks
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

  // Validate structure
  if (!Array.isArray(parsed.results)) {
    throw new Error("Response missing 'results' array");
  }

  // Create index map for quick lookup
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

  // Fill in missing indices with defaults
  const completeResults: BatchValidationResult[] = [];
  for (let i = 0; i < expectedCount; i++) {
    if (resultsByIndex.has(i)) {
      completeResults.push(resultsByIndex.get(i)!);
    } else {
      // Missing result - mark as uncertain
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
 * Calculate optimal batch size based on estimated token usage
 */
function calculateBatchSize(
  inputCount: number,
  maxBatchSize: number = DEFAULT_BATCH_SIZE
): number {
  const estimatedTokens = maxBatchSize * ESTIMATED_TOKENS_PER_IMAGE;

  if (estimatedTokens > MAX_CONTEXT_TOKENS) {
    return Math.floor(MAX_CONTEXT_TOKENS / ESTIMATED_TOKENS_PER_IMAGE);
  }

  return Math.min(maxBatchSize, inputCount);
}

/**
 * Extract target sheet from callout reference
 * "2/A5" -> "A5", "A6" -> "A6", "A/A3.01" -> "A3.01"
 */
function extractTargetSheet(ref: string): string {
  if (ref.includes("/")) {
    const parts = ref.split("/");
    return parts[parts.length - 1];
  }
  return ref;
}

/**
 * Validate a batch of images with LLM
 *
 * @param inputs Array of batch validation inputs with image data
 * @param options Validation options
 * @returns Array of validation results with same indices as inputs
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
  } = options;

  if (inputs.length === 0) {
    return [];
  }

  const startTime = Date.now();

  // Calculate actual batch size
  const actualBatchSize = calculateBatchSize(inputs.length, batchSize);

  // Split into batches
  const batches: BatchValidationInput[][] = [];
  for (let i = 0; i < inputs.length; i += actualBatchSize) {
    batches.push(inputs.slice(i, i + actualBatchSize));
  }

  if (verbose) {
    console.log(
      `   Batch validation: ${inputs.length} images in ${batches.length} batch(es) of ~${actualBatchSize}`
    );
  }

  const allResults: BatchValidationResult[] = [];
  const failedInputs: BatchValidationInput[] = [];

  // Process each batch
  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];

    if (verbose) {
      console.log(
        `   Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} images)...`
      );
    }

    try {
      // Build prompt
      const prompt = buildBatchValidationPrompt(batch.length, existingSheets);

      // Extract image data URLs
      const images = batch.map((input) => input.imageDataUrl);

      // Call LLM
      const response = await callOpenRouter(prompt, images, {
        model,
        temperature: 0,
      });

      // Parse response
      const parsed = parseBatchResponse(response, batch.length);

      // Map results back to original indices and apply filters
      for (let i = 0; i < parsed.results.length; i++) {
        const result = parsed.results[i];
        const originalInput = batch[i];

        // Create result with original index
        const globalResult: BatchValidationResult = {
          ...result,
          index: originalInput.index, // Use original global index
        };

        // Ensure targetSheet is extracted if we have a ref but no targetSheet
        if (globalResult.detectedRef && !globalResult.targetSheet) {
          globalResult.targetSheet = extractTargetSheet(globalResult.detectedRef);
        }

        // Filter self-references
        if (
          currentSheet &&
          globalResult.targetSheet === currentSheet.toUpperCase()
        ) {
          globalResult.isCallout = false;
          globalResult.confidence = 0;
          globalResult.reasoning = `Self-reference to current sheet ${currentSheet} - filtered`;
        }

        // Filter invalid sheet references
        if (existingSheets.length > 0 && globalResult.targetSheet) {
          const normalizedSheets = existingSheets.map((s) => s.toUpperCase());
          if (!normalizedSheets.includes(globalResult.targetSheet)) {
            globalResult.isCallout = false;
            globalResult.confidence = 0;
            globalResult.reasoning = `Target sheet ${globalResult.targetSheet} not in valid sheets list`;
          }
        }

        allResults.push(globalResult);
      }

      if (verbose) {
        const foundCount = parsed.results.filter((r) => r.isCallout).length;
        console.log(
          `   Batch ${batchIndex + 1} complete: ${foundCount} callouts found`
        );
      }
    } catch (error) {
      console.error(`   Batch ${batchIndex + 1} failed: ${error}`);

      // Mark all items in failed batch for individual retry
      for (const input of batch) {
        failedInputs.push(input);
      }
    }
  }

  // Retry failed items individually if enabled
  if (retryFailures && failedInputs.length > 0) {
    if (verbose) {
      console.log(
        `   Retrying ${failedInputs.length} failed items individually...`
      );
    }

    for (const input of failedInputs) {
      let success = false;

      for (let retryCount = 0; retryCount < maxRetries; retryCount++) {
        try {
          const singleResults = await validateBatch([input], {
            ...options,
            batchSize: 1,
            retryFailures: false, // Don't recurse
            verbose: false,
          });

          if (singleResults.length > 0) {
            allResults.push(singleResults[0]);
            success = true;
            break;
          }
        } catch (e) {
          if (verbose) {
            console.log(`   Retry ${retryCount + 1} failed for index ${input.index}`);
          }
        }
      }

      // If all retries failed, add a default failure result
      if (!success) {
        allResults.push({
          index: input.index,
          isCallout: false,
          detectedRef: null,
          targetSheet: null,
          calloutType: "unknown",
          confidence: 0,
          reasoning: `Failed after ${maxRetries} retries`,
        });
      }
    }
  }

  // Sort by original index to maintain order
  allResults.sort((a, b) => a.index - b.index);

  if (verbose) {
    const totalTime = Date.now() - startTime;
    const calloutsFound = allResults.filter((r) => r.isCallout).length;
    console.log(
      `   Batch validation complete: ${calloutsFound}/${inputs.length} callouts in ${totalTime}ms`
    );
  }

  return allResults;
}

/**
 * Convenience function for single-image validation (backward compatibility)
 */
export async function validateSingle(
  input: BatchValidationInput,
  options: BatchValidationOptions = {}
): Promise<BatchValidationResult> {
  const results = await validateBatch([input], { ...options, batchSize: 1 });
  return (
    results[0] || {
      index: input.index,
      isCallout: false,
      detectedRef: null,
      targetSheet: null,
      calloutType: "unknown",
      confidence: 0,
      reasoning: "Validation failed",
    }
  );
}

/**
 * Get batch validation statistics from results
 */
export function getBatchStats(
  results: BatchValidationResult[],
  processingTimeMs: number,
  batchCount: number
): BatchValidationStats {
  const calloutsFound = results.filter((r) => r.isCallout).length;
  const failedItems = results.filter(
    (r) => r.reasoning?.includes("Failed after") || r.reasoning?.includes("No result")
  ).length;

  return {
    totalInputs: results.length,
    batchCount,
    calloutsFound,
    retriedItems: 0, // Would need to track this during processing
    failedItems,
    processingTimeMs,
  };
}
