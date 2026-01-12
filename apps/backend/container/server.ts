import { $ } from "bun";
import { join } from "path";
import { mkdir, rm, readdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { pack } from "tar-stream";
import { Readable, Writable } from "node:stream";

const PORT = parseInt(process.env.PORT || "3001");

interface ProcessingResult {
  success: boolean;
  error?: string;
  data?: unknown;
}

interface ImageGenerationResult {
  success: boolean;
  pages: number;
  outputDir: string;
  images: string[];
}

interface MetadataResult {
  sheetNumber: string | null;
  sheetTitle: string | null;
  scale: string | null;
  rawText: string;
}

interface CalloutDetectionResult {
  shapes: DetectedShape[];
  imageWidth: number;
  imageHeight: number;
  totalDetections: number;
}

interface DetectedShape {
  type: string;
  method: string;
  centerX: number;
  centerY: number;
  bbox: { x1: number; y1: number; x2: number; y2: number };
  confidence: number;
}

async function ensureDir(dir: string): Promise<void> {
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
}

async function cleanupDir(dir: string): Promise<void> {
  if (existsSync(dir)) {
    await rm(dir, { recursive: true, force: true });
  }
}

async function generateImages(
  pdfPath: string,
  outputDir: string,
  dpi: number = 300
): Promise<ImageGenerationResult> {
  await ensureDir(outputDir);

  const pageCountResult =
    await $`vips pdfload ${pdfPath} x --dpi=72 2>&1 | grep -oP 'n-pages: \\K\\d+' || pdftk ${pdfPath} dump_data | grep NumberOfPages | awk '{print $2}'`.quiet();
  let pageCount = 1;
  try {
    const countStr = pageCountResult.stdout.toString().trim();
    if (countStr) {
      pageCount = parseInt(countStr) || 1;
    }
  } catch {
    const pdfInfoResult =
      await $`pdfinfo ${pdfPath} 2>/dev/null | grep Pages | awk '{print $2}'`.quiet();
    pageCount = parseInt(pdfInfoResult.stdout.toString().trim()) || 1;
  }

  const images: string[] = [];

  for (let page = 0; page < pageCount; page++) {
    const outputPath = join(outputDir, `page-${page + 1}.png`);
    await $`vips pdfload ${pdfPath} ${outputPath} --dpi=${dpi} --page=${page}`.quiet();
    images.push(outputPath);
  }

  return {
    success: true,
    pages: pageCount,
    outputDir,
    images,
  };
}

async function extractMetadata(imagePath: string): Promise<MetadataResult> {
  const pythonScript = `
import sys
import json
import pytesseract
from PIL import Image
import re

image_path = sys.argv[1]

img = Image.open(image_path)
width, height = img.size

title_block_region = img.crop((
    int(width * 0.7),
    int(height * 0.85),
    width,
    height
))

raw_text = pytesseract.image_to_string(title_block_region)

sheet_number = None
sheet_title = None
scale = None

sheet_patterns = [
    r'(?:SHEET|SHT|DWG)\\s*[:#]?\\s*([A-Z]?\\d+(?:\\.\\d+)?)',
    r'\\b([A-Z]\\d+\\.\\d+)\\b',
    r'\\b([A-Z]-\\d+)\\b'
]

for pattern in sheet_patterns:
    match = re.search(pattern, raw_text, re.IGNORECASE)
    if match:
        sheet_number = match.group(1)
        break

title_patterns = [
    r'(?:TITLE|PROJECT)\\s*[:#]?\\s*(.+?)(?:\\n|$)',
    r'^([A-Z][A-Z\\s]+)$'
]

for pattern in title_patterns:
    match = re.search(pattern, raw_text, re.MULTILINE | re.IGNORECASE)
    if match:
        sheet_title = match.group(1).strip()
        break

scale_patterns = [
    r'SCALE\\s*[:#]?\\s*(\\d+["\\'\\s]*=\\s*\\d+["\\'\\-\\d\\s]+)',
    r'(\\d+/\\d+"\\s*=\\s*\\d+["\\'\\-\\d]+)',
    r'(1:\\d+)'
]

for pattern in scale_patterns:
    match = re.search(pattern, raw_text, re.IGNORECASE)
    if match:
        scale = match.group(1).strip()
        break

result = {
    "sheetNumber": sheet_number,
    "sheetTitle": sheet_title,
    "scale": scale,
    "rawText": raw_text[:500]
}

print(json.dumps(result))
`;

  const tempScript = `/tmp/extract_metadata_${Date.now()}.py`;
  await Bun.write(tempScript, pythonScript);

  try {
    const result =
      await $`python3 ${tempScript} ${imagePath}`.quiet();
    return JSON.parse(result.stdout.toString());
  } finally {
    await rm(tempScript, { force: true });
  }
}

async function detectCallouts(
  imagePath: string,
  dpi: number = 300,
  outputDir: string = "/tmp/debug"
): Promise<CalloutDetectionResult> {
  await ensureDir(outputDir);

  const pythonScript = `
import sys
import json
import cv2
import numpy as np

image_path = sys.argv[1]
dpi = int(sys.argv[2])
output_dir = sys.argv[3]

img = cv2.imread(image_path)
if img is None:
    print(json.dumps({"error": "Failed to load image", "shapes": []}))
    sys.exit(1)

h, w = img.shape[:2]
gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
scale = dpi / 300.0

thresh = cv2.adaptiveThreshold(
    gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 25, 7
)

kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
cleaned = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)
cleaned = cv2.morphologyEx(cleaned, cv2.MORPH_OPEN, kernel)

found = []

blurred = cv2.GaussianBlur(gray, (9, 9), 2)
min_radius = int(12 * scale)
max_radius = int(50 * scale)
min_dist = int(40 * scale)

circles = cv2.HoughCircles(
    blurred, cv2.HOUGH_GRADIENT, 1, min_dist,
    param1=50, param2=30,
    minRadius=min_radius, maxRadius=max_radius
)

if circles is not None:
    for cx, cy, r in circles[0, :]:
        found.append({
            "type": "circle",
            "method": "hough",
            "centerX": int(cx),
            "centerY": int(cy),
            "bbox": {
                "x1": int(cx - r),
                "y1": int(cy - r),
                "x2": int(cx + r),
                "y2": int(cy + r)
            },
            "confidence": 0.85
        })

contours, _ = cv2.findContours(cleaned, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
min_area = int(600 * scale ** 2)
max_area = int(8500 * scale ** 2)

for cnt in contours:
    area = cv2.contourArea(cnt)
    if not (min_area < area < max_area):
        continue

    x, y, bw, bh = cv2.boundingRect(cnt)
    perimeter = cv2.arcLength(cnt, True)
    approx = cv2.approxPolyDP(cnt, 0.02 * perimeter, True)
    circularity = (4 * np.pi * area / (perimeter ** 2)) if perimeter > 0 else 0

    shape_type = None

    if circularity > 0.65:
        shape_type = "circle"
    elif len(approx) == 3:
        shape_type = "triangle"
    elif circularity < 0.6 and len(approx) > 4:
        aspect_ratio = bw / bh if bh > 0 else 0
        if 0.6 < aspect_ratio < 1.6:
            shape_type = "section_flag"

    if shape_type:
        found.append({
            "type": shape_type,
            "method": "contour",
            "centerX": x + bw // 2,
            "centerY": y + bh // 2,
            "bbox": {"x1": x, "y1": y, "x2": x + bw, "y2": y + bh},
            "confidence": 0.75
        })

debug_img = img.copy()
for shape in found:
    color = (255, 0, 0) if shape["type"] == "circle" else (0, 255, 255)
    bbox = shape["bbox"]
    cv2.rectangle(debug_img, (bbox["x1"], bbox["y1"]), (bbox["x2"], bbox["y2"]), color, 2)

cv2.imwrite(f"{output_dir}/detection_debug.png", debug_img)

result = {
    "shapes": found,
    "imageWidth": w,
    "imageHeight": h,
    "totalDetections": len(found)
}

print(json.dumps(result))
`;

  const tempScript = `/tmp/detect_callouts_${Date.now()}.py`;
  await Bun.write(tempScript, pythonScript);

  try {
    const result =
      await $`python3 ${tempScript} ${imagePath} ${dpi} ${outputDir}`.quiet();
    return JSON.parse(result.stdout.toString());
  } finally {
    await rm(tempScript, { force: true });
  }
}

async function generateTiles(
  imagePath: string,
  outputDir: string,
  tileSize: number = 254
): Promise<ReadableStream<Uint8Array>> {
  await ensureDir(outputDir);

  const baseName = "tiles";
  const dziPath = join(outputDir, baseName);

  await $`vips dzsave ${imagePath} ${dziPath} --tile-size ${tileSize} --overlap 1 --depth onetile --suffix .jpg[Q=85]`.quiet();

  const tarPack = pack();

  const collectBuffers: Uint8Array[] = [];
  const writable = new Writable({
    write(chunk, _encoding, callback) {
      collectBuffers.push(chunk);
      callback();
    },
  });

  tarPack.pipe(writable);

  async function addDirToTar(dirPath: string, tarBasePath: string) {
    const entries = await readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name);
      const tarPath = join(tarBasePath, entry.name);

      if (entry.isDirectory()) {
        await addDirToTar(fullPath, tarPath);
      } else {
        const fileContent = await Bun.file(fullPath).arrayBuffer();
        const stats = await stat(fullPath);

        tarPack.entry(
          {
            name: tarPath,
            size: stats.size,
          },
          Buffer.from(fileContent)
        );
      }
    }
  }

  const dziFile = `${dziPath}.dzi`;
  if (existsSync(dziFile)) {
    const dziContent = await Bun.file(dziFile).arrayBuffer();
    const dziStats = await stat(dziFile);
    tarPack.entry(
      {
        name: `${baseName}.dzi`,
        size: dziStats.size,
      },
      Buffer.from(dziContent)
    );
  }

  const tilesDir = `${dziPath}_files`;
  if (existsSync(tilesDir)) {
    await addDirToTar(tilesDir, `${baseName}_files`);
  }

  tarPack.finalize();

  await new Promise((resolve) => writable.on("finish", resolve));

  const combinedBuffer = Buffer.concat(collectBuffers);

  return new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(combinedBuffer));
      controller.close();
    },
  });
}

