import { describe, it, expect } from "bun:test";
import { convertPdfToImage } from "../../src/services/pdfProcessor";
import { analyzeTitleBlockWithTesseract } from "../../src/services/titleBlockTesseract";
import { join } from "path";

describe("Title Block - Tesseract OCR", () => {
  const pdfPath = join(import.meta.dir, "..", "..", "sample-single-plan.pdf");
  const outputDir = join(import.meta.dir, "..", "..", "output");

  it("should extract sheet number close to A2", async () => {
    const outputPath = `${outputDir}/${Date.now()}-tess.png`;
    const imageInfo = await convertPdfToImage(pdfPath, outputPath, 300);

    const result = await analyzeTitleBlockWithTesseract(imageInfo.path);

    expect(result.sheetNumber).toBeTruthy();
    expect(result.sheetNumber).toMatch(/[A-Z]\d{1,3}/);
  }, 30000);

  it("should extract a title containing FOUNDATION", async () => {
    const outputPath = `${outputDir}/${Date.now()}-tess.png`;
    const imageInfo = await convertPdfToImage(pdfPath, outputPath, 300);

    const result = await analyzeTitleBlockWithTesseract(imageInfo.path);

    expect(result.sheetTitle).toBeTruthy();
    expect((result.sheetTitle || "").length).toBeGreaterThan(5);
  }, 30000);
});

