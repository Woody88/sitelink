import { describe, test, expect, beforeAll } from "bun:test";
import { detectCalloutsHybrid } from "../../src/services/hybridDetection";
import { convertPdfToImage } from "../../src/services/pdfProcessor";
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

describe("Hybrid Detection (OCR + LLM Validation)", () => {
  beforeAll(async () => {
    await loadEnv();
  });

  test("should detect callouts with precise coordinates from Tesseract", async () => {
    const pdfPath = join(import.meta.dir, "..", "..", "sample-single-plan.pdf");
    const outputDir = join(import.meta.dir, "..", "..", "output");
    
    // Convert PDF to image
    const outputPath = `${outputDir}/${Date.now()}-hybrid-test.png`;
    const imageInfo = await convertPdfToImage(pdfPath, outputPath, 300);
    
    // Expected callouts: [1/A5, 1/A6, 3/A5, 2/A6, 2/A6, 2/A7, 3/A7, 1/A7, 1/A6, 2/A5]
    const existingSheets = ["A1", "A2", "A3", "A4", "A5", "A6", "A7"];
    
    const callouts = await detectCalloutsHybrid(
      imageInfo,
      existingSheets,
      "google/gemini-2.5-flash",
      3 // Small batch size for testing
    );
    
    console.log(`\n✅ Hybrid detection found ${callouts.length} validated callouts`);
    console.log("Detected callouts:");
    callouts.forEach(c => {
      console.log(`  - ${c.ref} at (${c.x}, ${c.y})px, confidence: ${((c.confidence || 0) * 100).toFixed(1)}%`);
    });
    
    // Check that we got some results
    expect(callouts.length).toBeGreaterThan(0);
    
    // Check that coordinates are within image bounds
    callouts.forEach(c => {
      expect(c.x).toBeGreaterThanOrEqual(0);
      expect(c.x).toBeLessThanOrEqual(imageInfo.width);
      expect(c.y).toBeGreaterThanOrEqual(0);
      expect(c.y).toBeLessThanOrEqual(imageInfo.height);
    });
    
    // Check that all callouts have confidence scores
    callouts.forEach(c => {
      expect(c.confidence).toBeDefined();
      expect(c.confidence).toBeGreaterThanOrEqual(0);
      expect(c.confidence).toBeLessThanOrEqual(1);
    });
  }, 120000); // 2 minute timeout for LLM calls
});

