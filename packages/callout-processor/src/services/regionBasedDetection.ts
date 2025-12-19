import { callOpenRouter } from "../api/openrouter";
import { convertPdfToImage } from "./pdfProcessor";
import { extractCalloutPatterns, type TesseractWord } from "./calloutTesseract";
import { calculateCalloutConfidence } from "../utils/confidenceScoring";
import { normalizeCoordinates } from "../utils/coordinates";
import type { DetectedCallout, ImageInfo, AnalysisResult } from "../types/hyperlinks";
import { createOCRAdapter, type OCREngine } from "./ocrAdapter";

/**
 * Region-based detection: LLM finds approximate regions, OCR finds exact positions
 * 
 * Strategy:
 * 1. LLM identifies callouts with approximate bounding boxes (regions)
 * 2. OCR searches those regions for exact text positions
 * 3. Match LLM callouts with OCR text to get precise coordinates
 * 
 * This leverages:
 * - LLM's semantic understanding (identifies callouts)
 * - OCR's precise text detection (finds exact positions)
 */

interface LLMRegion {
  ref: string;
  targetSheet: string;
  type: DetectedCallout['type'];
  bbox: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  };
  confidence: number;
}


/**
 * Build prompt for region-based detection (primary pass)
 */
function buildRegionDetectionPrompt(
  imageWidth: number,
  imageHeight: number,
  existingSheets: string[] = [],
  totalSheetCount?: number
): string {
  return `You are analyzing a construction plan sheet to detect callout symbols (sheet references).

**TASK**: Identify all callout symbols and provide approximate bounding box regions (not exact pixel coordinates).

**What are callouts?**
Callouts are SMALL SYMBOLS (geometric shapes) that reference other sheets. They are:
- **Circular markers**: Small circles (typically 20-50 pixels diameter) containing text like "2/A5", "1/A6", "3/A7"
- **Triangular markers**: Small triangles (typically 20-40 pixels) containing text like "1/A5", "2/A5", "3/A5"
- Format: number/letter+number (e.g., "2/A5") or just letter+number (e.g., "A6")
- Usually have a leader line (thin line) pointing to a specific area or detail
- Are SMALL symbols, not large text labels

**What are NOT callouts (DO NOT INCLUDE):**
- ❌ Dimension labels (e.g., "OVERALL DIMENSION", "CRAWLSPACE VENT SIZE")
- ❌ Title block text (sheet number, sheet title, notes)
- ❌ General notes or specifications text
- ❌ Large text labels anywhere on the plan
- ❌ Scale bars, north arrows, or other drawing elements
- ❌ Any text that is NOT inside a small geometric symbol (circle or triangle)

**Visual Characteristics:**
- Callouts are SMALL (typically 20-50 pixels in diameter/width)
- They have a VISIBLE GEOMETRIC SHAPE (circle or triangle) around the text
- The text is INSIDE or IMMEDIATELY ADJACENT to the shape
- They often have a thin leader line connecting to a detail
- They are distinct from other text on the plan
- The bounding box should be SMALL (30-80 pixels) - if you're creating a box larger than 100 pixels, it's probably wrong

**Size Validation:**
- If your bounding box is larger than 150 pixels in width or height, you're probably looking at a text label, NOT a callout
- Callouts are compact symbols - the entire symbol fits in a small area
- Dimension labels like "OVERALL DIMENSION" are much larger (200+ pixels) - these are NOT callouts

**IMPORTANT - Bounding Boxes, Not Points**:
- For each callout, provide a bounding box (x1, y1, x2, y2) that contains the ENTIRE symbol (shape + text)
- The box should be tight around the symbol, not large
- Typical callout bounding box: 30-80 pixels wide/tall
- Don't include leader lines in the bounding box, just the symbol itself

**Systematic Scanning Strategy** (CRITICAL for finding all callouts):
1. **Divide the image into quadrants** mentally: top-left, top-right, bottom-left, bottom-right
2. **Scan each quadrant systematically** - don't skip areas
3. **Look for SMALL geometric shapes** (circles or triangles) with text inside
4. **Check edges and corners** - callouts are often near drawing boundaries
5. **Look for leader lines** - thin lines pointing from callouts to details
6. **Check near detail markers** - callouts often appear near section cuts, details, or elevations
7. **IGNORE all large text labels, dimension labels, and title block text**
8. **For each callout found**, provide:
   - The reference text (e.g., "2/A5")
   - An approximate bounding box that contains JUST the symbol (not surrounding text)
   - The type (detail, section, elevation, plan, revision, or unknown)

**Architectural Drawing Conventions** (general standards):
- Callouts follow industry conventions (AIA/CSI standards)
- Detail callouts: Circle with horizontal line, number above, sheet below (e.g., "2/A5")
- Section callouts: Circle with arrow, number and sheet (e.g., "1/A6")
- Elevation markers: Triangle or circle with view direction
- Revision markers: Triangle or cloud shape
- These conventions apply across ALL construction plans, not just this one

**Sheet Registry Validation**:
${existingSheets.length > 0 ? `
- Valid sheet numbers in this plan: ${existingSheets.join(", ")}
- Only report callouts that reference valid sheets
- If you see a callout like "1/A99" but A99 is not in the list, it's likely a false positive
` : ''}
${totalSheetCount ? `
- This plan has ${totalSheetCount} total sheets
- Sheet numbers should be within A1-A${totalSheetCount}
` : ''}

**Report ALL instances - CRITICAL**:
- If you see "1/A6" in two different locations, you MUST report BOTH
- Even if the text is identical, report each occurrence separately
- Scan the ENTIRE image systematically - don't stop after finding one instance
- Look carefully - some callouts may be in similar locations but are DIFFERENT instances
- If you find "1/A6" once, continue scanning - there may be another "1/A6" elsewhere
- Missing duplicate instances is a critical error - be thorough!

**Response format** (JSON only):
{
  "sheetNumber": "A2",
  "sheetTitle": "FOUNDATION PLAN",
  "imageWidth": ${imageWidth},
  "imageHeight": ${imageHeight},
  "callouts": [
    {
      "ref": "A6",
      "targetSheet": "A6",
      "type": "section",
      "bbox": {
        "x1": 4050,
        "y1": 700,
        "x2": 4150,
        "y2": 800
      },
      "confidence": 0.85
    },
    {
      "ref": "2/A5",
      "targetSheet": "A5",
      "type": "detail",
      "bbox": {
        "x1": 3650,
        "y1": 1050,
        "x2": 3750,
        "y2": 1150
      },
      "confidence": 0.90
    }
  ]
}

**CRITICAL**: 
- Provide bounding boxes (x1, y1, x2, y2), not single points
- The box should contain ONLY the callout symbol (circle/triangle) and its text
- DO NOT include dimension labels, notes, or other text
- If you're unsure whether something is a callout, ask: "Is this a small geometric symbol (circle/triangle) with sheet reference text?" If no, exclude it.

**Examples of what to EXCLUDE:**
- "OVERALL DIMENSION" labels → NOT a callout
- "CRAWLSPACE VENT SIZE" labels → NOT a callout  
- "SHEET NUMBER: A2" in title block → NOT a callout
- Any large text block → NOT a callout
- Scale bars, north arrows → NOT callouts

**Examples of what to INCLUDE:**
- Small circle with "2/A5" inside → YES, this is a callout
- Small triangle with "3/A5" inside → YES, this is a callout
- Small circle with "A6" inside → YES, this is a callout`;
}

