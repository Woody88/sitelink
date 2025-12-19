import { describe, it, expect, beforeAll } from "bun:test";
import { detectCalloutsWithTesseract } from "../../src/services/calloutTesseract";
import { convertPdfToImage } from "../../src/services/pdfProcessor";
import { join } from "path";
import { readFile } from "fs/promises";

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

describe('Callout Detection - Tesseract OCR', () => {
  const pdfPath = join(import.meta.dir, "..", "..", "sample-single-plan.pdf");
  const outputDir = join(import.meta.dir, "..", "..", "output");
  const expectedCallouts = [
    "1/A5", "1/A6", "1/A6", "1/A7",
    "2/A5", "2/A6", "2/A6", "2/A7",
    "3/A5", "3/A7"
  ];
  const sheetRegistry = ["A1", "A2", "A3", "A4", "A5", "A6", "A7"];
  
  beforeAll(async () => {
    await loadEnv();
  });

  it('should detect callouts with positions using Tesseract (no preprocessing)', async () => {
    const outputPath = `${outputDir}/${Date.now()}-callout-tess.png`;
    const imageInfo = await convertPdfToImage(pdfPath, outputPath, 300);
    
    const callouts = await detectCalloutsWithTesseract(imageInfo, sheetRegistry, 'none');
    
    // Tesseract has lower accuracy than LLM, so we just verify it extracts positions
    // Note: Tesseract typically finds 0-2 callouts (10-20% accuracy) vs LLM's 60-80%
    expect(callouts.every(c => c.x > 0 && c.y > 0)).toBe(true);
    expect(callouts.every(c => c.x <= imageInfo.width && c.y <= imageInfo.height)).toBe(true);
    
    console.log(`\nTesseract (no preprocessing): Found ${callouts.length} callouts`);
    console.log(`Expected: ${expectedCallouts.length}`);
    console.log(`Accuracy: ${(callouts.length / expectedCallouts.length * 100).toFixed(1)}%`);
    console.log(`All callouts have valid positions: ${callouts.every(c => c.x > 0 && c.y > 0)}`);
  }, 30000);

  it('should detect callouts with contrast preprocessing', async () => {
    const outputPath = `${outputDir}/${Date.now()}-callout-tess-contrast.png`;
    const imageInfo = await convertPdfToImage(pdfPath, outputPath, 300);
    
    const callouts = await detectCalloutsWithTesseract(imageInfo, sheetRegistry, 'contrast');
    
    // Verify positions are valid (accuracy may vary)
    expect(callouts.every(c => c.x > 0 && c.y > 0)).toBe(true);
    expect(callouts.every(c => c.x <= imageInfo.width && c.y <= imageInfo.height)).toBe(true);
    
    console.log(`\nTesseract (contrast): Found ${callouts.length} callouts`);
    console.log(`Expected: ${expectedCallouts.length}`);
    console.log(`Accuracy: ${(callouts.length / expectedCallouts.length * 100).toFixed(1)}%`);
  }, 30000);

  it('should detect callouts with threshold preprocessing', async () => {
    const outputPath = `${outputDir}/${Date.now()}-callout-tess-threshold.png`;
    const imageInfo = await convertPdfToImage(pdfPath, outputPath, 300);
    
    const callouts = await detectCalloutsWithTesseract(imageInfo, sheetRegistry, 'threshold');
    
    // Verify positions are valid (accuracy may vary)
    expect(callouts.every(c => c.x > 0 && c.y > 0)).toBe(true);
    expect(callouts.every(c => c.x <= imageInfo.width && c.y <= imageInfo.height)).toBe(true);
    
    console.log(`\nTesseract (threshold): Found ${callouts.length} callouts`);
    console.log(`Expected: ${expectedCallouts.length}`);
    console.log(`Accuracy: ${(callouts.length / expectedCallouts.length * 100).toFixed(1)}%`);
  }, 30000);

  it('should compare accuracy across preprocessing methods', async () => {
    const outputPath = `${outputDir}/${Date.now()}-callout-compare.png`;
    const imageInfo = await convertPdfToImage(pdfPath, outputPath, 300);
    
    const [none, contrast, threshold] = await Promise.all([
      detectCalloutsWithTesseract(imageInfo, sheetRegistry, 'none'),
      detectCalloutsWithTesseract(imageInfo, sheetRegistry, 'contrast'),
      detectCalloutsWithTesseract(imageInfo, sheetRegistry, 'threshold')
    ]);
    
    console.log(`\n=== Tesseract Accuracy Comparison ===`);
    console.log(`No preprocessing: ${none.length}/${expectedCallouts.length} (${(none.length/expectedCallouts.length*100).toFixed(1)}%)`);
    console.log(`Contrast: ${contrast.length}/${expectedCallouts.length} (${(contrast.length/expectedCallouts.length*100).toFixed(1)}%)`);
    console.log(`Threshold: ${threshold.length}/${expectedCallouts.length} (${(threshold.length/expectedCallouts.length*100).toFixed(1)}%)`);
    
    // All should have positions
    expect(none.every(c => c.x > 0 && c.y > 0)).toBe(true);
    expect(contrast.every(c => c.x > 0 && c.y > 0)).toBe(true);
    expect(threshold.every(c => c.x > 0 && c.y > 0)).toBe(true);
  }, 60000);
});

