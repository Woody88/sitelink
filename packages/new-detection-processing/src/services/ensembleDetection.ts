import type { DetectedCallout, AnalysisResult } from "../types/hyperlinks";
import { detectCalloutsRegionBased } from "./regionBasedDetection";
import { detectCalloutsComputerVision } from "./computerVisionDetection";
import { normalizeCoordinates } from "../utils/coordinates";
import { calculateCalloutConfidence } from "../utils/confidenceScoring";
import type { OCREngine } from "./ocrAdapter";

/**
 * Ensemble Detection: Combines Region-Based (LLM) + Computer Vision
 * 
 * Strategy:
 * 1. Run both detection methods in parallel
 * 2. Merge results intelligently:
 *    - Deduplicate based on position (same callout ref within 150px = duplicate)
 *    - Keep highest confidence detection when duplicates found
 *    - Combine unique detections from both methods
 * 3. Final deduplication pass to ensure quality
 * 
 * Benefits:
 * - Region-based: Good semantic understanding, finds text-based callouts
 * - Computer Vision: Finds geometric shapes, catches callouts LLM misses
 * - Combined: Better recall (finds more callouts) while maintaining precision
 */

interface MergedCallout extends DetectedCallout {
  source: "region" | "cv" | "both";
  originalConfidence: number;
}

/**
 * Merge callouts from two detection methods
 * Deduplicates based on position and callout reference
 */
function mergeCalloutResults(
  regionCallouts: DetectedCallout[],
  cvCallouts: DetectedCallout[],
  imageWidth: number,
  imageHeight: number
): MergedCallout[] {
  const merged: MergedCallout[] = [];
  const positionTolerance = 150; // pixels - same callout within this distance = duplicate
  
  // Start with region-based callouts (higher semantic confidence)
  for (const callout of regionCallouts) {
    merged.push({
      ...callout,
      source: "region",
      originalConfidence: callout.confidence || 0
    });
  }
  
  // Add CV callouts, checking for duplicates
  for (const cvCallout of cvCallouts) {
    // Check if this CV callout is a duplicate of a region-based one
    const isDuplicate = merged.some(existing => {
      // Same callout reference
      if (existing.ref.toUpperCase().trim() !== cvCallout.ref.toUpperCase().trim()) {
        return false;
      }
      
      // Check distance
      const distance = Math.sqrt(
        Math.pow(existing.x - cvCallout.x, 2) +
        Math.pow(existing.y - cvCallout.y, 2)
      );
      
      return distance < positionTolerance;
    });
    
    if (!isDuplicate) {
      // New detection from CV - add it
      merged.push({
        ...cvCallout,
        source: "cv",
        originalConfidence: cvCallout.confidence || 0
      });
    } else {
      // Duplicate - check if CV has higher confidence or better position
      const existing = merged.find(e => {
        if (e.ref.toUpperCase().trim() !== cvCallout.ref.toUpperCase().trim()) {
          return false;
        }
        const distance = Math.sqrt(
          Math.pow(e.x - cvCallout.x, 2) +
          Math.pow(e.y - cvCallout.y, 2)
        );
        return distance < positionTolerance;
      });
      
      if (existing) {
        // If CV confidence is significantly higher (> 0.15), replace
        // Or if region-based had no OCR match (low confidence) and CV has text match
        const cvConf = cvCallout.confidence || 0;
        const existingConf = existing.originalConfidence;
        
        if (cvConf > existingConf + 0.15 || (existingConf < 0.5 && cvConf > 0.6)) {
          // Replace with CV detection
          Object.assign(existing, {
            ...cvCallout,
            source: "both", // Indicates it was found by both methods
            originalConfidence: Math.max(cvConf, existingConf)
          });
        } else {
          // Keep existing but mark as found by both
          existing.source = "both";
          existing.originalConfidence = Math.max(cvConf, existingConf);
        }
      }
    }
  }
  
  return merged;
}

/**
 * Final deduplication pass on merged results
 * Removes any remaining duplicates and filters low-confidence detections
 */
function finalDeduplication(
  merged: MergedCallout[],
  imageWidth: number,
  imageHeight: number
): MergedCallout[] {
  // Group by callout reference
  const grouped = new Map<string, MergedCallout[]>();
  for (const callout of merged) {
    const key = callout.ref.toUpperCase().trim();
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(callout);
  }
  
  const result: MergedCallout[] = [];
  const minDistance = 100; // Minimum distance for separate instances
  
  for (const [ref, group] of grouped.entries()) {
    if (group.length === 1) {
      // Single detection - keep if confidence is reasonable
      if ((group[0].confidence || 0) >= 0.3) {
        result.push(group[0]);
      }
      continue;
    }
    
    // Multiple detections - deduplicate
    // Sort by confidence (highest first)
    const sorted = [...group].sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
    
    // Keep detections that are far enough apart
    const kept: MergedCallout[] = [];
    
    for (const candidate of sorted) {
      // Check if far enough from all kept detections
      const isFarEnough = kept.every(keptCallout => {
        const distance = Math.sqrt(
          Math.pow(candidate.x - keptCallout.x, 2) +
          Math.pow(candidate.y - keptCallout.y, 2)
        );
        return distance >= minDistance;
      });
      
      if (isFarEnough && (candidate.confidence || 0) >= 0.3) {
        kept.push(candidate);
      }
    }
    
    // If still too many (> 2), keep only top 2
    if (kept.length > 2) {
      result.push(...kept.slice(0, 2));
    } else {
      result.push(...kept);
    }
  }
  
  return result;
}