/**
 * Build prompt for third pass (leader lines and detail markers)
 * Focuses on callouts with leader lines and detail-specific patterns
 */
function buildRegionDetectionPromptThirdPass(
  imageWidth: number,
  imageHeight: number,
  existingSheets: string[] = [],
  totalSheetCount?: number
): string {
  return `You are analyzing a construction plan sheet to detect callout symbols (sheet references).

**TASK**: Perform a FOCUSED scan specifically for callouts with leader lines and detail markers.

**Focus Areas for This Pass**:
1. **Leader lines**: Follow thin lines that point to details - callouts are at the end of these lines
2. **Detail markers**: Look for callouts near section cuts, detail views, or elevation markers
3. **Split text patterns**: Check for callouts where the number is above the circle and sheet reference is below
4. **Near annotations**: Look around detail bubbles, section markers, and elevation indicators
5. **Previously missed areas**: Double-check areas that might have been overlooked

**What are callouts?**
Callouts are SMALL SYMBOLS (geometric shapes) that reference other sheets:
- **Circular markers**: Small circles (15-50 pixels diameter) with text like "2/A5", "1/A6"
- **Triangular markers**: Small triangles (15-40 pixels) with text like "1/A5", "2/A5"
- Format: number/letter+number (e.g., "2/A5") or just letter+number (e.g., "A6")
- **Often have a leader line** (thin line) pointing to a detail
- Are SMALL symbols, not large text labels

**Text Layout Patterns**:
- Pattern 1: Number above circle, sheet below (e.g., "1" above, circle, "A6" below)
- Pattern 2: All text inside circle (e.g., "2/A5" inside circle)
- Pattern 3: Text adjacent to circle (e.g., circle with "A6" next to it)

**What are NOT callouts**:
- ❌ Dimension labels, title block text, general notes
- ❌ Large text blocks, scale bars, north arrows
- ❌ Any text NOT inside a small geometric symbol

**Visual Characteristics**:
- SMALL (15-50 pixels diameter/width)
- VISIBLE GEOMETRIC SHAPE (circle or triangle) around text
- Text INSIDE or IMMEDIATELY ADJACENT to shape
- Often have thin leader line
- Bounding box should be SMALL (25-80 pixels)

**Systematic Approach**:
1. Look for thin lines (leader lines) and follow them to find callouts
2. Check around detail markers and section cuts
3. Look for split text patterns (number above, sheet below)
4. Verify each symbol contains sheet reference text
5. Report ALL instances, even if text is identical

**Sheet Registry**:
${existingSheets.length > 0 ? `Valid sheets: ${existingSheets.join(", ")}` : ''}
${totalSheetCount ? `Sheet range: A1-A${totalSheetCount}` : ''}

**Response format** (JSON only):
{
  "sheetNumber": "A2",
  "sheetTitle": "FOUNDATION PLAN",
  "imageWidth": ${imageWidth},
  "imageHeight": ${imageHeight},
  "callouts": [
    {
      "ref": "2/A5",
      "targetSheet": "A5",
      "type": "detail",
      "bbox": {"x1": 3650, "y1": 1050, "x2": 3750, "y2": 1150},
      "confidence": 0.90
    }
  ]
}

**CRITICAL**: Report ALL callouts found, especially those with leader lines or near detail markers.`;
}

