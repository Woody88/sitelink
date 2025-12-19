import { analyzeSheet, MODELS } from "../services/visionAnalysis";
import { detectCalloutsRegionBased } from "../services/regionBasedDetection";
import { convertPdfToImage } from "../services/pdfProcessor";
import { analyzeTitleBlock } from "../services/titleBlockAnalysis";
import sharp from "sharp";
import type { DetectedCallout, ImageInfo } from "../types/hyperlinks";

/**
 * Compare LLM-only vs Region-based detection methods
 * Creates a side-by-side visualization showing both approaches
 */
export async function compareDetectionMethods(
  pdfPath: string,
  outputDir: string = "./output",
  dpi: number = 300,
  totalSheetCount: number = 7,
  existingSheets: string[] = []
): Promise<{
  llmResult: { callouts: DetectedCallout[]; count: number };
  regionResult: { callouts: DetectedCallout[]; count: number };
  comparisonImage: string;
}> {
  console.log("🔍 Running comparison: LLM-only vs Region-based detection\n");
  
  // Convert PDF to image
  const imagePath = `${outputDir}/${Date.now()}-comparison-source.png`;
  const imageInfo: ImageInfo = await convertPdfToImage(pdfPath, imagePath, dpi);
  
  // Get title block for sheet registry
  const titleBlockInfo = await analyzeTitleBlock(imageInfo);
  const sheetRegistry = existingSheets.length > 0 
    ? existingSheets 
    : (titleBlockInfo.sheetNumber && totalSheetCount
        ? Array.from({ length: totalSheetCount }, (_, i) => {
            const prefix = titleBlockInfo.sheetNumber!.match(/^[A-Z]+/)?.[0] || "A";
            return `${prefix}${i + 1}`;
          })
        : []);
  
  console.log(`Sheet Registry: ${sheetRegistry.join(", ")}\n`);
  
  // Method 1: LLM-only detection
  console.log("📊 Method 1: LLM-only detection...");
  const llmResult = await analyzeSheet(
    pdfPath,
    sheetRegistry,
    outputDir,
    dpi,
    totalSheetCount,
    true, // enableRetry
    MODELS.FLASH
  );
  
  const llmCallouts: DetectedCallout[] = llmResult.hyperlinks.map(h => ({
    ref: h.calloutRef,
    targetSheet: h.targetSheetRef,
    type: 'unknown',
    x: h.pixelX,
    y: h.pixelY,
    confidence: h.confidence
  }));
  
  console.log(`   Found ${llmCallouts.length} callouts\n`);
  
  // Method 2: Region-based detection
  console.log("📊 Method 2: Region-based detection...");
  const regionResult = await detectCalloutsRegionBased(
    pdfPath,
    sheetRegistry,
    outputDir,
    dpi,
    totalSheetCount,
    MODELS.FLASH
  );
  
  const regionCallouts: DetectedCallout[] = regionResult.hyperlinks.map(h => ({
    ref: h.calloutRef,
    targetSheet: h.targetSheetRef,
    type: 'unknown',
    x: h.pixelX,
    y: h.pixelY,
    confidence: h.confidence
  }));
  
  console.log(`   Found ${regionCallouts.length} callouts\n`);
  
  // Create comparison visualization
  console.log("🎨 Creating comparison visualization...");
  const comparisonImage = await createComparisonVisualization(
    imageInfo.path,
    llmCallouts,
    regionCallouts,
    outputDir
  );
  
  console.log(`✅ Comparison saved to: ${comparisonImage}\n`);
  
  // Print summary
  console.log("=== Comparison Summary ===");
  console.log(`LLM-only:      ${llmCallouts.length} callouts`);
  console.log(`Region-based:  ${regionCallouts.length} callouts`);
  console.log(`\nLLM-only callouts:`);
  llmCallouts.forEach(c => {
    console.log(`  - ${c.ref} at (${c.x}, ${c.y})px, conf: ${((c.confidence || 0) * 100).toFixed(0)}%`);
  });
  console.log(`\nRegion-based callouts:`);
  regionCallouts.forEach(c => {
    console.log(`  - ${c.ref} at (${c.x}, ${c.y})px, conf: ${((c.confidence || 0) * 100).toFixed(0)}%`);
  });
  
  return {
    llmResult: { callouts: llmCallouts, count: llmCallouts.length },
    regionResult: { callouts: regionCallouts, count: regionCallouts.length },
    comparisonImage
  };
}

/**
 * Create side-by-side comparison visualization
 */
