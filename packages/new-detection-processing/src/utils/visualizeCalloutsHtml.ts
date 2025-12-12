import { writeFile } from "fs/promises";
import { join, dirname } from "path";
import type { DetectedCallout } from "../types/hyperlinks";

/**
 * Generate an HTML file that displays the image with red boxes overlaid
 * at callout positions. This is easier than drawing on the PNG directly.
 */
export async function generateCalloutVisualizationHtml(
  imagePath: string,
  callouts: DetectedCallout[],
  imageWidth: number,
  imageHeight: number,
  outputHtmlPath: string,
  boxSize: number = 50
): Promise<void> {
  // Calculate normalized positions for CSS
  const boxes = callouts.map(callout => {
    const x1 = Math.max(0, callout.x - boxSize);
    const y1 = Math.max(0, callout.y - boxSize);
    const x2 = Math.min(imageWidth, callout.x + boxSize);
    const y2 = Math.min(imageHeight, callout.y + boxSize);
    
    // Normalize to 0-1 for percentage-based positioning
    const left = (x1 / imageWidth) * 100;
    const top = (y1 / imageHeight) * 100;
    const width = ((x2 - x1) / imageWidth) * 100;
    const height = ((y2 - y1) / imageHeight) * 100;
    
    return {
      left,
      top,
      width,
      height,
      centerX: (callout.x / imageWidth) * 100,
      centerY: (callout.y / imageHeight) * 100,
      ref: callout.ref
    };
  });
  
  const html = `<!DOCTYPE html>
<html>
<head>
  <title>Callout Position Visualization</title>
  <style>
    body {
      margin: 0;
      padding: 20px;
      background: #f0f0f0;
      font-family: Arial, sans-serif;
    }
    .container {
      position: relative;
      display: inline-block;
      border: 2px solid #333;
      background: white;
    }
    .image {
      display: block;
      max-width: 100%;
      height: auto;
    }
    .box {
      position: absolute;
      border: 3px solid red;
      box-sizing: border-box;
      pointer-events: none;
    }
    .center-point {
      position: absolute;
      width: 6px;
      height: 6px;
      background: red;
      border-radius: 50%;
      transform: translate(-50%, -50%);
      pointer-events: none;
    }
    .label {
      position: absolute;
      background: red;
      color: white;
      padding: 2px 6px;
      font-size: 12px;
      font-weight: bold;
      transform: translate(-50%, -100%);
      margin-top: -5px;
      pointer-events: none;
      white-space: nowrap;
    }
    .info {
      margin-top: 20px;
      padding: 15px;
      background: white;
      border-radius: 5px;
    }
    .info h2 {
      margin-top: 0;
    }
    .callout-list {
      list-style: none;
      padding: 0;
    }
    .callout-list li {
      padding: 5px;
      border-bottom: 1px solid #eee;
    }
  </style>
</head>
<body>
  <h1>Callout Position Visualization</h1>
  <p>Red boxes show detected callout positions. Center point (red dot) is the exact detected coordinate.</p>
  
  <div class="container" style="width: ${imageWidth}px; height: ${imageHeight}px;">
    <img src="${imagePath}" alt="Plan" class="image" style="width: ${imageWidth}px; height: ${imageHeight}px;">
    ${boxes.map((box, i) => `
      <div class="box" style="left: ${box.left}%; top: ${box.top}%; width: ${box.width}%; height: ${box.height}%;"></div>
      <div class="center-point" style="left: ${box.centerX}%; top: ${box.centerY}%;"></div>
      <div class="label" style="left: ${box.centerX}%; top: ${box.centerY}%;">${box.ref}</div>
    `).join('')}
  </div>
  
  <div class="info">
    <h2>Detected Callouts (${callouts.length} total)</h2>
    <ul class="callout-list">
      ${callouts.map(c => `
        <li>
          <strong>${c.ref}</strong> → Sheet ${c.targetSheet} 
          (Position: ${c.x}, ${c.y}px)
          ${c.confidence ? `(Confidence: ${(c.confidence * 100).toFixed(1)}%)` : ''}
        </li>
      `).join('')}
    </ul>
  </div>
</body>
</html>`;
  
  // Ensure output directory exists
  const outputDir = dirname(outputHtmlPath);
  await writeFile(outputHtmlPath, html, 'utf-8');
}


