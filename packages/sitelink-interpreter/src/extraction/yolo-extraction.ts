import { $ } from "bun";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, basename } from "path";
import { sheets, entities, detectionRuns, type Sheet, type Entity } from "../db/index.ts";

const PYTHON_API = join(import.meta.dir, "../../../callout-processor-v5/src/api_detect.py");
// v5 model: 96.5% P/R on Canadian, 97.1% P / 95.4% R combined (Canadian + US)
// Trained with SAHI tiling, 72 DPI, 2048px tiles
const YOLO_MODEL = join(import.meta.dir, "../../../callout-processor-v5/runs/detect/v5_combined2/weights/best.pt");
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
}

function mapClassToLabel(className: string): string {
  const mapping: Record<string, string> = {
    detail: "detail_callout",
    elevation: "elevation_callout",
    section: "section_cut",
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

  console.log(`Running YOLO v5 detection on ${pdfPath}...`);
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
      model: 'v5_combined2',
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

    console.log(`v5 detection complete: ${summary.total_detections} detections across ${summary.total_sheets} sheets`);
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
  const result = {
    entities: [] as Entity[],
    runId: '',
    summary: null as PipelineSummary | null,
  };

  const summary = await runYOLOPipeline(pdfPath, options);
  if (!summary) {
    return result;
  }

  result.summary = summary;

  const run = detectionRuns.insert({
    pdf_path: pdfPath,
    model_version: 'v5_combined2',
    parameters_json: JSON.stringify({
      dpi: options.dpi ?? 72,
      tileSize: options.tileSize ?? 2048,
      overlap: options.overlap ?? 0.2,
      confThreshold: options.confThreshold ?? 0.25,
      standard: options.standard ?? 'auto',
    }),
    total_detections: summary.total_detections,
    needs_review: summary.needs_review,
  });
  result.runId = run.id;

  const pdfName = basename(pdfPath, '.pdf');
  const outputDir = join(OUTPUT_DIR, pdfName);

  const allSheets = sheets.getByPdf(pdfPath);

  for (const sheetInfo of summary.sheets) {
    const sheet = allSheets.find(s => s.page_number === sheetInfo.sheet_index + 1);
    if (!sheet) {
      console.warn(`No sheet found for page ${sheetInfo.sheet_index + 1}`);
      continue;
    }

    const sheetDir = join(outputDir, `sheet-${sheetInfo.sheet_index}`);
    const detectionsPath = join(sheetDir, 'detections.json');

    if (!existsSync(detectionsPath)) {
      console.warn(`No detections.json for sheet ${sheetInfo.sheet_index}`);
      continue;
    }

    // v5 format: {detections: [{bbox: [x,y,w,h], class: string, confidence: number}]}
    const detectionsFile = JSON.parse(readFileSync(detectionsPath, 'utf-8')) as {
      detections: Array<{
        bbox: number[];
        class: string;
        confidence: number;
      }>;
    };

    for (const det of detectionsFile.detections) {
      const classLabel = mapClassToLabel(det.class);

      // Convert [x, y, w, h] to [x1, y1, x2, y2]
      const x1 = det.bbox[0] ?? 0;
      const y1 = det.bbox[1] ?? 0;
      const x2 = (det.bbox[0] ?? 0) + (det.bbox[2] ?? 0);
      const y2 = (det.bbox[1] ?? 0) + (det.bbox[3] ?? 0);

      const entity = entities.insert({
        sheet_id: sheet.id,
        class_label: classLabel,
        ocr_text: null,  // v5 doesn't include OCR
        confidence: det.confidence,
        bbox_x1: x1 as number,
        bbox_y1: y1 as number,
        bbox_x2: x2 as number,
        bbox_y2: y2 as number,
        identifier: null,
        target_sheet: null,
        triangle_count: null,
        triangle_positions: null,
        yolo_confidence: det.confidence,
        ocr_confidence: null,
        detection_method: 'yolo_v5',
        standard: options.standard ?? 'auto',
        raw_ocr_text: null,
        crop_image_path: null,
        needs_review: det.confidence < 0.7 ? 1 : 0,
        reviewed: 0,
        reviewed_by: null,
        corrected_label: null,
      });

      result.entities.push(entity);
    }
  }

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
  } = options;

  if (!existsSync(PYTHON_API)) {
    throw new Error(`YOLO API script not found at ${PYTHON_API}`);
  }

  if (!existsSync(YOLO_MODEL)) {
    throw new Error(`YOLO model not found at ${YOLO_MODEL}`);
  }

  const outputDir = join(OUTPUT_DIR, `sheet-${sheetId}`);
  mkdirSync(outputDir, { recursive: true });

  console.log(`Running YOLO v5 detection on sheet ${sheet.sheet_number}...`);

  try {
    const imagePath = sheet.image_path;

    // Run v5 detection using api_detect.py
    const args = [
      'python', PYTHON_API,
      '--image', imagePath,
      '--output', outputDir,
      '--conf', String(confThreshold),
    ];

    if (!validate) {
      args.push('--no-filters');
    }

    await $`${args}`.quiet();

    const detectionsPath = join(outputDir, 'detections.json');
    if (!existsSync(detectionsPath)) {
      return [];
    }

    // v5 format: {detections: [{bbox: [x,y,w,h], class: string, confidence: number}]}
    const detectionsFile = JSON.parse(readFileSync(detectionsPath, 'utf-8')) as {
      detections: Array<{
        bbox: number[];  // [x, y, w, h]
        class: string;
        confidence: number;
      }>;
    };

    const detections = detectionsFile.detections;

    const newEntities: Entity[] = [];

    for (const det of detections) {
      // Convert [x, y, w, h] to [x1, y1, x2, y2]
      const x1 = det.bbox[0] ?? 0;
      const y1 = det.bbox[1] ?? 0;
      const x2 = (det.bbox[0] ?? 0) + (det.bbox[2] ?? 0);
      const y2 = (det.bbox[1] ?? 0) + (det.bbox[3] ?? 0);

      const entity = entities.insert({
        sheet_id: sheetId,
        class_label: mapClassToLabel(det.class),
        ocr_text: null,  // v5 doesn't include OCR in detections
        confidence: det.confidence,
        bbox_x1: x1 as number,
        bbox_y1: y1 as number,
        bbox_x2: x2 as number,
        bbox_y2: y2 as number,
        identifier: null,
        target_sheet: null,
        triangle_count: null,
        triangle_positions: null,
        yolo_confidence: det.confidence,
        ocr_confidence: null,
        detection_method: 'yolo_v5',
        standard,
        raw_ocr_text: null,
        crop_image_path: null,  // v5 api_detect doesn't save crops
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
