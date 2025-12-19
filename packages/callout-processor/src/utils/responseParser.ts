import type { VisionLLMResponse, DetectedCallout } from "../types/hyperlinks";

/**
 * Parse JSON from LLM response, handling markdown code blocks
 */
export function parseVisionResponse(raw: string): VisionLLMResponse {
  // Strip markdown code blocks if present
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }
  
  try {
    const parsed = JSON.parse(cleaned) as VisionLLMResponse;
    
    // Normalize sheet number
    if (parsed.sheetNumber) {
      parsed.sheetNumber = parsed.sheetNumber.toUpperCase().trim();
    }
    
    // Normalize callout refs and extract target sheets
    parsed.callouts = parsed.callouts.map(callout => ({
      ...callout,
      ref: callout.ref.toUpperCase().trim(),
      targetSheet: extractTargetSheet(callout.ref)
    }));
    
    return parsed;
  } catch (e) {
    throw new Error(`Failed to parse LLM response: ${e instanceof Error ? e.message : String(e)}\nRaw: ${raw}`);
  }
}

/**
 * Extract target sheet from callout reference
 * "2/A5" -> "A5"
 * "A6" -> "A6"
 * "A/A3.01" -> "A3.01"
 */
export function extractTargetSheet(ref: string): string {
  // "2/A5" -> "A5"
  // "A6" -> "A6"
  // "A/A3.01" -> "A3.01"
  if (ref.includes('/')) {
    const parts = ref.split('/');
    return parts[parts.length - 1];
  }
  return ref;
}

/**
 * Validate and filter response
 */
export function validateResponse(
  response: VisionLLMResponse,
  imageWidth: number,
  imageHeight: number
): VisionLLMResponse {
  // Validate coordinates are within bounds
  response.callouts = response.callouts.filter(callout => {
    const valid = 
      callout.x >= 0 && 
      callout.x <= imageWidth &&
      callout.y >= 0 && 
      callout.y <= imageHeight;
    
    if (!valid) {
      console.warn(`Invalid callout coordinates: ${JSON.stringify(callout)}`);
    }
    return valid;
  });

  // Ensure targetSheet is extracted for all callouts
  response.callouts = response.callouts.map(callout => ({
    ...callout,
    targetSheet: extractTargetSheet(callout.ref)
  }));

  return response;
}

