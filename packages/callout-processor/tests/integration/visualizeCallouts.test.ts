import { describe, it, expect, beforeAll } from "bun:test";
import { drawCalloutBoxes } from "../../src/utils/visualizeCallouts";
import { analyzeSheet, MODELS } from "../../src/services/visionAnalysis";
import { detectCalloutsWithTesseract } from "../../src/services/calloutTesseract";
import { convertPdfToImage } from "../../src/services/pdfProcessor";
import { join } from "path";
import { readFile } from "fs/promises";
import { existsSync } from "fs";

async function loadEnv() {
  const envPath = join(import.meta.dir, "..", "..", ".env");
  try {
    const envFile = await readFile(envPath, "utf-8");
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

describe('Callout Position Visualization', () => {
  const pdfPath = join(import.meta.dir, "..", "..", "sample-single-plan.pdf");
  const outputDir = join(import.meta.dir, "..", "..", "output");
  const sheetRegistry = ["A1", "A2", "A3", "A4", "A5", "A6", "A7"];
  
  beforeAll(async () => {
    await loadEnv();
  });

  it('should draw red boxes on PNG for LLM-detected callouts', async () => {
    const timestamp = Date.now();
    const sourceImagePath = `${outputDir}/${timestamp}-source.png`;
    const outputPath = `${outputDir}/${timestamp}-llm-visualization.png`;
    
    // Convert PDF to PNG
    const imageInfo = await convertPdfToImage(pdfPath, sourceImagePath, 300);
    
    // Detect callouts using LLM
    const result = await analyzeSheet(
      pdfPath,
      sheetRegistry,
      outputDir,
      300,
      7,
      true, // enableRetry
      MODELS.FLASH
    );
    
    // Convert hyperlinks to DetectedCallout format
    const callouts = result.hyperlinks.map(h => ({
      ref: h.calloutRef,
      targetSheet: h.targetSheetRef,
      type: 'detail' as const,
      x: h.pixelX,
      y: h.pixelY,
      confidence: h.confidence
    }));
    
    // Draw red boxes directly on the PNG (use larger box size for easier verification)
    await drawCalloutBoxes(imageInfo.path, callouts, outputPath, 80);
    
    // Verify output file exists
    expect(await existsSync(outputPath)).toBe(true);
    
    console.log(`\n✅ LLM Visualization saved to: ${outputPath}`);
    console.log(`   Detected ${callouts.length} callouts`);
    console.log(`   Red boxes drawn directly on PNG image`);
    console.log(`   Open the PNG to verify if boxes are positioned correctly on callouts`);
  }, 60000);

  it('should draw red boxes on PNG for Tesseract-detected callouts', async () => {
    const timestamp = Date.now();
    const sourceImagePath = `${outputDir}/${timestamp}-source-tess.png`;
    const outputPath = `${outputDir}/${timestamp}-tesseract-visualization.png`;
    
    // Convert PDF to PNG
    const imageInfo = await convertPdfToImage(pdfPath, sourceImagePath, 300);
    
    // Detect callouts using Tesseract
    const callouts = await detectCalloutsWithTesseract(imageInfo, sheetRegistry, 'none');
    
    if (callouts.length > 0) {
      // Draw red boxes directly on the PNG (use larger box size for easier verification)
      await drawCalloutBoxes(imageInfo.path, callouts, outputPath, 80);
      
      // Verify output file exists
      expect(await existsSync(outputPath)).toBe(true);
      
      console.log(`\n✅ Tesseract Visualization saved to: ${outputPath}`);
      console.log(`   Detected ${callouts.length} callouts`);
      console.log(`   Red boxes drawn directly on PNG image`);
      console.log(`   Open the PNG to verify if boxes are positioned correctly on callouts`);
    } else {
      console.log(`\n⚠️  Tesseract found 0 callouts, skipping visualization`);
    }
  }, 30000);
});

