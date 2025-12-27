import { describe, test, expect, beforeAll } from "bun:test";
import { detectCalloutsRegionBased } from "../../src/services/regionBasedDetection";
import { join } from "path";
import { drawCalloutBoxes } from "../../src/utils/visualizeCallouts";

async function loadEnv() {
  const envPath = join(import.meta.dir, "..", "..", ".env");
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
    console.warn("Could not load .env file");
  }
}

describe("Region-Based Detection (LLM Regions + OCR Positions)", () => {
  beforeAll(async () => {
    await loadEnv();
  });

  test("should detect callouts with precise coordinates using region-based approach", async () => {
    const pdfPath = join(import.meta.dir, "..", "..", "sample-single-plan.pdf");
    const outputDir = join(import.meta.dir, "..", "..", "output");
    
    // Expected callouts: [1/A5, 1/A6, 3/A5, 2/A6, 2/A6, 2/A7, 3/A7, 1/A7, 1/A6, 2/A5]
    const existingSheets = ["A1", "A2", "A3", "A4", "A5", "A6", "A7"];
    
    const result = await detectCalloutsRegionBased(
      pdfPath,
      existingSheets,
      outputDir,
      300, // DPI
      7,   // Total sheet count
      "google/gemini-2.5-flash"
    );
    
    console.log(`\n✅ Region-based detection results:`);
    console.log(`   Success: ${result.success}`);
    console.log(`   Callouts found: ${result.calloutsFound}`);
    if (result.confidenceStats) {
      console.log(`   High confidence: ${result.confidenceStats.highConfidence}`);
      console.log(`   Low confidence: ${result.confidenceStats.lowConfidence}`);
      console.log(`   Average confidence: ${(result.confidenceStats.averageConfidence * 100).toFixed(1)}%`);
    }
    
    console.log("\nDetected callouts:");
    result.hyperlinks.forEach(h => {
      console.log(`  - ${h.calloutRef} at (${h.pixelX}, ${h.pixelY})px, confidence: ${((h.confidence || 0) * 100).toFixed(1)}%`);
    });
    
    // Check that we got results
    expect(result.success).toBe(true);
    expect(result.calloutsFound).toBeGreaterThan(0);
    
    // Check that coordinates are valid
    result.hyperlinks.forEach(h => {
      expect(h.pixelX).toBeGreaterThanOrEqual(0);
      expect(h.pixelY).toBeGreaterThanOrEqual(0);
      expect(h.x).toBeGreaterThanOrEqual(0);
      expect(h.x).toBeLessThanOrEqual(1);
      expect(h.y).toBeGreaterThanOrEqual(0);
      expect(h.y).toBeLessThanOrEqual(1);
    });
    
    // Visualize results (if we can find a source image)
    // Note: The region-based detection creates its own image, so we'd need to track that
    // For now, skip visualization in test
  }, 180000); // 3 minute timeout for LLM + OCR calls
});

