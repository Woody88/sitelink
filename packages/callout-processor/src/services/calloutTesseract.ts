import { $ } from "bun";
import type { DetectedCallout, ImageInfo } from "../types/hyperlinks";

/**
 * Tesseract TSV output format:
 * level	page_num	block_num	par_num	line_num	word_num	left	top	width	height	conf	text
 */
export interface TesseractWord {
  left: number;
  top: number;
  width: number;
  height: number;
  conf: number;
  text: string;
}

/**
 * Parse Tesseract TSV output to extract word positions
 */
export function parseTesseractTSV(tsv: string): TesseractWord[] {
  const lines = tsv.trim().split('\n');
  if (lines.length < 2) return [];
  
  // Skip header line
  const words: TesseractWord[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split('\t');
    if (cols.length >= 12) {
      const left = parseInt(cols[6]);
      const top = parseInt(cols[7]);
      const width = parseInt(cols[8]);
      const height = parseInt(cols[9]);
      const conf = parseInt(cols[10]);
      const text = cols[11]?.trim() || '';
      
      if (text && !isNaN(left) && !isNaN(top) && !isNaN(width) && !isNaN(height)) {
        words.push({ left, top, width, height, conf, text });
      }
    }
  }
  return words;
}

/**
 * Detect callout patterns in text
 * Matches: "2/A5", "1/A6", "3/A7", "A6", etc.
 * Also handles OCR errors like "2/A5" -> "2/A5" or "2/AS" -> "2/A5"
 */
export function extractCalloutPatterns(text: string): string[] {
  // Normalize common OCR errors
  let normalized = text.toUpperCase();
  // Fix common OCR mistakes: O->0, I->1, S->5, Z->2, etc.
  normalized = normalized
    .replace(/O(?=\d)/g, '0')  // O before digit -> 0
    .replace(/I(?=\d)/g, '1')  // I before digit -> 1
    .replace(/S(?=\d)/g, '5')  // S before digit -> 5
    .replace(/Z(?=\d)/g, '2'); // Z before digit -> 2
  
  // Pattern: number/letter+number OR just letter+number
  const patterns = [
    /\b\d+\/[A-Z]\d+\b/g,  // "2/A5", "1/A6"
    /\b[A-Z]\d+\b/g,       // "A5", "A6" (standalone sheet refs)
  ];
  
  const matches: string[] = [];
  for (const pattern of patterns) {
    const found = normalized.match(pattern);
    if (found) {
      matches.push(...found);
    }
  }
  
  // Also try fuzzy matching for common OCR errors
  // Look for patterns like "2/A5" even if OCR reads it as "2/AS" or "2/AO"
  const fuzzyPattern = /\b(\d+)\/([A-Z])([0-9OISZ]+)\b/g;
  let fuzzyMatch;
  while ((fuzzyMatch = fuzzyPattern.exec(normalized)) !== null) {
    const num = fuzzyMatch[1];
    const letter = fuzzyMatch[2];
    let digit = fuzzyMatch[3]
      .replace(/O/g, '0')
      .replace(/I/g, '1')
      .replace(/S/g, '5')
      .replace(/Z/g, '2');
    
    // Only accept if it looks like a valid sheet reference (A1-A9 or A10-A99)
    if (/^[A-Z][0-9]{1,2}$/.test(letter + digit)) {
      const candidate = `${num}/${letter}${digit}`;
      if (!matches.includes(candidate)) {
        matches.push(candidate);
      }
    }
  }
  
  return [...new Set(matches)]; // deduplicate
}

/**
 * Group nearby words that might form a callout
 * e.g., "2" and "A5" near each other might be "2/A5"
 */
function groupNearbyWords(words: TesseractWord[], maxDistance: number = 30): TesseractWord[][] {
  const groups: TesseractWord[][] = [];
  const used = new Set<number>();
  
  for (let i = 0; i < words.length; i++) {
    if (used.has(i)) continue;
    
    const group = [words[i]];
    used.add(i);
    
    for (let j = i + 1; j < words.length; j++) {
      if (used.has(j)) continue;
      
      const word1 = words[i];
      const word2 = words[j];
      
      // Check if words are nearby (horizontally or vertically)
      const distance = Math.sqrt(
        Math.pow((word1.left + word1.width/2) - (word2.left + word2.width/2), 2) +
        Math.pow((word1.top + word1.height/2) - (word2.top + word2.height/2), 2)
      );
      
      if (distance <= maxDistance) {
        group.push(word2);
        used.add(j);
      }
    }
    
    if (group.length > 0) {
      groups.push(group);
    }
  }
  
  return groups;
}

/**
 * Preprocess image to improve OCR accuracy
 */
async function preprocessImage(inputPath: string, outputPath: string, method: 'contrast' | 'threshold' | 'none' = 'contrast'): Promise<string> {
  if (method === 'none') return inputPath;
  
  try {
    if (method === 'contrast') {
      // Increase contrast using vips
      await $`vips linear ${inputPath} ${outputPath} 1.5 0`.quiet();
    } else if (method === 'threshold') {
      // Convert to binary (black/white) using threshold
      await $`vips threshold ${inputPath} ${outputPath} 128`.quiet();
    }
    return outputPath;
  } catch (error) {
    console.warn(`Image preprocessing failed: ${error}, using original`);
    return inputPath;
  }
}