/**
 * Build alternative prompt for second pass (complementary angle)
 * Focuses on different aspects to catch callouts missed in first pass
 */
function buildRegionDetectionPromptSecondPass(
  imageWidth: number,
  imageHeight: number,
  existingSheets: string[] = [],
  totalSheetCount?: number
): string {
  return `You are analyzing a construction plan sheet to detect callout symbols (sheet references).

**TASK**: Perform a COMPLEMENTARY scan to find any callout symbols that may have been missed.

**Focus Areas for This Pass**:
1. **Edge regions**: Check the perimeter of the drawing - callouts often appear near edges
2. **Small symbols**: Pay special attention to very small symbols (15-30 pixels) that might be easy to miss
3. **Low contrast areas**: Look for callouts in areas with less visual contrast
4. **Near annotations**: Check areas near notes, dimensions, or other annotations
5. **Isolated symbols**: Look for callouts that appear alone, not in groups

**What are callouts?**
Callouts are SMALL SYMBOLS (geometric shapes) that reference other sheets:
- **Circular markers**: Small circles (15-50 pixels diameter) with text like "2/A5", "1/A6"
- **Triangular markers**: Small triangles (15-40 pixels) with text like "1/A5", "2/A5"
- Format: number/letter+number (e.g., "2/A5") or just letter+number (e.g., "A6")
- Usually have a leader line (thin line) pointing to a detail
- Are SMALL symbols, not large text labels

**What are NOT callouts**:
- ❌ Dimension labels, title block text, general notes
- ❌ Large text blocks, scale bars, north arrows
- ❌ Any text NOT inside a small geometric symbol

**Visual Characteristics**:
- SMALL (15-50 pixels diameter/width)
- VISIBLE GEOMETRIC SHAPE (circle or triangle) around text
- Text INSIDE or IMMEDIATELY ADJACENT to shape
- Often have thin leader line
- Bounding box should be SMALL (25-80 pixels)

**Systematic Approach**:
1. Scan methodically from top-left to bottom-right
2. Check every small geometric shape you see
3. Verify it contains sheet reference text
4. Don't skip any area - be thorough
5. Report ALL instances, even if text is identical

**Sheet Registry**:
${existingSheets.length > 0 ? `Valid sheets: ${existingSheets.join(", ")}` : ''}
${totalSheetCount ? `Sheet range: A1-A${totalSheetCount}` : ''}

**Response format** (JSON only):
{
  "sheetNumber": "A2",
  "sheetTitle": "FOUNDATION PLAN",
  "imageWidth": ${imageWidth},
  "imageHeight": ${imageHeight},
  "callouts": [
    {
      "ref": "2/A5",
      "targetSheet": "A5",
      "type": "detail",
      "bbox": {"x1": 3650, "y1": 1050, "x2": 3750, "y2": 1150},
      "confidence": 0.90
    }
  ]
}

**CRITICAL**: Report ALL callouts found, even if you think they might have been found in a previous pass.`;
}

/**
 * Parse LLM response with bounding boxes
 */
function parseRegionResponse(raw: string): { callouts: LLMRegion[]; sheetNumber: string; sheetTitle: string | null } {
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }
  
  const parsed = JSON.parse(cleaned) as {
    sheetNumber: string;
    sheetTitle: string | null;
    callouts: LLMRegion[];
  };
  
  // Normalize
  parsed.sheetNumber = parsed.sheetNumber.toUpperCase().trim();
  parsed.callouts = parsed.callouts.map(c => ({
    ...c,
    ref: c.ref.toUpperCase().trim(),
    targetSheet: c.targetSheet.toUpperCase().trim()
  }));
  
  // Filter out regions that are too large (likely text labels, not callouts)
  // Increased threshold slightly to catch more callouts
  const filteredCallouts = parsed.callouts.filter(c => {
    const width = c.bbox.x2 - c.bbox.x1;
    const height = c.bbox.y2 - c.bbox.y1;
    const maxDimension = Math.max(width, height);
    
    // Reject if bounding box is too large (likely a text label)
    // Increased from 150 to 200 to be less strict
    if (maxDimension > 200) {
      console.warn(`Rejecting region for ${c.ref}: bounding box too large (${maxDimension}px) - likely a text label, not a callout`);
      return false;
    }
    
    return true;
  });
  
  if (filteredCallouts.length < parsed.callouts.length) {
    console.log(`Filtered out ${parsed.callouts.length - filteredCallouts.length} regions that were too large (likely text labels)`);
  }
  
  return {
    ...parsed,
    callouts: filteredCallouts
  };
}

/**
 * Run OCR on a specific image region using the specified OCR engine
 */
async function runOCROnRegion(
  imagePath: string,
  bbox: { x1: number; y1: number; x2: number; y2: number },
  ocrAdapter: ReturnType<typeof createOCRAdapter>,
  padding: number = 30,  // Increased padding to catch more text
  preprocess: 'invert' | 'contrast' | 'none' = 'none'
): Promise<TesseractWord[]> {
  return ocrAdapter.extractTextFromRegion(imagePath, bbox, padding, preprocess);
}

/**
 * Deduplicate callouts that are too close together (likely false positives)
 * Also filters suspicious patterns like horizontal/vertical lines (likely dimension labels)
 * Improved logic to better distinguish legitimate duplicates from false positives
 */
