#!/usr/bin/env bun

/**
 * Benchmark script to test OCR accuracy at different DPI levels
 * Tests: Tesseract vs PaddleOCR at 300, 400, and 600 DPI
 */

import { detectCalloutsRegionBased } from "./services/regionBasedDetection";
import { isPaddleOCRAvailable } from "./services/ocrAdapter";
import { join } from "path";

interface BenchmarkResult {
  dpi: number;
  ocrEngine: "tesseract" | "paddleocr";
  calloutsFound: number;
  processingTimeMs: number;
  accuracy: number;
  averageConfidence: number;
}

/**
 * Expected callouts for validation (from sample PDF)
 */
const EXPECTED_CALLOUTS = [
  "1/A5", "1/A6", "1/A6", "1/A7",
  "2/A5", "2/A6", "2/A6", "2/A7",
  "3/A5", "3/A7"
];

/**
 * Calculate accuracy based on detected vs expected callouts
 */
function calculateAccuracy(
  detected: string[],
  expected: string[]
): number {
  const expectedCounts = expected.reduce((acc, ref) => {
    acc[ref] = (acc[ref] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const detectedCounts = detected.reduce((acc, ref) => {
    acc[ref] = (acc[ref] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  let correct = 0;
  let total = expected.length;

  // Count correct detections
  for (const [ref, expectedCount] of Object.entries(expectedCounts)) {
    const detectedCount = detectedCounts[ref] || 0;
    correct += Math.min(expectedCount, detectedCount);
  }

  // Penalize false positives
  for (const [ref, detectedCount] of Object.entries(detectedCounts)) {
    if (!expectedCounts[ref]) {
      total += detectedCount; // Add false positives to total
    }
  }

  return total > 0 ? correct / total : 0;
}

/**
 * Run a single benchmark test
 */
async function runBenchmark(
  pdfPath: string,
  dpi: number,
  ocrEngine: "tesseract" | "paddleocr",
  existingSheets: string[],
  totalSheetCount: number
): Promise<BenchmarkResult> {
  console.log(`\n📊 Testing: ${ocrEngine.toUpperCase()} at ${dpi} DPI...`);
  
  const startTime = Date.now();
  const result = await detectCalloutsRegionBased(
    pdfPath,
    existingSheets,
    "./output",
    dpi,
    totalSheetCount,
    "google/gemini-2.5-flash",
    ocrEngine
  );
  const processingTime = Date.now() - startTime;

  const detectedRefs = result.hyperlinks.map(h => h.calloutRef);
  const accuracy = calculateAccuracy(detectedRefs, EXPECTED_CALLOUTS);

  return {
    dpi,
    ocrEngine,
    calloutsFound: result.calloutsFound,
    processingTimeMs: processingTime,
    accuracy,
    averageConfidence: result.confidenceStats?.averageConfidence || 0
  };
}

/**
 * Main benchmark function
 */
async function main() {
  // Load environment variables
  const envPath = join(import.meta.dir, "..", ".env");
  try {
    const envFile = await Bun.file(envPath).text();
    for (const line of envFile.split("\n")) {
      const [key, ...valueParts] = line.split("=");
      if (key && valueParts.length > 0) {
        const value = valueParts.join("=").trim();
        if (value && !value.startsWith("#")) {
          process.env[key.trim()] = value.replace(/^["']|["']$/g, "");
        }
      }
    }
  } catch (error) {
    console.warn("Could not load .env file, using environment variables");
  }

  // Parse command line arguments
  const args = process.argv.slice(2);
  const pdfPath = args.find(arg => !arg.startsWith("--")) || 
    join(import.meta.dir, "..", "sample-single-plan.pdf");
  
  const sheetCountArg = args.find(arg => arg.startsWith("--sheets="));
  const totalSheetCount = sheetCountArg ? parseInt(sheetCountArg.split("=")[1]) : 7;

  // Build sheet registry
  const sheetRegistry: string[] = [];
  for (let i = 1; i <= totalSheetCount; i++) {
    sheetRegistry.push(`A${i}`);
  }

  console.log("=".repeat(60));
  console.log("OCR Benchmark: DPI and Engine Comparison");
  console.log("=".repeat(60));
  console.log(`PDF: ${pdfPath}`);
  console.log(`Expected callouts: ${EXPECTED_CALLOUTS.length} instances`);
  console.log(`Sheet registry: ${sheetRegistry.join(", ")}`);
  console.log("=".repeat(60));

  // Check PaddleOCR availability
  const paddleOCRAvailable = await isPaddleOCRAvailable();
  if (!paddleOCRAvailable) {
    console.log("\n⚠️  PaddleOCR not available. Install with: pip install paddleocr");
    console.log("   Will only test Tesseract.\n");
  }

  const results: BenchmarkResult[] = [];
  const dpiLevels = [300, 400, 600];

  // Test Tesseract at all DPI levels
  for (const dpi of dpiLevels) {
    try {
      const result = await runBenchmark(
        pdfPath,
        dpi,
        "tesseract",
        sheetRegistry,
        totalSheetCount
      );
      results.push(result);
    } catch (error) {
      console.error(`❌ Tesseract at ${dpi} DPI failed: ${error}`);
    }
  }

  // Test PaddleOCR at all DPI levels (if available)
  if (paddleOCRAvailable) {
    for (const dpi of dpiLevels) {
      try {
        const result = await runBenchmark(
          pdfPath,
          dpi,
          "paddleocr",
          sheetRegistry,
          totalSheetCount
        );
        results.push(result);
      } catch (error) {
        console.error(`❌ PaddleOCR at ${dpi} DPI failed: ${error}`);
      }
    }
  }

  // Print results table
  console.log("\n" + "=".repeat(60));
  console.log("BENCHMARK RESULTS");
  console.log("=".repeat(60));
  console.log(
    "DPI".padEnd(6) +
    "Engine".padEnd(12) +
    "Found".padEnd(8) +
    "Accuracy".padEnd(12) +
    "Confidence".padEnd(12) +
    "Time (s)".padEnd(10)
  );
  console.log("-".repeat(60));

  for (const result of results) {
    console.log(
      `${result.dpi}`.padEnd(6) +
      `${result.ocrEngine}`.padEnd(12) +
      `${result.calloutsFound}`.padEnd(8) +
      `${(result.accuracy * 100).toFixed(1)}%`.padEnd(12) +
      `${(result.averageConfidence * 100).toFixed(1)}%`.padEnd(12) +
      `${(result.processingTimeMs / 1000).toFixed(1)}`.padEnd(10)
    );
  }

  // Find best configuration
  const bestResult = results.reduce((best, current) => {
    // Prioritize accuracy, then confidence, then speed
    if (current.accuracy > best.accuracy) return current;
    if (current.accuracy === best.accuracy) {
      if (current.averageConfidence > best.averageConfidence) return current;
      if (current.averageConfidence === best.averageConfidence) {
        if (current.processingTimeMs < best.processingTimeMs) return current;
      }
    }
    return best;
  }, results[0]);

  console.log("\n" + "=".repeat(60));
  console.log("RECOMMENDED CONFIGURATION");
  console.log("=".repeat(60));
  console.log(`OCR Engine: ${bestResult.ocrEngine.toUpperCase()}`);
  console.log(`DPI: ${bestResult.dpi}`);
  console.log(`Accuracy: ${(bestResult.accuracy * 100).toFixed(1)}%`);
  console.log(`Average Confidence: ${(bestResult.averageConfidence * 100).toFixed(1)}%`);
  console.log(`Processing Time: ${(bestResult.processingTimeMs / 1000).toFixed(1)}s`);

  // Save results to JSON
  const outputPath = join(import.meta.dir, "..", "output", "benchmark-results.json");
  await Bun.write(outputPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    pdfPath,
    expectedCallouts: EXPECTED_CALLOUTS.length,
    results,
    bestConfiguration: bestResult
  }, null, 2));

  console.log(`\nResults saved to: ${outputPath}`);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

