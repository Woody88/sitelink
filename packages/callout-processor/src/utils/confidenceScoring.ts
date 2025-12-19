import type { DetectedCallout } from "../types/hyperlinks";

/**
 * Calculate confidence score for a detected callout
 * Combines multiple factors to determine reliability
 */
export function calculateCalloutConfidence(
  callout: DetectedCallout,
  imageWidth: number,
  imageHeight: number,
  existingSheets: string[],
  allCallouts: DetectedCallout[]
): number {
  let confidence = 0.5; // Base confidence
  
  // Factor 1: Target sheet validation (0.0 - 0.3)
  if (existingSheets.length > 0) {
    if (existingSheets.includes(callout.targetSheet)) {
      confidence += 0.3; // Valid target sheet
    } else {
      confidence -= 0.2; // Invalid target sheet - likely false positive
    }
  }
  
  // Factor 2: Callout format validation (0.0 - 0.2)
  const hasValidFormat = /^(\d+\/)?[A-Z]\d+$/.test(callout.ref);
  if (hasValidFormat) {
    confidence += 0.2;
  } else {
    confidence -= 0.1; // Invalid format
  }
  
  // Factor 3: Position validation (0.0 - 0.2)
  const isWithinBounds = 
    callout.x >= 0 && callout.x <= imageWidth &&
    callout.y >= 0 && callout.y <= imageHeight;
  if (isWithinBounds) {
    confidence += 0.2;
  } else {
    confidence -= 0.3; // Out of bounds - invalid
  }
  
  // Factor 4: Duplicate detection (0.0 - 0.1)
  // If multiple callouts have same ref at different positions, that's good (legitimate duplicates)
  const duplicateCount = allCallouts.filter(c => c.ref === callout.ref).length;
  if (duplicateCount > 1) {
    // Check if they're at different positions (legitimate duplicates)
    const samePosition = allCallouts.some(c => 
      c.ref === callout.ref && 
      c !== callout &&
      Math.abs(c.x - callout.x) < 50 && 
      Math.abs(c.y - callout.y) < 50
    );
    if (!samePosition) {
      confidence += 0.1; // Legitimate duplicate at different position
    }
  }
  
  // Factor 5: Callout type validation (0.0 - 0.1)
  if (callout.type !== 'unknown') {
    confidence += 0.1;
  }
  
  // Factor 6: LLM-provided confidence (if available) (0.0 - 0.1)
  if (callout.confidence !== undefined) {
    confidence += callout.confidence * 0.1;
  }
  
  // Clamp to 0-1 range
  return Math.max(0, Math.min(1, confidence));
}

/**
 * Filter callouts by confidence threshold
 */
export function filterByConfidence(
  callouts: DetectedCallout[],
  threshold: number = 0.6
): {
  highConfidence: DetectedCallout[];
  lowConfidence: DetectedCallout[];
} {
  const highConfidence: DetectedCallout[] = [];
  const lowConfidence: DetectedCallout[] = [];
  
  for (const callout of callouts) {
    const conf = callout.confidence || 0;
    if (conf >= threshold) {
      highConfidence.push(callout);
    } else {
      lowConfidence.push(callout);
    }
  }
  
  return { highConfidence, lowConfidence };
}

/**
 * Default confidence threshold for manual review
 */
export const CONFIDENCE_THRESHOLD = {
  HIGH: 0.7,    // High confidence - auto-accept
  MEDIUM: 0.5,  // Medium confidence - review recommended
  LOW: 0.3      // Low confidence - manual review required
} as const;