function deduplicateCallouts(
  callouts: DetectedCallout[],
  imageWidth: number,
  imageHeight: number,
  minDistance: number = 100 // Minimum distance in pixels to consider separate instances
): DetectedCallout[] {
  if (callouts.length === 0) return [];
  
  // Group by callout reference
  const grouped = new Map<string, DetectedCallout[]>();
  for (const callout of callouts) {
    const key = callout.ref.toUpperCase().trim();
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(callout);
  }
  
  const result: DetectedCallout[] = [];
  
  for (const [ref, group] of grouped.entries()) {
    if (group.length === 1) {
      // Single detection - keep it
      result.push(group[0]);
      continue;
    }
    
    // Multiple detections with same ref - need to deduplicate
    // Sort by confidence (highest first)
    let filteredGroup = [...group].sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
    
    // Check for suspicious patterns (horizontal/vertical lines - likely dimension labels)
    // If more than expected instances, check for alignment patterns
    // Most callouts appear 1-2 times, but we need to be smarter about which to keep
    const expectedMaxInstances = 2; // Most callouts appear 1-2 times
    
    if (filteredGroup.length > expectedMaxInstances) {
      // Check if 3+ detections share the same Y coordinate (horizontal line)
      const yGroups = new Map<number, DetectedCallout[]>();
      for (const callout of filteredGroup) {
        const roundedY = Math.round(callout.y / 20) * 20; // Round to nearest 20px (more lenient)
        if (!yGroups.has(roundedY)) {
          yGroups.set(roundedY, []);
        }
        yGroups.get(roundedY)!.push(callout);
      }
      
      // If 3+ detections are at the same Y (within 20px), likely false positives
      for (const [y, aligned] of yGroups.entries()) {
        if (aligned.length >= 3) {
          console.log(`   Suspicious horizontal line detected for ${ref}: ${aligned.length} detections at y=${y} - keeping only highest confidence`);
          // Remove these from group and keep only the best one
          const best = aligned.sort((a, b) => (b.confidence || 0) - (a.confidence || 0))[0];
          filteredGroup = filteredGroup.filter(c => !aligned.includes(c) || c === best);
        }
      }
      
      // Same check for X coordinates (vertical line)
      const xGroups = new Map<number, DetectedCallout[]>();
      for (const callout of filteredGroup) {
        const roundedX = Math.round(callout.x / 20) * 20;
        if (!xGroups.has(roundedX)) {
          xGroups.set(roundedX, []);
        }
        xGroups.get(roundedX)!.push(callout);
      }
      
      for (const [x, aligned] of xGroups.entries()) {
        if (aligned.length >= 3) {
          console.log(`   Suspicious vertical line detected for ${ref}: ${aligned.length} detections at x=${x} - keeping only highest confidence`);
          const best = aligned.sort((a, b) => (b.confidence || 0) - (a.confidence || 0))[0];
          filteredGroup = filteredGroup.filter(c => !aligned.includes(c) || c === best);
        }
      }
      
      // If still too many after pattern filtering, apply smarter filtering
      if (filteredGroup.length > expectedMaxInstances) {
        // Check if we have legitimate duplicates (far apart) vs false positives (close together)
        // Keep the top 2 that are farthest apart
        if (filteredGroup.length > 2) {
          // Find the two detections that are farthest apart
          let maxDistance = 0;
          let bestPair: [DetectedCallout, DetectedCallout] | null = null;
          
          for (let i = 0; i < filteredGroup.length; i++) {
            for (let j = i + 1; j < filteredGroup.length; j++) {
              const distance = Math.sqrt(
                Math.pow(filteredGroup[i].x - filteredGroup[j].x, 2) +
                Math.pow(filteredGroup[i].y - filteredGroup[j].y, 2)
              );
              if (distance > maxDistance) {
                maxDistance = distance;
                bestPair = [filteredGroup[i], filteredGroup[j]];
              }
            }
          }
          
          // Improved logic: Check distance and confidence patterns
          // If we found a pair that's far apart (> 400px), likely legitimate duplicates
          // If moderately apart (200-400px), check quadrants and confidence
          // If close together (< 200px), likely false positives
          if (bestPair && maxDistance > 400) {
            // Very far apart - almost certainly legitimate duplicates
            console.log(`   Too many instances for ${ref} (${filteredGroup.length}), keeping 2 farthest apart (distance: ${Math.round(maxDistance)}px) - likely legitimate`);
            filteredGroup = bestPair;
          } else if (bestPair && maxDistance > 200) {
            // Moderate distance - check if they're in different quadrants AND have good confidence
            const [c1, c2] = bestPair;
            const q1 = getQuadrant(c1.x, c1.y, imageWidth, imageHeight);
            const q2 = getQuadrant(c2.x, c2.y, imageWidth, imageHeight);
            
            // Check if both have reasonable confidence (not just one high-confidence detection)
            const avgConfidence = ((c1.confidence || 0) + (c2.confidence || 0)) / 2;
            const minConfidence = Math.min(c1.confidence || 0, c2.confidence || 0);
            
            if (q1 !== q2 && minConfidence > 0.4) {
              // Different quadrants AND both have decent confidence - likely legitimate
              console.log(`   Too many instances for ${ref} (${filteredGroup.length}), keeping 2 in different quadrants (distance: ${Math.round(maxDistance)}px, avg conf: ${avgConfidence.toFixed(2)})`);
              filteredGroup = bestPair;
            } else if (q1 === q2 && avgConfidence > 0.6) {
              // Same quadrant but high confidence - might be legitimate, keep both
              console.log(`   Too many instances for ${ref} (${filteredGroup.length}), same quadrant but high confidence (${avgConfidence.toFixed(2)}) - keeping 2`);
              filteredGroup = bestPair;
            } else {
              // Same quadrant and low confidence - likely false positives, keep only best
              console.log(`   Too many instances for ${ref} (${filteredGroup.length}), same quadrant, low confidence - keeping only highest confidence`);
              filteredGroup = [filteredGroup[0]];
            }
          } else {
            // Close together - likely false positives, but check confidence
            const topConfidence = filteredGroup[0].confidence || 0;
            if (topConfidence > 0.7 && filteredGroup.length === 2) {
              // High confidence and only 2 instances - might be legitimate, keep both
              console.log(`   Close instances for ${ref} (${filteredGroup.length}), but high confidence (${topConfidence.toFixed(2)}) - keeping both`);
              filteredGroup = filteredGroup.slice(0, 2);
            } else {
              console.log(`   Too many instances for ${ref} (${filteredGroup.length}), all close together (< 200px) - keeping only highest confidence`);
              filteredGroup = [filteredGroup[0]];
            }
          }
        } else {
          // Exactly 3 instances - check if top 2 are far apart
          if (filteredGroup.length >= 2) {
            const dist = Math.sqrt(
              Math.pow(filteredGroup[0].x - filteredGroup[1].x, 2) +
              Math.pow(filteredGroup[0].y - filteredGroup[1].y, 2)
            );
            if (dist > 200) {
              // Top 2 are far apart - keep them
              console.log(`   Exactly 3 instances for ${ref}, keeping top 2 (distance: ${Math.round(dist)}px)`);
              filteredGroup = filteredGroup.slice(0, 2);
            } else {
              // Top 2 are close - keep only best
              console.log(`   Exactly 3 instances for ${ref}, top 2 are close - keeping only best`);
              filteredGroup = [filteredGroup[0]];
            }
          } else {
            filteredGroup = filteredGroup.slice(0, expectedMaxInstances);
          }
        }
      }
    }
    
    // Final pass: Keep detections that are far enough apart, but be smarter about it
    const kept: DetectedCallout[] = [];
    
    for (const candidate of filteredGroup) {
      // Check if this candidate is far enough from all kept detections
      const isFarEnough = kept.every(keptCallout => {
        const distance = Math.sqrt(
          Math.pow(candidate.x - keptCallout.x, 2) +
          Math.pow(candidate.y - keptCallout.y, 2)
        );
        return distance >= minDistance;
      });
      
      if (isFarEnough) {
        kept.push(candidate);
      } else {
        // Too close to an existing detection - check if we should replace or keep both
        const closest = kept.find(k => {
          const distance = Math.sqrt(
            Math.pow(candidate.x - k.x, 2) +
            Math.pow(candidate.y - k.y, 2)
          );
          return distance < minDistance;
        });
        
        if (closest) {
          const distance = Math.sqrt(
            Math.pow(candidate.x - closest.x, 2) +
            Math.pow(candidate.y - closest.y, 2)
          );
          
          // If very close (< 50px) and candidate has much higher confidence, replace
          if (distance < 50 && (candidate.confidence || 0) > (closest.confidence || 0) + 0.15) {
            const index = kept.indexOf(closest);
            kept[index] = candidate;
            console.log(`   Replaced ${ref} detection (distance: ${Math.round(distance)}px, conf: ${(closest.confidence || 0).toFixed(2)} → ${(candidate.confidence || 0).toFixed(2)})`);
          }
          // If moderately close (50-100px) and both have good confidence, might be legitimate duplicates
          else if (distance >= 50 && (candidate.confidence || 0) > 0.5 && (closest.confidence || 0) > 0.5) {
            // Check if they're in different quadrants
            const q1 = getQuadrant(candidate.x, candidate.y, imageWidth, imageHeight);
            const q2 = getQuadrant(closest.x, closest.y, imageWidth, imageHeight);
            if (q1 !== q2) {
              kept.push(candidate);
              console.log(`   Keeping both ${ref} detections (distance: ${Math.round(distance)}px, different quadrants)`);
            }
          }
        }
      }
    }
    
    result.push(...kept);
  }
  
  return result;
}

