import { $ } from "bun";
import { existsSync, readFileSync, mkdirSync } from "fs";
import { join, basename } from "path";
import { sheets, entities, detectionRuns, type Sheet, type Entity } from "../db/index.ts";

const PYTHON_PIPELINE = join(import.meta.dir, "../../../callout-processor-v4/src/unified_pipeline.py");
// YOLO26 model trained on callout detection at 2048px native resolution
// See bead sitelink-rnc for training history
const YOLO_MODEL = join(import.meta.dir, "../../../callout-processor-v4/weights/callout_detector.pt");
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
  dpi?: number;
  tileSize?: number;
  overlap?: number;
  confThreshold?: number;
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
    dpi = 300,
    tileSize = 640,
    overlap = 0.25,
    confThreshold = 0.1,
    standard = 'auto',
    validate = false,
  } = options;

  if (!existsSync(PYTHON_PIPELINE)) {
    console.error(`YOLO pipeline not found at ${PYTHON_PIPELINE}`);
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

  console.log(`Running YOLO pipeline on ${pdfPath}...`);

  try {
    const args = [
      'python', PYTHON_PIPELINE,
      '--pdf', pdfPath,
      '--output', outputDir,
      '--model', YOLO_MODEL,
      '--dpi', String(dpi),
      '--tile-size', String(tileSize),
      '--overlap', String(overlap),
      '--conf', String(confThreshold),
      '--standard', standard,
    ];

    if (!validate) {
      args.push('--no-validate');
    }

    await $`${args}`.quiet();

    const summaryPath = join(outputDir, 'summary.json');
    if (!existsSync(summaryPath)) {
      console.error("Pipeline ran but summary.json not found");
      return null;
    }

    const summary = JSON.parse(readFileSync(summaryPath, 'utf-8')) as PipelineSummary;
    console.log(`Pipeline complete: ${summary.total_detections} detections across ${summary.total_sheets} sheets`);

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
    model_version: basename(YOLO_MODEL),
    parameters_json: JSON.stringify({
      dpi: options.dpi ?? 300,
      tileSize: options.tileSize ?? 640,
      overlap: options.overlap ?? 0.25,
      confThreshold: options.confThreshold ?? 0.1,
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

    const detections = JSON.parse(readFileSync(detectionsPath, 'utf-8')) as YOLODetection[];

    for (const det of detections) {
      const classLabel = mapClassToLabel(det.class_name);

      const cropPath = det.crop_path
        ? join(sheetDir, det.crop_path)
        : null;

      const entity = entities.insert({
        sheet_id: sheet.id,
        class_label: classLabel,
        ocr_text: det.ocr_text,
        confidence: det.confidence * (0.5 + 0.5 * det.ocr_confidence),
        bbox_x1: det.bbox.x1,
        bbox_y1: det.bbox.y1,
        bbox_x2: det.bbox.x2,
        bbox_y2: det.bbox.y2,
        identifier: det.identifier,
        target_sheet: det.view_sheet,
        triangle_count: null,
        triangle_positions: null,
        yolo_confidence: det.confidence,
        ocr_confidence: det.ocr_confidence,
        detection_method: 'yolo',
        standard: det.standard,
        raw_ocr_text: det.ocr_text,
        crop_image_path: cropPath,
        needs_review: det.needs_review ? 1 : 0,
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
    dpi = 300,
    tileSize = 640,
    overlap = 0.25,
    confThreshold = 0.1,
    standard = 'auto',
  } = options;

  if (!existsSync(PYTHON_PIPELINE)) {
    throw new Error(`YOLO pipeline not found at ${PYTHON_PIPELINE}`);
  }

  if (!existsSync(YOLO_MODEL)) {
    throw new Error(`YOLO model not found at ${YOLO_MODEL}`);
  }

  const outputDir = join(OUTPUT_DIR, `sheet-${sheetId}`);
  mkdirSync(outputDir, { recursive: true });

  console.log(`Running YOLO detection on sheet ${sheet.sheet_number}...`);

  try {
    const imagePath = sheet.image_path;

    await $`python -c "
import cv2
import json
import sys
sys.path.insert(0, '${join(import.meta.dir, "../../../callout-processor-v4/src")}')
from infer_yolo import tile_inference, YOLO, CLASS_NAMES
from unified_pipeline import crop_detection, ocr_crop, parse_callout_label, validate_detection, Detection
from standards import detect_standard

model = YOLO('${YOLO_MODEL}')
image = cv2.imread('${imagePath}')

raw_dets = tile_inference(model, image, tile_size=${tileSize}, overlap=${overlap}, conf_threshold=${confThreshold})

results = []
for i, det in enumerate(raw_dets):
    bbox = {'x1': det['x1'], 'y1': det['y1'], 'x2': det['x2'], 'y2': det['y2']}
    crop = crop_detection(image, bbox, padding=15)
    crop_path = '${outputDir}/crop_{}.png'.format(i)
    cv2.imwrite(crop_path, crop)

    ocr_text, ocr_conf = ocr_crop(crop)
    parsed = parse_callout_label(ocr_text or '')

    detected_std = '${standard}'
    if parsed['view_sheet']:
        detected_std = detect_standard(parsed['view_sheet'])

    results.append({
        'class_name': det['class_name'],
        'bbox': bbox,
        'confidence': det['confidence'],
        'ocr_text': ocr_text,
        'ocr_confidence': ocr_conf,
        'identifier': parsed['identifier'],
        'view_sheet': parsed['view_sheet'],
        'standard': detected_std if detected_std != 'unknown' else 'auto',
        'needs_review': det['confidence'] < 0.7 or ocr_conf < 0.5,
        'crop_path': crop_path,
    })

with open('${outputDir}/detections.json', 'w') as f:
    json.dump(results, f, indent=2)

print(f'Detected {len(results)} callouts')
"`.quiet();

    const detectionsPath = join(outputDir, 'detections.json');
    if (!existsSync(detectionsPath)) {
      return [];
    }

    const detections = JSON.parse(readFileSync(detectionsPath, 'utf-8')) as Array<{
      class_name: string;
      bbox: { x1: number; y1: number; x2: number; y2: number };
      confidence: number;
      ocr_text: string | null;
      ocr_confidence: number;
      identifier: string | null;
      view_sheet: string | null;
      standard: string;
      needs_review: boolean;
      crop_path: string;
    }>;

    const newEntities: Entity[] = [];

    for (const det of detections) {
      const entity = entities.insert({
        sheet_id: sheetId,
        class_label: mapClassToLabel(det.class_name),
        ocr_text: det.ocr_text,
        confidence: det.confidence * (0.5 + 0.5 * det.ocr_confidence),
        bbox_x1: det.bbox.x1,
        bbox_y1: det.bbox.y1,
        bbox_x2: det.bbox.x2,
        bbox_y2: det.bbox.y2,
        identifier: det.identifier,
        target_sheet: det.view_sheet,
        triangle_count: null,
        triangle_positions: null,
        yolo_confidence: det.confidence,
        ocr_confidence: det.ocr_confidence,
        detection_method: 'yolo',
        standard: det.standard,
        raw_ocr_text: det.ocr_text,
        crop_image_path: det.crop_path,
        needs_review: det.needs_review ? 1 : 0,
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
