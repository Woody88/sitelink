/**
 * Type definitions for batch LLM validation system
 *
 * Enables validating multiple callout crops in a single LLM request
 * for significant performance improvements (5-7x speedup).
 */

/**
 * Input for batch validation - identifies each candidate image
 */
export interface BatchValidationInput {
  /** Unique identifier for tracking (0-indexed position) */
  index: number;
  /** Base64 data URL of cropped image (data:image/png;base64,...) */
  imageDataUrl: string;
  /** Original candidate ref from OCR/CV (optional, for context) */
  candidateRef?: string;
  /** Shape type hint for LLM */
  shapeType?: 'circle' | 'triangle' | 'unknown';
  /** Bounding box in original image coordinates */
  bbox?: { x1: number; y1: number; x2: number; y2: number };
  /** Center coordinates from CV detection */
  centerX?: number;
  centerY?: number;
}

/**
 * Single result from batch validation
 */
export interface BatchValidationResult {
  /** Index matching input (0-indexed) - MUST match input position */
  index: number;
  /** Whether this is a valid callout symbol */
  isCallout: boolean;
  /** Detected reference text (e.g., "2/A5", "A6") */
  detectedRef: string | null;
  /** Target sheet extracted from ref (e.g., "A5" from "2/A5") */
  targetSheet: string | null;
  /** Callout type classification */
  calloutType: 'detail' | 'section' | 'elevation' | 'revision' | 'unknown';
  /** Confidence score 0.0-1.0 */
  confidence: number;
  /** Optional reasoning from LLM for debugging */
  reasoning?: string;
}

/**
 * Full batch response from LLM (parsed JSON structure)
 */
export interface BatchValidationResponse {
  /** Array of results - MUST match input indices */
  results: BatchValidationResult[];
  /** Total images processed */
  totalProcessed: number;
  /** Any processing notes from LLM */
  notes?: string;
}

/**
 * Options for batch validation
 */
export interface BatchValidationOptions {
  /** Max images per batch (default: 15, token-safe for Gemini 2.5 Flash) */
  batchSize?: number;
  /** Model to use (default: google/gemini-2.5-flash) */
  model?: string;
  /** Valid sheet numbers for filtering invalid references */
  existingSheets?: string[];
  /** Current sheet number (to filter self-references) */
  currentSheet?: string;
  /** Retry failed items individually (default: true) */
  retryFailures?: boolean;
  /** Max retries per failed item (default: 2) */
  maxRetries?: number;
  /** Enable verbose logging (default: false) */
  verbose?: boolean;
}

/**
 * Statistics from a batch validation run
 */
export interface BatchValidationStats {
  /** Total inputs processed */
  totalInputs: number;
  /** Number of batches created */
  batchCount: number;
  /** Number of valid callouts found */
  calloutsFound: number;
  /** Number of items that failed and were retried */
  retriedItems: number;
  /** Number of items that failed after all retries */
  failedItems: number;
  /** Total processing time in ms */
  processingTimeMs: number;
}