async function createComparisonVisualization(
  sourceImagePath: string,
  llmCallouts: DetectedCallout[],
  regionCallouts: DetectedCallout[],
  outputDir: string
): Promise<string> {
  const image = sharp(sourceImagePath);
  const metadata = await image.metadata();
  const width = metadata.width || 0;
  const height = metadata.height || 0;
  
  // Create SVG overlays for both methods
  const boxSize = 50;
  
  // LLM-only: Red boxes
  const llmBoxes = llmCallouts.map(c => {
    const x1 = Math.max(0, c.x - boxSize);
    const y1 = Math.max(0, c.y - boxSize);
    const x2 = Math.min(width, c.x + boxSize);
    const y2 = Math.min(height, c.y + boxSize);
    const w = x2 - x1;
    const h = y2 - y1;
    
    return `
      <rect x="${x1}" y="${y1}" width="${w}" height="${h}" 
            fill="none" stroke="red" stroke-width="3" opacity="0.8"/>
      <circle cx="${c.x}" cy="${c.y}" r="6" fill="red" opacity="0.9"/>
      <text x="${c.x}" y="${Math.max(20, y1 - 8)}" font-size="14" fill="red" 
            text-anchor="middle" font-weight="bold" stroke="white" stroke-width="0.5">${c.ref}</text>
      <text x="${c.x}" y="${y1 + 20}" font-size="10" fill="red" 
            text-anchor="middle" font-weight="normal" stroke="white" stroke-width="0.3">LLM</text>
    `;
  }).join('');
  
  // Region-based: Green boxes
  const regionBoxes = regionCallouts.map(c => {
    const x1 = Math.max(0, c.x - boxSize);
    const y1 = Math.max(0, c.y - boxSize);
    const x2 = Math.min(width, c.x + boxSize);
    const y2 = Math.min(height, c.y + boxSize);
    const w = x2 - x1;
    const h = y2 - y1;
    
    return `
      <rect x="${x1}" y="${y1}" width="${w}" height="${h}" 
            fill="none" stroke="green" stroke-width="3" opacity="0.8"/>
      <circle cx="${c.x}" cy="${c.y}" r="6" fill="green" opacity="0.9"/>
      <text x="${c.x}" y="${Math.max(20, y1 - 8)}" font-size="14" fill="green" 
            text-anchor="middle" font-weight="bold" stroke="white" stroke-width="0.5">${c.ref}</text>
      <text x="${c.x}" y="${y1 + 20}" font-size="10" fill="green" 
            text-anchor="middle" font-weight="normal" stroke="white" stroke-width="0.3">OCR</text>
    `;
  }).join('');
  
  // Find matching callouts (same ref, similar position)
  const matchingBoxes = llmCallouts.map(llm => {
    const match = regionCallouts.find(r => 
      r.ref === llm.ref && 
      Math.abs(r.x - llm.x) < 100 && 
      Math.abs(r.y - llm.y) < 100
    );
    
    if (match) {
      // Draw line connecting LLM and OCR positions
      return `
        <line x1="${llm.x}" y1="${llm.y}" x2="${match.x}" y2="${match.y}" 
              stroke="blue" stroke-width="2" opacity="0.5" stroke-dasharray="5,5"/>
      `;
    }
    return '';
  }).join('');
  
  // Create legend
  const legend = `
    <g transform="translate(20, 20)">
      <rect x="0" y="0" width="200" height="100" fill="white" fill-opacity="0.8" stroke="black" stroke-width="1"/>
      <text x="10" y="20" font-size="14" font-weight="bold">Method Comparison</text>
      <rect x="10" y="30" width="15" height="15" fill="none" stroke="red" stroke-width="2"/>
      <text x="30" y="42" font-size="12">LLM-only (${llmCallouts.length})</text>
      <rect x="10" y="50" width="15" height="15" fill="none" stroke="green" stroke-width="2"/>
      <text x="30" y="62" font-size="12">Region-based (${regionCallouts.length})</text>
      <line x1="10" y1="70" x2="25" y2="70" stroke="blue" stroke-width="2" stroke-dasharray="5,5"/>
      <text x="30" y="72" font-size="12">Matching positions</text>
    </g>
  `;
  
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      ${matchingBoxes}
      ${llmBoxes}
      ${regionBoxes}
      ${legend}
    </svg>
  `;
  
  const outputPath = `${outputDir}/${Date.now()}-method-comparison.png`;
  
  await image
    .composite([
      {
        input: Buffer.from(svg),
        top: 0,
        left: 0
      }
    ])
    .png()
    .toFile(outputPath);
  
  return outputPath;
}

