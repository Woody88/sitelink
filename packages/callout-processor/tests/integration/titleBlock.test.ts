import { describe, it, expect, beforeAll } from "bun:test";
import { analyzeTitleBlock } from "../../src/services/titleBlockAnalysis";
import { convertPdfToImage } from "../../src/services/pdfProcessor";
import { join } from "path";
import { readFile } from "fs/promises";

// Load environment variables
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

describe('Title Block Detection Integration', () => {
  const pdfPath = join(import.meta.dir, "..", "..", "sample-single-plan.pdf");
  const outputDir = join(import.meta.dir, "..", "..", "output");
  
  beforeAll(async () => {
    await loadEnv();
  });

  it('should successfully extract title block information', async () => {
    // Convert PDF to image
    const outputPath = `${outputDir}/${Date.now()}-titleblock.png`;
    const imageInfo = await convertPdfToImage(pdfPath, outputPath, 300);
    
    // Analyze title block
    const result = await analyzeTitleBlock(imageInfo);

    expect(result.sheetNumber).toBeTruthy();
    expect(result.sheetTitle).toBeTruthy();
  }, 60000);

  it('should detect correct sheet number A2', async () => {
    const outputPath = `${outputDir}/${Date.now()}-titleblock.png`;
    const imageInfo = await convertPdfToImage(pdfPath, outputPath, 300);
    
    const result = await analyzeTitleBlock(imageInfo);

    expect(result.sheetNumber).toBe("A2");
  }, 60000);

  it('should detect sheet title containing FOUNDATION', async () => {
    const outputPath = `${outputDir}/${Date.now()}-titleblock.png`;
    const imageInfo = await convertPdfToImage(pdfPath, outputPath, 300);
    
    const result = await analyzeTitleBlock(imageInfo);

    expect(result.sheetTitle).toBeTruthy();
    expect(result.sheetTitle?.toUpperCase()).toContain("FOUNDATION");
  }, 60000);
});