/**
 * Ensemble detection: Combines region-based + computer vision
 */
export async function detectCalloutsEnsemble(
  pdfPath: string,
  existingSheets: string[] = [],
  outputDir: string = "./output",
  dpi: number = 300,
  totalSheetCount?: number,
  model: string = "google/gemini-2.5-flash",
  ocrEngine: OCREngine = "tesseract"
): Promise<AnalysisResult> {
  const startTime = Date.now();
  
  try {
    console.log("🔍 Ensemble Detection: Running both methods...");
    
    // Run both methods in parallel for speed
    const [regionResult, cvResult] = await Promise.all([
      detectCalloutsRegionBased(
        pdfPath,
        existingSheets,
        outputDir,
        dpi,
        totalSheetCount,
        model,
        ocrEngine
      ),
      detectCalloutsComputerVision(
        pdfPath,
        existingSheets,
        outputDir,
        dpi,
        totalSheetCount,
        ocrEngine
      )
    ]);
    
    console.log(`   Region-based: ${regionResult.hyperlinks.length} callouts`);
    console.log(`   Computer Vision: ${cvResult.hyperlinks.length} callouts`);
    
    // Extract callout data from results
    const regionCallouts: DetectedCallout[] = regionResult.hyperlinks.map(h => ({
      ref: h.calloutRef,
      targetSheet: h.targetSheetRef,
      type: "circle" as const, // Region-based doesn't specify type
      x: h.pixelX,
      y: h.pixelY,
      confidence: h.confidence || 0
    }));
    
    const cvCallouts: DetectedCallout[] = cvResult.hyperlinks.map(h => ({
      ref: h.calloutRef,
      targetSheet: h.targetSheetRef,
      type: "circle" as const, // CV detection provides type but we'll use from result
      x: h.pixelX,
      y: h.pixelY,
      confidence: h.confidence || 0
    }));
    
    // Get image dimensions - use max coordinates from both methods + buffer
    const allX = [...regionResult.hyperlinks.map(h => h.pixelX), ...cvResult.hyperlinks.map(h => h.pixelX)];
    const allY = [...regionResult.hyperlinks.map(h => h.pixelY), ...cvResult.hyperlinks.map(h => h.pixelY)];
    
    const imageWidth = allX.length > 0 
      ? Math.max(...allX) * 1.3 // Add 30% buffer
      : 2550; // Default for 300 DPI
    const imageHeight = allY.length > 0
      ? Math.max(...allY) * 1.3
      : 3300; // Default for 300 DPI
    
    // Merge results
    console.log("🔍 Merging results from both methods...");
    const merged = mergeCalloutResults(regionCallouts, cvCallouts, imageWidth, imageHeight);
    console.log(`   After merge: ${merged.length} unique callouts`);
    
    // Final deduplication
    const finalCallouts = finalDeduplication(merged, imageWidth, imageHeight);
    console.log(`   After final deduplication: ${finalCallouts.length} callouts`);
    
    // Build result
    const hyperlinks = finalCallouts.map(callout => {
      // Use image dimensions from region result if available
      const normalized = normalizeCoordinates(
        { x: callout.x, y: callout.y },
        imageWidth,
        imageHeight
      );
      
      // Calculate final confidence
      const finalConfidence = calculateCalloutConfidence(
        callout,
        imageWidth,
        imageHeight,
        existingSheets,
        finalCallouts
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
    
    const processingTimeMs = Date.now() - startTime;
    
    const highConfidence = hyperlinks.filter(h => (h.confidence || 0) >= 0.5);
    const lowConfidence = hyperlinks.filter(h => (h.confidence || 0) < 0.5);
    
    // Use sheet info from region-based result (more reliable)
    return {
      success: true,
      sheetNumber: regionResult.sheetNumber || "",
      sheetTitle: regionResult.sheetTitle,
      calloutsFound: finalCallouts.length,
      calloutsMatched: 0,
      hyperlinks,
      unmatchedCallouts: [],
      processingTimeMs,
      confidenceStats: {
        highConfidence: highConfidence.length,
        lowConfidence: lowConfidence.length,
        averageConfidence: hyperlinks.length > 0
          ? hyperlinks.reduce((sum, h) => sum + (h.confidence || 0), 0) / hyperlinks.length
          : 0,
        needsManualReview: lowConfidence.length > 0
      }
    };
  } catch (error) {
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

