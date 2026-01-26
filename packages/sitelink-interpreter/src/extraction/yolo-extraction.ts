import { $ } from "bun";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, basename } from "path";
import { sheets, entities, detectionRuns, type Sheet, type Entity } from "../db/index.ts";

const PYTHON_API = join(import.meta.dir, "../../../callout-processor-v5/src/api_detect.py");
// v6 iteration 5 model: YOLOv8n, 96.6% mAP50, 88.8% mAP50-95
// Trained with SAHI tiling, 72 DPI, 2048px tiles
const YOLO_MODEL = join(import.meta.dir, "../../../callout-processor-v6-experimental/weights/best.pt");
const OUTPUT_DIR = join(import.meta.dir, "../../output/yolo-extractions");

interface YOLODetection {
  id: string;
  sheet_index: number;
  class_name: string;
  bbox: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  };
  confidence: number;
  ocr_text: string | null;
  ocr_confidence: number;
  identifier: string | null;
  view_sheet: string | null;
  standard: string;
  needs_review: boolean;
  crop_path: string | null;
}

interface PipelineSummary {
  pdf_path: string;
  model: string;
  dpi: number;
  standard: string;
  total_sheets: number;
  total_detections: number;
  needs_review: number;
  by_class: Record<string, number>;
  sheets: Array<{
    sheet_index: number;
    width: number;
    height: number;
    total_detections: number;
    by_class: Record<string, number>;
    needs_review: number;
  }>;
}

export interface YOLOExtractionOptions {
  dpi?: number;          // Default: 72 (CRITICAL - DO NOT CHANGE without retraining)
  tileSize?: number;     // Default: 2048 (CRITICAL - DO NOT CHANGE without retraining)
  overlap?: number;      // Default: 0.2 (CRITICAL - DO NOT CHANGE without retraining)
  confThreshold?: number; // Default: 0.25
  standard?: 'auto' | 'pspc' | 'ncs';
  validate?: boolean;
  useGemini?: boolean;   // Use Gemini Flash 2 for text extraction (requires OPENROUTER_API_KEY)
}

function mapClassToLabel(className: string): string {
  const mapping: Record<string, string> = {
    detail: "detail_callout",
    elevation: "elevation_callout",
    title: "title_callout",
  };
  return mapping[className] ?? className;
}

export async function runYOLOPipeline(
  pdfPath: string,
  options: YOLOExtractionOptions = {}
): Promise<PipelineSummary | null> {
  const {
    dpi = 72,        // v5 optimal DPI
    tileSize = 2048, // v5 SAHI tile size
    overlap = 0.2,   // v5 SAHI overlap
    confThreshold = 0.25, // v5 optimal confidence
    standard = 'auto',
    validate = false,
    useGemini = false,
  } = options;

  if (!existsSync(PYTHON_API)) {
    console.error(`YOLO API script not found at ${PYTHON_API}`);
    return null;
  }

  if (!existsSync(YOLO_MODEL)) {
    console.error(`YOLO model not found at ${YOLO_MODEL}`);
    return null;
  }

  const pdfName = basename(pdfPath, '.pdf');
  const outputDir = join(OUTPUT_DIR, pdfName);

  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  console.log(`Running YOLO v6 Iteration 5 detection on ${pdfPath}...`);
  console.log(`  DPI: ${dpi}, Tile Size: ${tileSize}, Overlap: ${overlap}, Conf: ${confThreshold}`);

  try {
    // Get page count using pdfinfo (same as ingestion)
    const pageCountStr = await $`pdfinfo ${pdfPath} | grep "Pages:" | awk '{print $2}'`.text();
    const numPages = parseInt(pageCountStr.trim(), 10);
    const sheets: PipelineSummary['sheets'] = [];
    let totalDetections = 0;
    let needsReview = 0;
    const byClass: Record<string, number> = {};

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const pageOutputDir = join(outputDir, `sheet-${pageNum - 1}`);

      const args = [
        'python', PYTHON_API,
        '--pdf', pdfPath,
        '--page', String(pageNum),
        '--output', pageOutputDir,
        '--conf', String(confThreshold),
      ];

      if (!validate) {
        args.push('--no-filters');
      }

      if (useGemini) {
        const apiKey = process.env.OPENROUTER_API_KEY;
        if (!apiKey) {
          console.error('OPENROUTER_API_KEY environment variable required for Gemini extraction');
          return null;
        }
        args.push('--gemini', '--openrouter-key', apiKey);
      }

      await $`${args}`.quiet();

      // Read detections for this page
      const detectionsPath = join(pageOutputDir, 'detections.json');
      if (existsSync(detectionsPath)) {
        const pageDetections = JSON.parse(readFileSync(detectionsPath, 'utf-8')) as {
          detections: Array<{
            bbox: number[];
            class: string;
            confidence: number;
          }>;
        };

        const pageCount = pageDetections.detections.length;
        totalDetections += pageCount;

        const pageByClass: Record<string, number> = {};
        for (const det of pageDetections.detections) {
          pageByClass[det.class] = (pageByClass[det.class] ?? 0) + 1;
          byClass[det.class] = (byClass[det.class] ?? 0) + 1;

          if (det.confidence < 0.7) {
            needsReview++;
          }
        }

        // Get image dimensions (approximate from bbox if needed)
        const maxX = Math.max(...pageDetections.detections.map(d => (d.bbox[0] ?? 0) + (d.bbox[2] ?? 0)), 0);
        const maxY = Math.max(...pageDetections.detections.map(d => (d.bbox[1] ?? 0) + (d.bbox[3] ?? 0)), 0);

        sheets.push({
          sheet_index: pageNum - 1,
          width: Math.ceil(maxX) || 2592,  // Fallback to typical 72 DPI 36" width
          height: Math.ceil(maxY) || 3456, // Fallback to typical 72 DPI 48" height
          total_detections: pageCount,
          by_class: pageByClass,
          needs_review: pageDetections.detections.filter(d => d.confidence < 0.7).length,
        });
      }
    }

    const summary: PipelineSummary = {
      pdf_path: pdfPath,
      model: 'v6_iteration5',
      dpi,
      standard,
      total_sheets: numPages,
      total_detections: totalDetections,
      needs_review: needsReview,
      by_class: byClass,
      sheets,
    };

    // Save summary
    const summaryPath = join(outputDir, 'summary.json');
    writeFileSync(summaryPath, JSON.stringify(summary, null, 2));

    console.log(`v6 iteration 5 detection complete: ${summary.total_detections} detections across ${summary.total_sheets} sheets`);
    return summary;
  } catch (error) {
    console.error(`YOLO pipeline failed: ${error}`);
    return null;
  }
}

