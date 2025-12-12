import sharp from 'sharp';
import { existsSync } from "fs";
import type { DetectedCallout } from "../types/hyperlinks";

/**
 * Draw red boxes around detected callouts on an image using Sharp
 * 
 * @param imagePath Input image path
 * @param callouts Array of detected callouts with positions
 * @param outputPath Output image path with boxes drawn
 * @param boxSize Size of the box around each callout (default: 50px radius)
 */
export async function drawCalloutBoxes(
  imagePath: string,
  callouts: DetectedCallout[],
  outputPath: string,
  boxSize: number = 50
): Promise<void> {
  if (!existsSync(imagePath)) {
    throw new Error(`Image not found: ${imagePath}`);
  }

  if (callouts.length === 0) {
    // Just copy the image if no callouts
    await sharp(imagePath).toFile(outputPath);
    return;
  }

  // Get image metadata
  const metadata = await sharp(imagePath).metadata();
  const imgWidth = metadata.width || 0;
  const imgHeight = metadata.height || 0;

  console.log(`\n📐 Image dimensions: ${imgWidth} x ${imgHeight}px`);
  console.log(`📦 Drawing ${callouts.length} callout boxes (${boxSize}px radius):`);
  callouts.forEach(c => {
    const x1 = Math.max(0, c.x - boxSize);
    const y1 = Math.max(0, c.y - boxSize);
    const x2 = Math.min(imgWidth, c.x + boxSize);
    const y2 = Math.min(imgHeight, c.y + boxSize);
    const conf = c.confidence !== undefined ? `${(c.confidence * 100).toFixed(0)}%` : 'N/A';
    const confColor = c.confidence !== undefined && c.confidence < 0.5 ? 'yellow' : 'red';
    console.log(`   ${c.ref}: center (${c.x}, ${c.y})px → box (${x1}, ${y1}) to (${x2}, ${y2}) [Confidence: ${conf}]`);
  });

  // Create SVG overlay with colored boxes based on confidence
  // Red = high confidence, Yellow = low confidence
  const borderWidth = 4;
  const boxes = callouts.map(callout => {
    const x1 = Math.max(0, callout.x - boxSize);
    const y1 = Math.max(0, callout.y - boxSize);
    const x2 = Math.min(imgWidth, callout.x + boxSize);
    const y2 = Math.min(imgHeight, callout.y + boxSize);
    const width = x2 - x1;
    const height = y2 - y1;
    
    // Color based on confidence: red (high), yellow (low)
    const confidence = callout.confidence || 0;
    const color = confidence >= 0.5 ? 'red' : 'yellow';
    const confText = confidence !== undefined ? `${(confidence * 100).toFixed(0)}%` : '';
    
    return `
      <rect x="${x1}" y="${y1}" width="${width}" height="${height}" 
            fill="none" stroke="${color}" stroke-width="${borderWidth}" opacity="0.8"/>
      <circle cx="${callout.x}" cy="${callout.y}" r="6" fill="${color}" opacity="0.9"/>
      <text x="${callout.x}" y="${Math.max(20, y1 - 8)}" font-size="16" fill="${color}" 
            text-anchor="middle" font-weight="bold" stroke="white" stroke-width="0.5">${callout.ref}</text>
      ${confText ? `<text x="${callout.x}" y="${y1 + 25}" font-size="12" fill="${color}" 
            text-anchor="middle" font-weight="normal" stroke="white" stroke-width="0.3">${confText}</text>` : ''}
    `;
  }).join('');

  const svgOverlay = Buffer.from(`
    <svg width="${imgWidth}" height="${imgHeight}" xmlns="http://www.w3.org/2000/svg">
      ${boxes}
    </svg>
  `);

  // Composite SVG overlay onto the image
  await sharp(imagePath)
    .composite([{ input: svgOverlay, top: 0, left: 0 }])
    .toFile(outputPath);
}
