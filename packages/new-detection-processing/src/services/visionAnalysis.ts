import { readFile } from "fs/promises";
import { callOpenRouter } from "../api/openrouter";
import { convertPdfToImage } from "./pdfProcessor";
import { buildDetectionPrompt, buildFocusedRetryPrompt } from "../prompts/detectCallouts";
import { parseVisionResponse, validateResponse } from "../utils/responseParser";
import { normalizeCoordinates } from "../utils/coordinates";
import { calculateCalloutConfidence, CONFIDENCE_THRESHOLD } from "../utils/confidenceScoring";
import type { AnalysisResult, ImageInfo, DetectedCallout } from "../types/hyperlinks";

// Available models
export const MODELS = {
  FLASH: "google/gemini-2.5-flash",
  PRO_25: "google/gemini-2.5-pro",
  PRO_3: "google/gemini-3-pro-preview",
} as const;

export type ModelType = typeof MODELS[keyof typeof MODELS];

/**
 * Convert PNG image to base64 data URL
 */
async function imageToBase64DataUrl(imagePath: string): Promise<string> {
  const imageBuffer = await readFile(imagePath);
  const base64 = imageBuffer.toString('base64');
  return `data:image/png;base64,${base64}`;
}

/**
 * Analyze a PDF sheet for callout detection (with optional 2-pass retry)
 */
export async function analyzeSheet(
  pdfPath: string,
  existingSheets: string[] = [],
  outputDir: string = "./output",
  dpi: number = 200,
  totalSheetCount?: number,
  enableRetry: boolean = true,
  model: ModelType = MODELS.FLASH
): Promise<AnalysisResult> {
  const startTime = Date.now();
  
  try {
    // Step 1: Convert PDF to PNG
    const outputPath = `${outputDir}/${Date.now()}.png`;
    const imageInfo: ImageInfo = await convertPdfToImage(pdfPath, outputPath, dpi);
    
    // Step 2: Convert PNG to base64 data URL
    const imageDataUrl = await imageToBase64DataUrl(imageInfo.path);
    
    // Step 3: Build prompt
    const prompt = buildDetectionPrompt(
      imageInfo.width,
      imageInfo.height,
      existingSheets,
      totalSheetCount
    );
    
    // Step 4: Call OpenRouter API (First Pass)
    console.log(`  Pass 1: Initial detection with ${model}...`);
    const rawResponse = await callOpenRouter(
      prompt,
      [imageDataUrl],
      { model, temperature: 0 }
    );
    
    // Step 5: Parse and validate response
    const parsedResponse = parseVisionResponse(rawResponse);
    let validatedResponse = validateResponse(
      parsedResponse,
      imageInfo.width,
      imageInfo.height
    );
    
    let allCallouts = [...validatedResponse.callouts];
    
    // Step 6: Optional second pass for under-detected sheets
    if (enableRetry && existingSheets.length > 0) {
      // Find which target sheets might be under-detected
      const detectedTargets = new Map<string, number>();
      for (const callout of allCallouts) {
        const count = detectedTargets.get(callout.targetSheet) || 0;
        detectedTargets.set(callout.targetSheet, count + 1);
      }
      
      // Find sheets with no callouts detected (potential misses)
      const underDetectedSheets = existingSheets.filter(sheet => {
        const count = detectedTargets.get(sheet) || 0;
        return count === 0; // Only retry for completely missed sheets
      });
      
      if (underDetectedSheets.length > 0) {
        console.log(`  Pass 2: Focused search for sheets: ${underDetectedSheets.join(', ')}`);
        
        const retryPrompt = buildFocusedRetryPrompt(
          imageInfo.width,
          imageInfo.height,
          underDetectedSheets,
          allCallouts.map(c => ({ ref: c.ref, x: c.x, y: c.y })),
          existingSheets
        );
        
        try {
          const retryResponse = await callOpenRouter(
            retryPrompt,
            [imageDataUrl],
            { model, temperature: 0 }
          );
          
          const retryParsed = parseVisionResponse(retryResponse);
          const retryValidated = validateResponse(
            { ...retryParsed, sheetNumber: validatedResponse.sheetNumber, sheetTitle: validatedResponse.sheetTitle },
            imageInfo.width,
            imageInfo.height
          );
          
          // Merge new callouts (avoid duplicates based on position)
          for (const newCallout of retryValidated.callouts) {
            const isDuplicate = allCallouts.some(existing => 
              Math.abs(existing.x - newCallout.x) < 150 && 
              Math.abs(existing.y - newCallout.y) < 150
            );
            
            if (!isDuplicate) {
              console.log(`  Found new callout: ${newCallout.ref} at (${newCallout.x}, ${newCallout.y})`);
              allCallouts.push(newCallout);
            }
          }
        } catch (retryError: any) {
          console.log(`  Retry pass failed: ${retryError.message}`);
        }
      }
    }
    
    // Step 7: Calculate confidence scores and normalize coordinates
    const hyperlinks = allCallouts.map(callout => {
      // Calculate comprehensive confidence score
      const calculatedConfidence = calculateCalloutConfidence(
        callout,
        imageInfo.width,
        imageInfo.height,
        existingSheets,
        allCallouts
      );
      
      // Use calculated confidence, or LLM-provided if available (weighted average)
      const finalConfidence = callout.confidence !== undefined
        ? (calculatedConfidence * 0.7 + callout.confidence * 0.3) // Weight calculated higher
        : calculatedConfidence;
      
      // Update callout with calculated confidence
      callout.confidence = finalConfidence;
      
      const normalized = normalizeCoordinates(
        { x: callout.x, y: callout.y },
        imageInfo.width,
        imageInfo.height
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
    
    // Separate high and low confidence callouts
    const highConfidence = hyperlinks.filter(h => (h.confidence || 0) >= CONFIDENCE_THRESHOLD.MEDIUM);
    const lowConfidence = hyperlinks.filter(h => (h.confidence || 0) < CONFIDENCE_THRESHOLD.MEDIUM);
    
    const processingTimeMs = Date.now() - startTime;
    
    const unmatchedCallouts = allCallouts
      .map(c => c.ref)
      .filter((ref, index, self) => self.indexOf(ref) === index);
    
    return {
      success: true,
      sheetNumber: validatedResponse.sheetNumber,
      sheetTitle: validatedResponse.sheetTitle,
      calloutsFound: allCallouts.length,
      calloutsMatched: 0,
      hyperlinks,
      unmatchedCallouts,
      processingTimeMs,
      // Add confidence statistics
      confidenceStats: {
        highConfidence: highConfidence.length,
        lowConfidence: lowConfidence.length,
        averageConfidence: hyperlinks.length > 0
          ? hyperlinks.reduce((sum, h) => sum + (h.confidence || 0), 0) / hyperlinks.length
          : 0,
        needsManualReview: lowConfidence.length > 0
      }
    };
  } catch (error: any) {
    const processingTimeMs = Date.now() - startTime;
    
    return {
      success: false,
      sheetNumber: "UNKNOWN",
      sheetTitle: null,
      calloutsFound: 0,
      calloutsMatched: 0,
      hyperlinks: [],
      unmatchedCallouts: [],
      processingTimeMs,
      error: error.message || String(error)
    };
  }
}
