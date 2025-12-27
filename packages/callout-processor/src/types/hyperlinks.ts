/**
 * Type definitions for sheet hyperlink detection system
 */

export interface DetectedCallout {
  ref: string;               // "A6", "2/A5", "3/A5"
  targetSheet: string;       // "A6", "A5"
  type: 'section' | 'detail' | 'elevation' | 'plan' | 'revision' | 'unknown';
  x: number;                 // pixel coordinate
  y: number;                 // pixel coordinate
  confidence?: number;
}

export interface VisionLLMResponse {
  sheetNumber: string;
  sheetTitle: string | null;
  imageWidth: number;
  imageHeight: number;
  callouts: DetectedCallout[];
}

export interface AnalysisResult {
  success: boolean;
  sheetNumber: string;
  sheetTitle: string | null;
  calloutsFound: number;
  calloutsMatched: number;
  hyperlinks: Array<{
    calloutRef: string;
    targetSheetRef: string;
    x: number;  // normalized 0-1
    y: number;  // normalized 0-1
    pixelX: number;
    pixelY: number;
    confidence?: number;
  }>;
  unmatchedCallouts: string[];  // callouts referencing non-existent sheets
  processingTimeMs: number;
  confidenceStats?: {
    highConfidence: number;
    lowConfidence: number;
    averageConfidence: number;
    needsManualReview: boolean;
  };
  error?: string;
}

export interface PixelCoordinate {
  x: number;
  y: number;
}

export interface NormalizedCoordinate {
  x: number;  // 0-1
  y: number;  // 0-1
}

export interface ImageInfo {
  path: string;
  width: number;
  height: number;
  dpi: number;
}

export interface TitleBlockInfo {
  sheetNumber: string | null;
  sheetTitle: string | null;
  notes: string | null;
  titleBlockLocation?: {
    region: 'bottom-right' | 'right-side' | 'bottom' | 'top-right' | 'other';
    confidence: number;
  };
}

