#!/usr/bin/env bun

import { analyzeSheet, MODELS, ModelType } from "./services/visionAnalysis";
import { detectCalloutsRegionBased } from "./services/regionBasedDetection";
import { detectCalloutsComputerVision } from "./services/computerVisionDetection";
import { detectCalloutsHybridCVLLM } from "./services/hybridCVLLMDetection";
import { detectCalloutsEnsemble } from "./services/ensembleDetection";
import { detectCalloutsWithCVLLM } from "./services/cvLLMDetection";
import { analyzeTitleBlock } from "./services/titleBlockAnalysis";
import { convertPdfToImage } from "./services/pdfProcessor";
import { join } from "path";

/**
 * Main entry point for sheet reference detection
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
  // Skip first two args (node/bun path and script path)
  const args = process.argv.slice(2);
  
  // Find PDF path (first non-flag argument)
  const pdfPath = args.find(arg => !arg.startsWith("--")) || join(import.meta.dir, "..", "sample-single-plan.pdf");
  
  // Get DPI from command line or use default (300 for better detection)
  const dpiArg = args.find(arg => arg.startsWith("--dpi="));
  const dpi = dpiArg ? parseInt(dpiArg.split("=")[1]) : 300;
  
  // Get contrast from command line or use default (1.5 for better detection)
  const contrastArg = args.find(arg => arg.startsWith("--contrast="));
  const contrast = contrastArg ? parseFloat(contrastArg.split("=")[1]) : 1.5;
  
  // Get total sheet count from command line or use default (7 for sample plan)
  const sheetCountArg = args.find(arg => arg.startsWith("--sheets="));
  const totalSheetCount = sheetCountArg ? parseInt(sheetCountArg.split("=")[1]) : 7;
  
  // Get model from command line or use default (flash)
  // Options: flash, pro (2.5), pro3 (3.0)
  const modelArg = args.find(arg => arg.startsWith("--model="));
  const modelName = modelArg ? modelArg.split("=")[1] : "flash";
  const model: ModelType = modelName === "pro3" ? MODELS.PRO_3 
    : modelName === "pro" ? MODELS.PRO_25 
    : MODELS.FLASH;
  
  // Get detection method from command line or use default (cvllm - enhanced CV + LLM)
  // Options: llm (original), region (region-based), cv-only (CV only), hybrid (CV + LLM), 
  //          ensemble (region + CV), cvllm (enhanced CV shapes + LLM validation - recommended)
  const methodArg = args.find(arg => arg.startsWith("--method="));
  const method = methodArg ? methodArg.split("=")[1] : "cvllm";
  
  // Get OCR engine from command line or use default (tesseract)
  // Options: tesseract, paddleocr
  const ocrEngineArg = args.find(arg => arg.startsWith("--ocr="));
  const ocrEngine = ocrEngineArg ? ocrEngineArg.split("=")[1] as "tesseract" | "paddleocr" : "tesseract";
  
  console.log(`Processing PDF: ${pdfPath}`);
  console.log(`DPI: ${dpi}`);
  console.log(`Contrast: ${contrast}x`);
  console.log(`Total sheets in plan set: ${totalSheetCount}`);
  console.log(`Model: ${model}`);
  console.log(`Method: ${method}`);
  console.log(`OCR Engine: ${ocrEngine}`);
  console.log("Starting analysis...\n");

  const outputDir = join(import.meta.dir, "..", "output");

  // Step 1: Convert PDF to image (needed for both analyses)
  const imagePath = `${outputDir}/${Date.now()}.png`;
  const imageInfo = await convertPdfToImage(pdfPath, imagePath, dpi);

  // Step 2: Analyze title block (sheet number, title, notes)
  console.log("=== Title Block Analysis ===");
  const titleBlockInfo = await analyzeTitleBlock(imageInfo);
  console.log(`Sheet Number: ${titleBlockInfo.sheetNumber || "Not detected"}`);
  console.log(`Sheet Title: ${titleBlockInfo.sheetTitle || "Not detected"}`);
  if (titleBlockInfo.notes) {
    console.log(`Notes: ${titleBlockInfo.notes.substring(0, 100)}...`);
  }
  console.log("");

  // Step 3: Build sheet registry
  // For now, we only have one sheet, but in a full implementation,
  // this would collect sheet numbers from all sheets in the plan set
  const sheetRegistry: string[] = [];
  
  // In a full implementation with multiple sheets:
  // - Process all PDFs in the plan set
  // - Extract sheet number from each title block
  // - Build registry: ["A1", "A2", "A3", "A4", "A5", "A6", "A7"]
  // For now, we'll generate expected range based on detected sheet prefix
  if (titleBlockInfo.sheetNumber && totalSheetCount) {
    // Extract prefix from detected sheet (e.g., "A" from "A2")
    const baseSheet = titleBlockInfo.sheetNumber;
    const sheetPrefix = baseSheet.match(/^[A-Z]+/)?.[0] || "A";
    
    // Generate sheet range starting from 1 (e.g., A1-A7)
    // This assumes sheets are numbered sequentially from 1
    for (let i = 1; i <= totalSheetCount; i++) {
      const sheetNum = `${sheetPrefix}${i}`;
      sheetRegistry.push(sheetNum);
    }
  } else if (titleBlockInfo.sheetNumber) {
    // If no total count, just use the detected sheet
    sheetRegistry.push(titleBlockInfo.sheetNumber);
  }

  console.log(`Sheet Registry: ${sheetRegistry.join(', ')}`);
  console.log("");

  // Step 4: Analyze callouts with sheet registry
  console.log("=== Callout Detection ===");
  let result;
  
  if (method === "hybrid" || method === "cv") {
    // Hybrid CV + LLM detection: Detect shapes with CV, validate with LLM
    console.log("Using hybrid detection (Computer Vision + LLM validation)...\n");
    result = await detectCalloutsHybridCVLLM(
      pdfPath,
      sheetRegistry,
      outputDir,
      dpi,
      contrast,
      totalSheetCount,
      model,
      true // useLLMValidation
    );
    
    // Fallback to LLM-only if OpenCV not available
    if (!result.success && result.error?.includes("OpenCV not available")) {
      console.log("\n⚠️  Falling back to LLM-only detection with contrast preprocessing...\n");
      // Use LLM with preprocessed image
      result = await analyzeSheet(
        pdfPath,
        sheetRegistry,
        outputDir,
        dpi,
        totalSheetCount,
        true, // enableRetry
        model
      );
    }
  } else if (method === "cv-only") {
    // Computer vision only (no LLM validation)
    console.log("Using computer vision detection (OpenCV shapes + OCR text, no LLM)...\n");
    result = await detectCalloutsHybridCVLLM(
      pdfPath,
      sheetRegistry,
      outputDir,
      dpi,
      contrast,
      totalSheetCount,
      model,
      false // useLLMValidation
    );
  } else if (method === "region") {
    // Region-based detection: LLM finds regions, OCR finds exact positions
    console.log("Using region-based detection (LLM regions + OCR positions)...\n");
    result = await detectCalloutsRegionBased(
      pdfPath,
      sheetRegistry,
      outputDir,
      dpi,
      totalSheetCount,
      model,
      ocrEngine
    );
  } else if (method === "ensemble") {
    // Ensemble detection: Combines region-based + computer vision
    console.log("Using ensemble detection (Region-based + Computer Vision)...\n");
    result = await detectCalloutsEnsemble(
      pdfPath,
      sheetRegistry,
      outputDir,
      dpi,
      totalSheetCount,
      model,
      ocrEngine
    );
  } else if (method === "cvllm") {
    // CV → LLM detection: OpenCV finds shapes, LLM validates and reads text
    console.log("Using CV → LLM detection (Enhanced OpenCV shapes + LLM validation)...\n");
    result = await detectCalloutsWithCVLLM(
      pdfPath,
      sheetRegistry,
      outputDir,
      dpi,
      totalSheetCount,
      model,
      titleBlockInfo.sheetNumber || undefined  // Pass current sheet to filter self-references
    );
  } else {
    // Original LLM-only detection
    console.log("Using LLM-only detection...\n");
    result = await analyzeSheet(
      pdfPath,
      sheetRegistry,
      outputDir,
      dpi,
      totalSheetCount,
      true, // enableRetry
      model
    );
  }

  // Output results
  console.log("\n=== Analysis Results ===");
  console.log(`Success: ${result.success}`);
  console.log(`Sheet Number: ${result.sheetNumber}`);
  console.log(`Sheet Title: ${result.sheetTitle || "N/A"}`);
  console.log(`Callouts Found: ${result.calloutsFound}`);
  console.log(`Callouts Matched: ${result.calloutsMatched}`);
  console.log(`Processing Time: ${result.processingTimeMs}ms`);
  
  // Confidence statistics
  if (result.confidenceStats) {
    console.log("\n=== Confidence Statistics ===");
    console.log(`High Confidence (>=50%): ${result.confidenceStats.highConfidence}`);
    console.log(`Low Confidence (<50%): ${result.confidenceStats.lowConfidence}`);
    console.log(`Average Confidence: ${(result.confidenceStats.averageConfidence * 100).toFixed(1)}%`);
    if (result.confidenceStats.needsManualReview) {
      console.log(`⚠️  ${result.confidenceStats.lowConfidence} callout(s) need manual review`);
    }
  }
  
  if (result.error) {
    console.error(`\nError: ${result.error}`);
  }

  console.log(`\n=== Detected Callouts ===`);
  if (result.hyperlinks.length === 0) {
    console.log("No callouts detected.");
  } else {
    // Group by callout ref for easier reading
    const grouped = result.hyperlinks.reduce((acc, link) => {
      if (!acc[link.calloutRef]) {
        acc[link.calloutRef] = [];
      }
      acc[link.calloutRef].push(link);
      return acc;
    }, {} as Record<string, typeof result.hyperlinks>);

    for (const [ref, links] of Object.entries(grouped)) {
      console.log(`\n${ref} (${links.length} instance${links.length > 1 ? 's' : ''}):`);
      links.forEach((link, idx) => {
        console.log(`  ${idx + 1}. Target: ${link.targetSheetRef}, Position: (${link.pixelX}, ${link.pixelY}) → Normalized: (${link.x.toFixed(4)}, ${link.y.toFixed(4)})`);
      });
    }
  }

  // Expected callouts for validation
  const expectedCallouts = [
    "1/A5", "1/A6", "1/A6", "1/A7",
    "2/A5", "2/A6", "2/A6", "2/A7",
    "3/A5", "3/A7"
  ];

  console.log(`\n=== Validation ===`);
  console.log(`Expected callouts: ${expectedCallouts.length} total instances`);
  console.log(`Detected callouts: ${result.hyperlinks.length} total instances`);
  
  const detectedRefs = result.hyperlinks.map(h => h.calloutRef);
  const expectedCounts = expectedCallouts.reduce((acc, ref) => {
    acc[ref] = (acc[ref] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const detectedCounts = detectedRefs.reduce((acc, ref) => {
    acc[ref] = (acc[ref] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  let allMatch = true;
  for (const [ref, expectedCount] of Object.entries(expectedCounts)) {
    const detectedCount = detectedCounts[ref] || 0;
    const match = expectedCount === detectedCount;
    console.log(`  ${ref}: Expected ${expectedCount}, Detected ${detectedCount} ${match ? '✓' : '✗'}`);
    if (!match) allMatch = false;
  }

  // Check for extra detections
  for (const [ref, detectedCount] of Object.entries(detectedCounts)) {
    if (!expectedCounts[ref]) {
      console.log(`  ${ref}: Unexpected detection (${detectedCount} instance${detectedCount > 1 ? 's' : ''}) ✗`);
      allMatch = false;
    }
  }

  console.log(`\nOverall: ${allMatch ? '✓ All callouts match expected' : '✗ Some callouts do not match'}`);

  // Output JSON to file
  const outputJsonPath = join(import.meta.dir, "..", "output", "results.json");
  await Bun.write(outputJsonPath, JSON.stringify(result, null, 2));
  console.log(`\nResults saved to: ${outputJsonPath}`);

  process.exit(allMatch ? 0 : 1);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