export async function extractWithYOLO(
  pdfPath: string,
  options: YOLOExtractionOptions = {}
): Promise<{
  entities: Entity[];
  runId: string;
  summary: PipelineSummary | null;
}> {
  const {
    confThreshold = 0.25,
    standard = 'auto',
    validate = false,
  } = options;

  const result = {
    entities: [] as Entity[],
    runId: '',
    summary: null as PipelineSummary | null,
  };

  const pdfName = basename(pdfPath, '.pdf');
  const outputDir = join(OUTPUT_DIR, pdfName);

  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const allSheets = sheets.getByPdf(pdfPath);

  console.log(`Running YOLO v6 Iteration 5 detection on ${allSheets.length} sheets...`);

  // Run detection on each sheet using pre-rendered images
  for (let i = 0; i < allSheets.length; i++) {
    const sheet = allSheets[i];
    if (!sheet || !sheet.image_path) {
      console.warn(`Sheet ${i + 1} has no image path`);
      continue;
    }

    const sheetOutputDir = join(outputDir, `sheet-${i}`);
    mkdirSync(sheetOutputDir, { recursive: true });

    console.log(`  Detecting on sheet ${i + 1}/${allSheets.length}...`);

    // Downsample to 72 DPI for detection (model was trained on 72 DPI)
    // Images from ingestion are at 150 DPI, need to scale to 72 DPI
    const DISPLAY_DPI = 150;
    const DETECTION_DPI = 72;
    const scaleFactor = DETECTION_DPI / DISPLAY_DPI;
    const targetWidth = Math.round((sheet.width ?? 7200) * scaleFactor);
    const targetHeight = Math.round((sheet.height ?? 5400) * scaleFactor);

    const downsampledPath = join(sheetOutputDir, 'downsampled-72dpi.png');
    await $`python -c "from PIL import Image; img = Image.open('${sheet.image_path}'); downsampled = img.resize((${targetWidth}, ${targetHeight}), Image.Resampling.LANCZOS); downsampled.save('${downsampledPath}')"`.quiet();

    // Use downsampled image for detection
    const args = [
      'python', PYTHON_API,
      '--image', downsampledPath,
      '--output', sheetOutputDir,
      '--conf', String(confThreshold),
    ];

    if (!validate) {
      args.push('--no-filters');
    }

    await $`${args}`.quiet();
  }

  // Build summary from detection results
  let totalDetections = 0;
  let needsReview = 0;
  const byClass: Record<string, number> = {};

  // Read all detection results and insert entities
  for (let i = 0; i < allSheets.length; i++) {
    const sheet = allSheets[i];
    if (!sheet) continue;

    const sheetDir = join(outputDir, `sheet-${i}`);
    const detectionsPath = join(sheetDir, 'detections.json');

    if (!existsSync(detectionsPath)) {
      console.warn(`No detections.json for sheet ${i + 1}`);
      continue;
    }

    // v6 format with OCR: {detections: [{bbox, class, confidence, ocr_text, identifier, target_sheet}]}
    const detectionsFile = JSON.parse(readFileSync(detectionsPath, 'utf-8')) as {
      detections: Array<{
        bbox: number[];
        class: string;
        confidence: number;
        ocr_text: string | null;
        ocr_confidence: number;
        identifier: string | null;
        target_sheet: string | null;
      }>;
    };

    totalDetections += detectionsFile.detections.length;

    // Scale factor: detection was on 72 DPI, display is at 150 DPI
    // Simply multiply by the DPI ratio to convert coordinates
    const DISPLAY_DPI = 150;
    const DETECTION_DPI = 72;
    const scaleFactor = DISPLAY_DPI / DETECTION_DPI;

    for (const det of detectionsFile.detections) {
      const classLabel = mapClassToLabel(det.class);
      byClass[det.class] = (byClass[det.class] ?? 0) + 1;

      if (det.confidence < 0.7) {
        needsReview++;
      }

      // Convert [x, y, w, h] to [x1, y1, x2, y2] and scale up to display resolution
      const x1 = ((det.bbox[0] ?? 0) * scaleFactor);
      const y1 = ((det.bbox[1] ?? 0) * scaleFactor);
      const x2 = (((det.bbox[0] ?? 0) + (det.bbox[2] ?? 0)) * scaleFactor);
      const y2 = (((det.bbox[1] ?? 0) + (det.bbox[3] ?? 0)) * scaleFactor);

      const entity = entities.insert({
        sheet_id: sheet.id,
        class_label: classLabel,
        ocr_text: det.ocr_text,
        confidence: det.confidence,
        bbox_x1: x1 as number,
        bbox_y1: y1 as number,
        bbox_x2: x2 as number,
        bbox_y2: y2 as number,
        identifier: det.identifier,
        target_sheet: det.target_sheet,
        triangle_count: null,
        triangle_positions: null,
        yolo_confidence: det.confidence,
        ocr_confidence: det.ocr_confidence,
        detection_method: 'yolo_v6_iter5',
        standard,
        raw_ocr_text: det.ocr_text,
        crop_image_path: null,
        needs_review: det.confidence < 0.7 ? 1 : 0,
        reviewed: 0,
        reviewed_by: null,
        corrected_label: null,
      });

      result.entities.push(entity);
    }
  }

  // Create detection run record
  const run = detectionRuns.insert({
    pdf_path: pdfPath,
    model_version: 'v6_iteration5',
    parameters_json: JSON.stringify({
      dpi: 72,
      tileSize: 2048,
      overlap: 0.2,
      confThreshold,
      standard,
    }),
    total_detections: totalDetections,
    needs_review: needsReview,
  });
  result.runId = run.id;

  console.log(`v6 iteration 5 detection complete: ${totalDetections} detections across ${allSheets.length} sheets`);

  console.log(`Inserted ${result.entities.length} entities from YOLO pipeline`);
  return result;
}