/**
 * Merge LLM regions from multiple passes, removing duplicates
 * Two regions are considered duplicates if they have the same ref and are close together
 * More conservative: only add from later passes if it's clearly a new detection
 */
function mergeLLMRegions(regions1: LLMRegion[], regions2: LLMRegion[], regions3?: LLMRegion[]): LLMRegion[] {
  let merged: LLMRegion[] = [...regions1];
  const positionTolerance = 100; // pixels - more conservative
  
  // Merge pass 2
  for (const region2 of regions2) {
    const isDuplicate = merged.some(region1 => {
      if (region1.ref.toUpperCase().trim() !== region2.ref.toUpperCase().trim()) {
        return false;
      }
      
      const center1X = (region1.bbox.x1 + region1.bbox.x2) / 2;
      const center1Y = (region1.bbox.y1 + region1.bbox.y2) / 2;
      const center2X = (region2.bbox.x1 + region2.bbox.x2) / 2;
      const center2Y = (region2.bbox.y1 + region2.bbox.y2) / 2;
      
      const distance = Math.sqrt(
        Math.pow(center1X - center2X, 2) +
        Math.pow(center1Y - center2Y, 2)
      );
      
      return distance < positionTolerance;
    });
    
    if (!isDuplicate) {
      merged.push({
        ...region2,
        confidence: region2.confidence * 0.9 // Slightly lower confidence for second pass
      });
    }
  }
  
  // Merge pass 3 if provided
  if (regions3) {
    for (const region3 of regions3) {
      const isDuplicate = merged.some(existing => {
        if (existing.ref.toUpperCase().trim() !== region3.ref.toUpperCase().trim()) {
          return false;
        }
        
        const centerExistingX = (existing.bbox.x1 + existing.bbox.x2) / 2;
        const centerExistingY = (existing.bbox.y1 + existing.bbox.y2) / 2;
        const center3X = (region3.bbox.x1 + region3.bbox.x2) / 2;
        const center3Y = (region3.bbox.y1 + region3.bbox.y2) / 2;
        
        const distance = Math.sqrt(
          Math.pow(centerExistingX - center3X, 2) +
          Math.pow(centerExistingY - center3Y, 2)
        );
        
        return distance < positionTolerance;
      });
      
      if (!isDuplicate) {
        merged.push({
          ...region3,
          confidence: region3.confidence * 0.85 // Even lower confidence for third pass
        });
      }
    }
  }
  
  return merged;
}

