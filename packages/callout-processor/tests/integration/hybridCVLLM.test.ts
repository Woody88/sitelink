import { describe, test, expect, beforeAll } from "bun:test";
import { detectCalloutsHybridCVLLM } from "../../src/services/hybridCVLLMDetection";
import { join } from "path";

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

describe("Hybrid CV + LLM Detection", () => {
  beforeAll(async () => {
    await loadEnv();
  });

  test("should detect callouts using hybrid CV+LLM approach with different DPI and contrast", async () => {
    const pdfPath = join(import.meta.dir, "..", "..", "sample-single-plan.pdf");
    const outputDir = join(import.meta.dir, "..", "..", "output");
    
    const existingSheets = ["A1", "A2", "A3", "A4", "A5", "A6", "A7"];
    
    // Test with different DPI and contrast settings
    const testCases = [
      { dpi: 200, contrast: 1.0, name: "200 DPI, no contrast" },
      { dpi: 300, contrast: 1.5, name: "300 DPI, 1.5x contrast" },
      { dpi: 400, contrast: 2.0, name: "400 DPI, 2.0x contrast" },
    ];
    
    for (const testCase of testCases) {
      console.log(`\n🧪 Testing: ${testCase.name}`);
      
      const result = await detectCalloutsHybridCVLLM(
        pdfPath,
        existingSheets,
        outputDir,
        testCase.dpi,
        testCase.contrast,
        7,
        "google/gemini-2.5-flash",
        true // useLLMValidation
      );
      
      console.log(`   DPI: ${testCase.dpi}, Contrast: ${testCase.contrast}x`);
      console.log(`   Callouts found: ${result.calloutsFound}`);
      if (result.confidenceStats) {
        console.log(`   Average confidence: ${(result.confidenceStats.averageConfidence * 100).toFixed(1)}%`);
      }
      
      // Check that we got some results (or graceful failure)
      if (result.error?.includes("OpenCV not available")) {
        console.log("   ⚠️  OpenCV not available - test skipped");
        continue;
      }
      
      expect(result.success).toBe(true);
      
      // Check that coordinates are valid if we have results
      if (result.calloutsFound > 0) {
        result.hyperlinks.forEach(h => {
          expect(h.pixelX).toBeGreaterThanOrEqual(0);
          expect(h.pixelY).toBeGreaterThanOrEqual(0);
          expect(h.x).toBeGreaterThanOrEqual(0);
          expect(h.x).toBeLessThanOrEqual(1);
          expect(h.y).toBeGreaterThanOrEqual(0);
          expect(h.y).toBeLessThanOrEqual(1);
        });
      }
    }
  }, 300000); // 5 minute timeout for multiple test cases
});