export async function detectOnSheet(
  sheetId: string,
  options: YOLOExtractionOptions = {}
): Promise<Entity[]> {
  const sheet = sheets.getById(sheetId);
  if (!sheet || !sheet.image_path) {
    throw new Error(`Sheet ${sheetId} not found or has no image`);
  }

  const {
    confThreshold = 0.25, // v5 optimal confidence
    standard = 'auto',
    validate = true,
    useGemini = false,
  } = options;

  if (!existsSync(PYTHON_API)) {
    throw new Error(`YOLO API script not found at ${PYTHON_API}`);
  }

  if (!existsSync(YOLO_MODEL)) {
    throw new Error(`YOLO model not found at ${YOLO_MODEL}`);
  }

  const outputDir = join(OUTPUT_DIR, `sheet-${sheetId}`);
  mkdirSync(outputDir, { recursive: true });

  console.log(`Running YOLO v6 Iteration 5 detection on sheet ${sheet.sheet_number}...`);
  if (useGemini) {
    console.log('  Using Gemini Flash 2 for text extraction');
  }

  try {
    // Downsample to 72 DPI for detection (model was trained on 72 DPI)
    // Images from ingestion are at 150 DPI, need to scale to 72 DPI
    const DISPLAY_DPI = 150;
    const DETECTION_DPI = 72;
    const scaleFactor = DETECTION_DPI / DISPLAY_DPI;
    const targetWidth = Math.round((sheet.width ?? 7200) * scaleFactor);
    const targetHeight = Math.round((sheet.height ?? 5400) * scaleFactor);

    const downsampledPath = join(outputDir, 'downsampled-72dpi.png');
    await $`python -c "from PIL import Image; img = Image.open('${sheet.image_path}'); downsampled = img.resize((${targetWidth}, ${targetHeight}), Image.Resampling.LANCZOS); downsampled.save('${downsampledPath}')"`.quiet();

    // Run v5 detection using api_detect.py on downsampled image
    const args = [
      'python', PYTHON_API,
      '--image', downsampledPath,
      '--output', outputDir,
      '--conf', String(confThreshold),
    ];

    if (!validate) {
      args.push('--no-filters');
    }

    if (useGemini) {
      const apiKey = process.env.OPENROUTER_API_KEY;
      if (!apiKey) {
        throw new Error('OPENROUTER_API_KEY environment variable required for Gemini extraction');
      }
      args.push('--gemini', '--openrouter-key', apiKey);
    }

    await $`${args}`.quiet();

    const detectionsPath = join(outputDir, 'detections.json');
    if (!existsSync(detectionsPath)) {
      return [];
    }

    // v6 format with OCR: {detections: [{bbox, class, confidence, ocr_text, identifier, target_sheet}]}
    const detectionsFile = JSON.parse(readFileSync(detectionsPath, 'utf-8')) as {
      detections: Array<{
        bbox: number[];  // [x, y, w, h]
        class: string;
        confidence: number;
        ocr_text: string | null;
        ocr_confidence: number;
        identifier: string | null;
        target_sheet: string | null;
      }>;
    };

    const detections = detectionsFile.detections;

    // Scale factor to convert 72 DPI coords back to 150 DPI display coords
    const upscaleFactor = DISPLAY_DPI / DETECTION_DPI;

    const newEntities: Entity[] = [];

    for (const det of detections) {
      // Convert [x, y, w, h] to [x1, y1, x2, y2] and scale to display resolution
      const x1 = (det.bbox[0] ?? 0) * upscaleFactor;
      const y1 = (det.bbox[1] ?? 0) * upscaleFactor;
      const x2 = ((det.bbox[0] ?? 0) + (det.bbox[2] ?? 0)) * upscaleFactor;
      const y2 = ((det.bbox[1] ?? 0) + (det.bbox[3] ?? 0)) * upscaleFactor;

      const entity = entities.insert({
        sheet_id: sheetId,
        class_label: mapClassToLabel(det.class),
        ocr_text: det.ocr_text,
        confidence: det.confidence,
        bbox_x1: x1 as number,
        bbox_y1: y1 as number,
        bbox_x2: x2 as number,
        bbox_y2: y2 as number,
        identifier: det.identifier,
        target_sheet: det.target_sheet,
        triangle_count: null,
        triangle_positions: null,
        yolo_confidence: det.confidence,
        ocr_confidence: det.ocr_confidence,
        detection_method: 'yolo_v6_iter5',
        standard,
        raw_ocr_text: det.ocr_text,
        crop_image_path: null,
        needs_review: det.confidence < 0.7 ? 1 : 0,
        reviewed: 0,
        reviewed_by: null,
        corrected_label: null,
      });

      newEntities.push(entity);
    }

    console.log(`Inserted ${newEntities.length} entities for sheet ${sheet.sheet_number}`);
    return newEntities;
  } catch (error) {
    console.error(`Detection failed: ${error}`);
    return [];
  }
}

export function getCropPath(entityId: string): string | null {
  const entity = entities.getById(entityId);
  if (!entity || !entity.crop_image_path) {
    return null;
  }
  return entity.crop_image_path;
}

if (import.meta.main) {
  const pdfPath = process.argv[2];
  if (!pdfPath) {
    console.log("Usage: bun run yolo-extraction.ts <pdf-path>");
    process.exit(1);
  }

  const absolutePath = pdfPath.startsWith("/") ? pdfPath : join(process.cwd(), pdfPath);

  const result = await extractWithYOLO(absolutePath, {
    dpi: 300,
    confThreshold: 0.1,
  });

  console.log("\n--- Results ---");
  console.log(`Run ID: ${result.runId}`);
  console.log(`Total entities: ${result.entities.length}`);

  if (result.summary) {
    console.log(`By class:`, result.summary.by_class);
  }
}