console.log(`Starting PDF processor container on port ${PORT}...`);

const server = Bun.serve({
  port: PORT,
  routes: {
    "/health": () => {
      return Response.json({
        status: "healthy",
        timestamp: new Date().toISOString(),
        version: "1.0.0",
      });
    },

    "/generate-images": {
      POST: async (req) => {
        const jobId = `job-${Date.now()}`;
        const workDir = `/tmp/processing/${jobId}`;

        try {
          const dpi = parseInt(req.headers.get("X-DPI") || "300");
          const pdfPath = join(workDir, "input.pdf");

          await ensureDir(workDir);

          if (!req.body) {
            throw new Error("Request body is empty");
          }

          const pdfData = await req.arrayBuffer();
          await Bun.write(pdfPath, pdfData);

          const outputDir = join(workDir, "images");
          const result = await generateImages(pdfPath, outputDir, dpi);

          const imageBuffers: { page: number; data: string }[] = [];
          for (let i = 0; i < result.images.length; i++) {
            const imgData = await Bun.file(result.images[i]).arrayBuffer();
            imageBuffers.push({
              page: i + 1,
              data: Buffer.from(imgData).toString("base64"),
            });
          }

          return Response.json({
            success: true,
            pages: result.pages,
            images: imageBuffers,
          });
        } catch (error) {
          console.error("Error in /generate-images:", error);
          return Response.json(
            {
              success: false,
              error: error instanceof Error ? error.message : String(error),
            },
            { status: 500 }
          );
        } finally {
          await cleanupDir(workDir);
        }
      },
    },

    "/extract-metadata": {
      POST: async (req) => {
        const jobId = `job-${Date.now()}`;
        const workDir = `/tmp/processing/${jobId}`;

        try {
          await ensureDir(workDir);

          if (!req.body) {
            throw new Error("Request body is empty");
          }

          const imageData = await req.arrayBuffer();
          const imagePath = join(workDir, "input.png");
          await Bun.write(imagePath, imageData);

          const metadata = await extractMetadata(imagePath);

          return Response.json({
            success: true,
            metadata,
          });
        } catch (error) {
          console.error("Error in /extract-metadata:", error);
          return Response.json(
            {
              success: false,
              error: error instanceof Error ? error.message : String(error),
            },
            { status: 500 }
          );
        } finally {
          await cleanupDir(workDir);
        }
      },
    },

    "/detect-callouts": {
      POST: async (req) => {
        const jobId = `job-${Date.now()}`;
        const workDir = `/tmp/processing/${jobId}`;
        const debugDir = join(workDir, "debug");

        try {
          const dpi = parseInt(req.headers.get("X-DPI") || "300");

          await ensureDir(workDir);
          await ensureDir(debugDir);

          if (!req.body) {
            throw new Error("Request body is empty");
          }

          const imageData = await req.arrayBuffer();
          const imagePath = join(workDir, "input.png");
          await Bun.write(imagePath, imageData);

          const result = await detectCallouts(imagePath, dpi, debugDir);

          let debugImage: string | null = null;
          const debugPath = join(debugDir, "detection_debug.png");
          if (existsSync(debugPath)) {
            const debugData = await Bun.file(debugPath).arrayBuffer();
            debugImage = Buffer.from(debugData).toString("base64");
          }

          return Response.json({
            success: true,
            ...result,
            debugImage,
          });
        } catch (error) {
          console.error("Error in /detect-callouts:", error);
          return Response.json(
            {
              success: false,
              error: error instanceof Error ? error.message : String(error),
            },
            { status: 500 }
          );
        } finally {
          await cleanupDir(workDir);
        }
      },
    },

    "/generate-tiles": {
      POST: async (req) => {
        const jobId = `job-${Date.now()}`;
        const workDir = `/tmp/tiles/${jobId}`;

        try {
          const tileSize = parseInt(req.headers.get("X-Tile-Size") || "254");
          const sheetId = req.headers.get("X-Sheet-Id") || "sheet";

          await ensureDir(workDir);

          if (!req.body) {
            throw new Error("Request body is empty");
          }

          const imageData = await req.arrayBuffer();
          const imagePath = join(workDir, "input.png");
          await Bun.write(imagePath, imageData);

          const outputDir = join(workDir, "output");
          const tarStream = await generateTiles(imagePath, outputDir, tileSize);

          return new Response(tarStream, {
            headers: {
              "Content-Type": "application/x-tar",
              "Content-Disposition": `attachment; filename="${sheetId}-tiles.tar"`,
            },
          });
        } catch (error) {
          console.error("Error in /generate-tiles:", error);
          await cleanupDir(workDir);
          return Response.json(
            {
              success: false,
              error: error instanceof Error ? error.message : String(error),
            },
            { status: 500 }
          );
        }
      },
    },
  },
});

console.log(`PDF processor container running at ${server.url}`);
console.log(`Endpoints available:`);
console.log(`  GET  /health           - Health check`);
console.log(`  POST /generate-images  - PDF -> PNG at specified DPI`);
console.log(`  POST /extract-metadata - OCR title block extraction`);
console.log(`  POST /detect-callouts  - OpenCV shape detection`);
console.log(`  POST /generate-tiles   - PNG -> Deep Zoom tiles (tar)`);