/**
 * Run Tesseract OCR with bounding box output
 */
async function runTesseractWithBoxes(imagePath: string): Promise<TesseractWord[]> {
  // Use TSV output format which includes coordinates
  // Syntax: tesseract image stdout tsv (tsv is the output format, not a flag)
  const { stdout } = await $`tesseract ${imagePath} stdout -l eng tsv`.quiet();
  const tsv = stdout.toString();
  return parseTesseractTSV(tsv);
}

/**
 * Result from Tesseract detection including bounding boxes
 */
export interface TesseractCalloutResult {
  callout: DetectedCallout;
  boundingBox: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
}

/**
 * Detect callouts using Tesseract OCR with position extraction
 * Returns both callouts and their bounding boxes
 */
export async function detectCalloutsWithTesseractAndBoxes(
  imageInfo: ImageInfo,
  existingSheets: string[] = [],
  preprocess: 'contrast' | 'threshold' | 'none' = 'contrast'
): Promise<TesseractCalloutResult[]> {
  const results: TesseractCalloutResult[] = [];
  
  // Preprocess image if requested
  let imagePath = imageInfo.path;
  if (preprocess !== 'none') {
    const preprocessedPath = `${imageInfo.path}.preprocessed.png`;
    imagePath = await preprocessImage(imageInfo.path, preprocessedPath, preprocess);
  }
  
  // Run Tesseract with bounding boxes
  const words = await runTesseractWithBoxes(imagePath);
  
  // Extract callout patterns from individual words
  for (const word of words) {
    const patterns = extractCalloutPatterns(word.text);
    for (const pattern of patterns) {
      // Calculate center position
      const centerX = word.left + word.width / 2;
      const centerY = word.top + word.height / 2;
      
      // Extract target sheet
      const targetSheet = pattern.includes('/') 
        ? pattern.split('/')[1] 
        : pattern;
      
      // Filter by existing sheets if provided
      if (existingSheets.length > 0 && !existingSheets.includes(targetSheet)) {
        continue;
      }
      
      // Determine type (heuristic)
      let type: DetectedCallout['type'] = 'unknown';
      if (pattern.includes('/')) {
        type = 'detail'; // Assume detail if has slash
      } else {
        type = 'section';
      }
      
      results.push({
        callout: {
          ref: pattern,
          targetSheet,
          type,
          x: Math.round(centerX),
          y: Math.round(centerY),
          confidence: word.conf / 100.0 // Convert 0-100 to 0-1
        },
        boundingBox: {
          left: word.left,
          top: word.top,
          width: word.width,
          height: word.height
        }
      });
    }
  }
  
  // Try grouping nearby words to find split callouts (e.g., "2" and "A5" separate)
  const groups = groupNearbyWords(words, 30);
  for (const group of groups) {
    const combinedText = group.map(w => w.text).join('');
    const patterns = extractCalloutPatterns(combinedText);
    
    for (const pattern of patterns) {
      // Calculate bounding box for the group
      const minLeft = Math.min(...group.map(w => w.left));
      const minTop = Math.min(...group.map(w => w.top));
      const maxRight = Math.max(...group.map(w => w.left + w.width));
      const maxBottom = Math.max(...group.map(w => w.top + w.height));
      
      const centerX = (minLeft + maxRight) / 2;
      const centerY = (minTop + maxBottom) / 2;
      
      const targetSheet = pattern.includes('/') 
        ? pattern.split('/')[1] 
        : pattern;
      
      if (existingSheets.length > 0 && !existingSheets.includes(targetSheet)) {
        continue;
      }
      
      // Check if this is a duplicate (same position)
      const isDuplicate = results.some(r => 
        Math.abs(r.callout.x - centerX) < 20 && 
        Math.abs(r.callout.y - centerY) < 20 &&
        r.callout.ref === pattern
      );
      
      if (!isDuplicate) {
        results.push({
          callout: {
            ref: pattern,
            targetSheet,
            type: pattern.includes('/') ? 'detail' : 'section',
            x: Math.round(centerX),
            y: Math.round(centerY),
            confidence: group.reduce((sum, w) => sum + w.conf, 0) / group.length / 100.0
          },
          boundingBox: {
            left: minLeft,
            top: minTop,
            width: maxRight - minLeft,
            height: maxBottom - minTop
          }
        });
      }
    }
  }
  
  return results;
}

/**
 * Detect callouts using Tesseract OCR with position extraction
 */
export async function detectCalloutsWithTesseract(
  imageInfo: ImageInfo,
  existingSheets: string[] = [],
  preprocess: 'contrast' | 'threshold' | 'none' = 'contrast'
): Promise<DetectedCallout[]> {
  const results = await detectCalloutsWithTesseractAndBoxes(imageInfo, existingSheets, preprocess);
  return results.map(r => r.callout);
}

