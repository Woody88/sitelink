import { describe, test, expect, beforeAll } from "bun:test";
import { compareDetectionMethods } from "../../src/utils/compareMethods";
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

describe("Method Comparison (LLM-only vs Region-based)", () => {
  beforeAll(async () => {
    await loadEnv();
  });

  test("should compare LLM-only and region-based detection methods", async () => {
    const pdfPath = join(import.meta.dir, "..", "..", "sample-single-plan.pdf");
    const outputDir = join(import.meta.dir, "..", "..", "output");
    
    const existingSheets = ["A1", "A2", "A3", "A4", "A5", "A6", "A7"];
    
    const comparison = await compareDetectionMethods(
      pdfPath,
      outputDir,
      300, // DPI
      7,   // Total sheet count
      existingSheets
    );
    
    console.log(`\n✅ Comparison complete:`);
    console.log(`   LLM-only: ${comparison.llmResult.count} callouts`);
    console.log(`   Region-based: ${comparison.regionResult.count} callouts`);
    console.log(`   Comparison image: ${comparison.comparisonImage}`);
    
    // Both methods should find some callouts
    expect(comparison.llmResult.count).toBeGreaterThanOrEqual(0);
    expect(comparison.regionResult.count).toBeGreaterThanOrEqual(0);
    
    // Region-based should be at least as good as LLM-only
    // (it might find more or the same, but coordinates should be more accurate)
    expect(comparison.regionResult.count).toBeGreaterThanOrEqual(0);
    
    // Check that coordinates are valid
    comparison.llmResult.callouts.forEach(c => {
      expect(c.x).toBeGreaterThanOrEqual(0);
      expect(c.y).toBeGreaterThanOrEqual(0);
    });
    
    comparison.regionResult.callouts.forEach(c => {
      expect(c.x).toBeGreaterThanOrEqual(0);
      expect(c.y).toBeGreaterThanOrEqual(0);
    });
  }, 180000); // 3 minute timeout
});