/**
 * Get quadrant of a point in an image (1-4)
 */
function getQuadrant(x: number, y: number, width: number, height: number): number {
  const midX = width / 2;
  const midY = height / 2;
  if (x < midX && y < midY) return 1; // Top-left
  if (x >= midX && y < midY) return 2; // Top-right
  if (x < midX && y >= midY) return 3; // Bottom-left
  return 4; // Bottom-right
}

/**
 * Calculate variance of a set of numbers
 */
function calculateVariance(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
  return squaredDiffs.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Find exact text position for a callout within a region
 */
function findExactTextPosition(
  words: TesseractWord[],
  expectedRef: string,
  region: LLMRegion
): { x: number; y: number; confidence: number } | null {
  // Look for text matching the expected reference
  const normalizedExpected = expectedRef.toUpperCase().trim();
  
  // Try exact match first
  for (const word of words) {
    const patterns = extractCalloutPatterns(word.text);
    for (const pattern of patterns) {
      if (pattern.toUpperCase().trim() === normalizedExpected) {
        // Found exact match - use center of word bounding box
        return {
          x: Math.round(word.left + word.width / 2),
          y: Math.round(word.top + word.height / 2),
          confidence: word.conf / 100.0
        };
      }
    }
  }
  
  // Try fuzzy matching - combine nearby words that might form the callout
  // This handles cases where OCR splits "2/A5" into "2" and "A5"
  const combinedText = words.map(w => w.text).join(" ").toUpperCase();
  const combinedPatterns = extractCalloutPatterns(combinedText);
  for (const pattern of combinedPatterns) {
    if (pattern.toUpperCase().trim() === normalizedExpected) {
      // Found in combined text - use center of all words
      const avgX = words.reduce((sum, w) => sum + w.left + w.width/2, 0) / words.length;
      const avgY = words.reduce((sum, w) => sum + w.top + w.height/2, 0) / words.length;
      const avgConf = words.reduce((sum, w) => sum + w.conf, 0) / words.length;
      return {
        x: Math.round(avgX),
        y: Math.round(avgY),
        confidence: avgConf / 100.0
      };
    }
  }
  
  // If no exact match, try to find text within the region
  // and use the center of the region as fallback
  const regionCenterX = (region.bbox.x1 + region.bbox.x2) / 2;
  const regionCenterY = (region.bbox.y1 + region.bbox.y2) / 2;
  
  // Check if any words are within the region
  const wordsInRegion = words.filter(w => 
    w.left >= region.bbox.x1 && 
    w.left + w.width <= region.bbox.x2 &&
    w.top >= region.bbox.y1 &&
    w.top + w.height <= region.bbox.y2
  );
  
  if (wordsInRegion.length > 0) {
    // Use center of words in region
    const avgX = wordsInRegion.reduce((sum, w) => sum + w.left + w.width/2, 0) / wordsInRegion.length;
    const avgY = wordsInRegion.reduce((sum, w) => sum + w.top + w.height/2, 0) / wordsInRegion.length;
    return {
      x: Math.round(avgX),
      y: Math.round(avgY),
      confidence: region.confidence * 0.7 // Lower confidence if no exact match
    };
  }
  
  // Fallback: use region center
  return {
    x: Math.round(regionCenterX),
    y: Math.round(regionCenterY),
    confidence: region.confidence * 0.5 // Even lower confidence
  };
}

/**
 * Region-based detection: LLM finds regions, OCR finds exact positions
 */
export async function detectCalloutsRegionBased(
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
    // Step 1: Convert PDF to PNG
    const outputPath = `${outputDir}/${Date.now()}.png`;
    const imageInfo: ImageInfo = await convertPdfToImage(pdfPath, outputPath, dpi);
    
    console.log(`📄 Image: ${imageInfo.width}x${imageInfo.height}px at ${dpi} DPI`);
    
    // Step 2: Convert PNG to base64 for LLM
    const imageBuffer = await Bun.file(imageInfo.path).arrayBuffer();
    const base64 = Buffer.from(imageBuffer).toString('base64');
    const imageDataUrl = `data:image/png;base64,${base64}`;
    
    // Step 3: Multi-pass LLM detection for better recall
    console.log("🔍 Step 1: LLM identifying callout regions (Pass 1/3)...");
    const prompt1 = buildRegionDetectionPrompt(
      imageInfo.width,
      imageInfo.height,
      existingSheets,
      totalSheetCount
    );
    
    const llmResponse1 = await callOpenRouter(prompt1, [imageDataUrl], { model });
    const { callouts: llmRegions1, sheetNumber, sheetTitle } = parseRegionResponse(llmResponse1);
    
    console.log(`   Pass 1: Found ${llmRegions1.length} callout regions`);
    
    // Second pass with complementary prompt
    console.log("🔍 Step 1b: Complementary scan (Pass 2/3)...");
    const prompt2 = buildRegionDetectionPromptSecondPass(
      imageInfo.width,
      imageInfo.height,
      existingSheets,
      totalSheetCount
    );
    
    const llmResponse2 = await callOpenRouter(prompt2, [imageDataUrl], { model });
    const { callouts: llmRegions2 } = parseRegionResponse(llmResponse2);
    
    console.log(`   Pass 2: Found ${llmRegions2.length} callout regions`);
    
    // Third pass focused on leader lines and detail markers
    console.log("🔍 Step 1c: Leader line and detail marker scan (Pass 3/3)...");
    const prompt3 = buildRegionDetectionPromptThirdPass(
      imageInfo.width,
      imageInfo.height,
      existingSheets,
      totalSheetCount
    );
    
    const llmResponse3 = await callOpenRouter(prompt3, [imageDataUrl], { model });
    const { callouts: llmRegions3 } = parseRegionResponse(llmResponse3);
    
    console.log(`   Pass 3: Found ${llmRegions3.length} callout regions`);
    
    // Merge results from all three passes, removing duplicates based on position
    const mergedRegions = mergeLLMRegions(llmRegions1, llmRegions2, llmRegions3);
    console.log(`   Merged: ${llmRegions1.length} + ${llmRegions2.length} + ${llmRegions3.length} → ${mergedRegions.length} unique regions`);
    
    const llmRegions = mergedRegions;
    
    // DEBUG: Log all regions found by LLM
    console.log(`\n📊 DEBUG: LLM Found ${llmRegions.length} regions:`);
    for (const region of llmRegions) {
      console.log(`   - ${region.ref} at bbox (${region.bbox.x1}, ${region.bbox.y1}) to (${region.bbox.x2}, ${region.bbox.y2}), confidence: ${region.confidence.toFixed(2)}`);
    }
    console.log('');
    
    if (llmRegions.length === 0) {
      return {
        success: true,
        sheetNumber,
        sheetTitle,
        calloutsFound: 0,
        calloutsMatched: 0,
        hyperlinks: [],
        unmatchedCallouts: [],
        processingTimeMs: Date.now() - startTime
      };
    }
    
    // Step 4: For each LLM region, use OCR to find exact text position
    console.log(`🔍 Step 2: Using ${ocrEngine.toUpperCase()} OCR to find exact positions in ${llmRegions.length} regions...`);
    const ocrAdapter = createOCRAdapter(ocrEngine);
    const detectedCallouts: DetectedCallout[] = [];
    
    for (let i = 0; i < llmRegions.length; i++) {
      const region = llmRegions[i];
      console.log(`\n   Processing region ${i + 1}/${llmRegions.length}: ${region.ref}`);
      console.log(`      LLM says: "${region.ref}" at bbox (${region.bbox.x1}, ${region.bbox.y1}) to (${region.bbox.x2}, ${region.bbox.y2})`);
      
      // Run OCR on the region (with standard padding)
      let words = await runOCROnRegion(imageInfo.path, region.bbox, ocrAdapter, 30);
      console.log(`      OCR found ${words.length} words: ${words.map(w => `"${w.text}"`).join(', ')}`);
      
      // Find exact text position
      let exactPosition = findExactTextPosition(words, region.ref, region);
      
      // If not found, try with expanded region (larger padding)
      if (!exactPosition) {
        console.log(`      ❌ No matching text found, trying expanded region...`);
        words = await runOCROnRegion(imageInfo.path, region.bbox, ocrAdapter, 50);
        console.log(`      OCR found ${words.length} words: ${words.map(w => `"${w.text}"`).join(', ')}`);
        exactPosition = findExactTextPosition(words, region.ref, region);
      }
      
      // If still not found, try with inverted colors (for black background/white text)
      if (!exactPosition) {
        console.log(`      ❌ No matching text found, trying inverted colors...`);
        words = await ocrAdapter.extractTextFromRegion(imageInfo.path, region.bbox, 30, 'invert');
        console.log(`      OCR found ${words.length} words: ${words.map(w => `"${w.text}"`).join(', ')}`);
        exactPosition = findExactTextPosition(words, region.ref, region);
      }
      
      // If still not found, try with contrast enhancement
      if (!exactPosition) {
        console.log(`      ❌ No matching text found, trying contrast enhancement...`);
        words = await ocrAdapter.extractTextFromRegion(imageInfo.path, region.bbox, 30, 'contrast');
        console.log(`      OCR found ${words.length} words: ${words.map(w => `"${w.text}"`).join(', ')}`);
        exactPosition = findExactTextPosition(words, region.ref, region);
      }
      
      // Validate: If OCR found text but it doesn't match, this might be a false positive
      if (exactPosition && words.length > 0) {
        // Check if any words match the expected pattern
        const allPatterns = words.flatMap(w => extractCalloutPatterns(w.text));
        const hasMatchingPattern = allPatterns.some(p => 
          p.toUpperCase().trim() === region.ref.toUpperCase().trim()
        );
        
        if (!hasMatchingPattern) {
          // OCR found text but it doesn't match - likely false positive, skip
          console.warn(`      ⚠️  SKIPPING: LLM said "${region.ref}" but OCR found: ${words.map(w => w.text).join(' ')}`);
          console.warn(`         Extracted patterns: ${allPatterns.join(', ')} (expected: ${region.ref})`);
          continue; // Skip this detection
        } else {
          console.log(`      ✅ MATCH: OCR confirmed "${region.ref}" at position (${exactPosition.x}, ${exactPosition.y})`);
        }
      } else if (!exactPosition) {
        console.log(`      ⚠️  NO OCR MATCH: Using LLM region center as fallback (confidence: ${region.confidence.toFixed(2)})`);
      }
      
      if (exactPosition) {
        // Combine LLM and OCR confidence
        // If from second pass (lower confidence), weight it slightly less
        const baseConfidence = region.confidence < 0.85 ? region.confidence * 0.55 : region.confidence * 0.6;
        const combinedConfidence = baseConfidence + exactPosition.confidence * 0.4;
        
        detectedCallouts.push({
          ref: region.ref,
          targetSheet: region.targetSheet,
          type: region.type,
          x: exactPosition.x,
          y: exactPosition.y,
          confidence: combinedConfidence
        });
      } else {
        // Fallback: use region center if OCR finds nothing
        // Lower confidence if OCR found nothing, especially for second pass
        const centerX = (region.bbox.x1 + region.bbox.x2) / 2;
        const centerY = (region.bbox.y1 + region.bbox.y2) / 2;
        const fallbackConfidence = region.confidence < 0.85 
          ? region.confidence * 0.5  // Second/third pass with no OCR match - lower confidence
          : region.confidence * 0.6;  // First pass with no OCR match
        
        detectedCallouts.push({
          ref: region.ref,
          targetSheet: region.targetSheet,
          type: region.type,
          x: Math.round(centerX),
          y: Math.round(centerY),
          confidence: fallbackConfidence
        });
      }
    }
    
    // Step 5: Deduplicate nearby detections
    // Group by callout reference and filter duplicates that are too close together
    let deduplicatedCallouts = deduplicateCallouts(detectedCallouts, imageInfo.width, imageInfo.height);
    
    // DEBUG: Summary of what was found vs expected
    console.log(`\n📊 DEBUG SUMMARY:`);
    console.log(`   LLM found ${llmRegions.length} regions`);
    console.log(`   OCR validated ${detectedCallouts.length} callouts`);
    console.log(`   After deduplication: ${deduplicatedCallouts.length} callouts`);
    
    // Group by ref to see what we have
    const byRef = new Map<string, number>();
    for (const callout of deduplicatedCallouts) {
      const key = callout.ref;
      byRef.set(key, (byRef.get(key) || 0) + 1);
    }
    console.log(`   Detected callouts by reference:`);
    for (const [ref, count] of byRef.entries()) {
      console.log(`      ${ref}: ${count} instance(s)`);
    }
    console.log('');
    
    if (deduplicatedCallouts.length < detectedCallouts.length) {
      console.log(`   Deduplicated: ${detectedCallouts.length} → ${deduplicatedCallouts.length} callouts`);
    }
    
    // Filter by confidence - remove very low confidence detections (likely false positives)
    // Use a lower threshold to avoid removing legitimate callouts
    const minConfidence = 0.3; // Lowered from 0.4 to preserve more detections
    const beforeConfidenceFilter = deduplicatedCallouts.length;
    deduplicatedCallouts = deduplicatedCallouts.filter(c => (c.confidence || 0) >= minConfidence);
    if (deduplicatedCallouts.length < beforeConfidenceFilter) {
      console.log(`   Confidence filter: ${beforeConfidenceFilter} → ${deduplicatedCallouts.length} callouts (removed < ${minConfidence} confidence)`);
    }
    
    // If still too many, apply stricter deduplication with larger distance threshold
    if (deduplicatedCallouts.length > 10) {
      console.log(`   Warning: Found ${deduplicatedCallouts.length} callouts (expected ~10), applying stricter filtering...`);
      const stricterDedup = deduplicateCallouts(deduplicatedCallouts, imageInfo.width, imageInfo.height, 200);
      if (stricterDedup.length < deduplicatedCallouts.length) {
        console.log(`   Stricter deduplication: ${deduplicatedCallouts.length} → ${stricterDedup.length} callouts`);
        deduplicatedCallouts = stricterDedup;
      }
    }
    
    // Step 6: Normalize coordinates and build result
    const hyperlinks = deduplicatedCallouts.map(callout => {
      const normalized = normalizeCoordinates(
        { x: callout.x, y: callout.y },
        imageInfo.width,
        imageInfo.height
      );
      
      // Calculate final confidence (use deduplicated list for context)
      const finalConfidence = calculateCalloutConfidence(
        callout,
        imageInfo.width,
        imageInfo.height,
        existingSheets,
        deduplicatedCallouts
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
    
    return {
      success: true,
      sheetNumber,
      sheetTitle,
      calloutsFound: detectedCallouts.length,
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

