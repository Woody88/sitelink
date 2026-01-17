import { $ } from "bun";
import { existsSync, readFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { sheets, entities, type Sheet, type Entity } from "../db/index.ts";
import { extractProjectContext, type ProjectContext } from "../context/index.ts";

const PYTHON_DETECTOR = join(import.meta.dir, "../../../callout-processor-v3/src/detect.py");
const OUTPUT_DIR = join(import.meta.dir, "../../output/extractions");

export interface Marker {
  id: string;
  label: string;
  type: "detail" | "elevation" | "section" | "title";
  x: number;
  y: number;
  pixelX: number;
  pixelY: number;
  bbox: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  };
  confidence: number;
  radius: number;
  triangleCount: number;
  trianglePositions: string[];
  identifier?: string;
  viewSheet?: string;
  locationSheet?: string;
}

interface ExtractionResult {
  sheetId: string;
  markers: Marker[];
  entities: Entity[];
  errors: string[];
}

function mapMarkerTypeToClassLabel(type: string): string {
  const mapping: Record<string, string> = {
    detail: "detail_callout",
    elevation: "elevation_callout",
    section: "section_cut",
    title: "title_callout",
  };
  return mapping[type] ?? type;
}

function parseCalloutLabel(label: string): { identifier: string | null; targetSheet: string | null } {
  const match = label.match(/^(\d+|[A-Z])\/([A-Z]\d+)$/i);
  if (match) {
    return { identifier: match[1] ?? null, targetSheet: match[2]?.toUpperCase() ?? null };
  }

  const simpleMatch = label.match(/^(\d+|[A-Z])$/i);
  if (simpleMatch) {
    return { identifier: simpleMatch[1] ?? null, targetSheet: null };
  }

  return { identifier: label, targetSheet: null };
}

let detectionRan = false;
let allMarkersCache: Map<number, Marker[]> = new Map();

async function runPythonDetectorOnPdf(pdfPath: string, outputDir: string): Promise<void> {
  if (detectionRan) return;

  if (!existsSync(PYTHON_DETECTOR)) {
    console.warn(`Python detector not found at ${PYTHON_DETECTOR}`);
    return;
  }

  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  console.log(`Running Python detector on PDF...`);

  try {
    await $`python ${PYTHON_DETECTOR} --pdf ${pdfPath} --output ${outputDir}`.quiet();
    detectionRan = true;

    const sheetDirs = await $`ls -d ${outputDir}/sheet-* 2>/dev/null || true`.text();
    for (const dir of sheetDirs.trim().split("\n").filter(Boolean)) {
      const markersFile = join(dir, "markers.json");
      if (existsSync(markersFile)) {
        const content = readFileSync(markersFile, "utf-8");
        const markers = JSON.parse(content) as Marker[];
        const sheetNum = parseInt(dir.match(/sheet-(\d+)/)?.[1] ?? "0", 10);
        allMarkersCache.set(sheetNum, markers);
      }
    }
    console.log(`Loaded markers for ${allMarkersCache.size} sheets`);
  } catch (error) {
    console.error(`Python detector failed: ${error}`);
  }
}

function getMarkersForSheet(pageNumber: number): Marker[] {
  return allMarkersCache.get(pageNumber - 1) ?? [];
}

export async function extractFromSheet(sheet: Sheet, context?: ProjectContext): Promise<ExtractionResult> {
  const result: ExtractionResult = {
    sheetId: sheet.id,
    markers: [],
    entities: [],
    errors: [],
  };

  result.markers = getMarkersForSheet(sheet.page_number);
  console.log(`  ${sheet.sheet_number}: Found ${result.markers.length} markers`);

  for (const marker of result.markers) {
    const { identifier, targetSheet } = parseCalloutLabel(marker.label);
    const needsReview = marker.confidence < 0.8;

    const entity = entities.insert({
      sheet_id: sheet.id,
      class_label: mapMarkerTypeToClassLabel(marker.type),
      ocr_text: marker.label,
      confidence: marker.confidence,
      bbox_x1: marker.bbox.x1,
      bbox_y1: marker.bbox.y1,
      bbox_x2: marker.bbox.x2,
      bbox_y2: marker.bbox.y2,
      identifier: identifier ?? marker.identifier ?? null,
      target_sheet: targetSheet ?? marker.viewSheet ?? null,
      triangle_count: marker.triangleCount,
      triangle_positions: JSON.stringify(marker.trianglePositions),
      needs_review: needsReview ? 1 : 0,
      reviewed: 0,
      reviewed_by: null,
      corrected_label: null,
    });

    result.entities.push(entity);
  }

  return result;
}

export async function extractAll(pdfPath?: string): Promise<ExtractionResult[]> {
  const sheetsList = pdfPath ? sheets.getByPdf(pdfPath) : sheets.getAll();

  if (sheetsList.length === 0) {
    throw new Error("No sheets found. Run ingestion first.");
  }

  console.log(`\nExtracting entities from ${sheetsList.length} sheets...`);

  const context = await extractProjectContext(pdfPath);
  console.log(`Using context: ${context.standard} / ${context.country}\n`);

  const actualPdfPath = pdfPath ?? sheetsList[0]?.pdf_path;
  if (actualPdfPath) {
    await runPythonDetectorOnPdf(actualPdfPath, OUTPUT_DIR);
  }

  const results: ExtractionResult[] = [];

  for (const sheet of sheetsList) {
    const result = await extractFromSheet(sheet, context);
    results.push(result);
  }

  const totalEntities = results.reduce((sum, r) => sum + r.entities.length, 0);
  const needsReview = results.reduce((sum, r) => sum + r.entities.filter(e => e.needs_review).length, 0);

  console.log(`\n--- Extraction Summary ---`);
  console.log(`Total sheets: ${results.length}`);
  console.log(`Total entities: ${totalEntities}`);
  console.log(`Needs review: ${needsReview}`);

  return results;
}

if (import.meta.main) {
  const pdfPath = process.argv[2];
  const absolutePath = pdfPath
    ? (pdfPath.startsWith("/") ? pdfPath : join(process.cwd(), pdfPath))
    : undefined;

  const results = await extractAll(absolutePath);

  console.log("\n--- Per-Sheet Breakdown ---");
  for (const r of results) {
    const sheet = sheets.getById(r.sheetId);
    const byType: Record<string, number> = {};
    for (const e of r.entities) {
      byType[e.class_label] = (byType[e.class_label] ?? 0) + 1;
    }
    console.log(`${sheet?.sheet_number ?? "?"}: ${r.entities.length} entities`, byType);
  }
}
