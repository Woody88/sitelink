import { sheets, entities, relationships, getDb, nanoid, type Sheet, type Entity } from "../db/index.ts";
import { getProvenanceChain } from "../synthesis/index.ts";
import { ingestPdf } from "../ingestion/index.ts";
import { extractAll, loadCorrectionRules, resetDetectionCache } from "../extraction/index.ts";
import { extractWithYOLO, detectOnSheet, getCropPath, type YOLOExtractionOptions } from "../extraction/yolo-extraction.ts";
import { buildRelationships } from "../synthesis/index.ts";
import reviewHtml from "../ui/review.html";
import explorerHtml from "../ui/explorer.html";
import { join, basename, dirname } from "path";
import { existsSync, mkdirSync, writeFileSync } from "fs";

const PORT = 3456;
const OUTPUT_DIR = join(import.meta.dir, "../../output/sheets");
const YOLO_OUTPUT_DIR = join(import.meta.dir, "../../output/yolo-extractions");

interface EntityWithProvenance extends Entity {
  sheet_number?: string;
  references?: Entity[];
  referenced_by?: Entity[];
}

function getSheetForEntity(entity: Entity): Sheet | null {
  return sheets.getById(entity.sheet_id);
}

function enrichEntity(entity: Entity): EntityWithProvenance {
  const sheet = getSheetForEntity(entity);
  const provenance = getProvenanceChain(entity.id);

  return {
    ...entity,
    sheet_number: sheet?.sheet_number ?? undefined,
    references: provenance?.references,
    referenced_by: provenance?.referencedBy,
  };
}

const server = Bun.serve({
  port: PORT,

  routes: {
    "/": explorerHtml,
    "/review": reviewHtml,

    "/api": () => {
      return Response.json({
        name: "SiteLink Interpreter API",
        version: "1.0.0",
      });
    },

    "/api/upload": {
      async POST(req) {
        try {
          const formData = await req.formData();
          const file = formData.get("pdf") as File | null;
          const extractionMethod = formData.get("extractionMethod") as string | null;

          if (!file) {
            return Response.json({ error: "No PDF file provided" }, { status: 400 });
          }

          const uploadsDir = join(import.meta.dir, "../../uploads");
          if (!existsSync(uploadsDir)) {
            mkdirSync(uploadsDir, { recursive: true });
          }

          const pdfPath = join(uploadsDir, file.name);
          const arrayBuffer = await file.arrayBuffer();
          writeFileSync(pdfPath, Buffer.from(arrayBuffer));

          console.log(`\n=== Processing uploaded PDF: ${file.name} ===`);
          console.log(`Extraction method: ${extractionMethod || "default"}`);

          console.log("Step 0: Clearing previous data...");
          const db = getDb();
          db.exec(`PRAGMA foreign_keys = OFF`);
          db.exec(`DELETE FROM relationships`);
          db.exec(`DELETE FROM entities`);
          db.exec(`DELETE FROM sheets`);
          db.exec(`PRAGMA foreign_keys = ON`);
          resetDetectionCache();
          console.log("  Previous data cleared");

          console.log("Step 1: Ingesting PDF...");
          const ingestionResult = await ingestPdf(pdfPath);
          console.log(`  Created ${ingestionResult.sheets.length} sheets`);

          console.log("Step 2: Extracting entities...");
          let totalEntities: number;
          let needsReview = 0;

          if (extractionMethod === "yolo-v5") {
            const yoloResult = await extractWithYOLO(pdfPath, {});
            totalEntities = yoloResult.entities.length;
            needsReview = yoloResult.summary?.needs_review ?? 0;
            console.log(`  Found ${totalEntities} entities (YOLO v6 Iteration 5)`);
          } else {
            const extractionResults = await extractAll(pdfPath);
            totalEntities = extractionResults.reduce((sum, r) => sum + r.entities.length, 0);
            console.log(`  Found ${totalEntities} entities`);
          }

          console.log("Step 3: Building relationships...");
          const linkResult = buildRelationships();
          console.log(`  Created ${linkResult.created} relationships`);

          console.log("=== Processing complete ===\n");

          return Response.json({
            success: true,
            pdf_name: file.name,
            sheets_created: ingestionResult.sheets.length,
            entities_found: totalEntities,
            needs_review: needsReview,
            relationships_created: linkResult.created,
          });
        } catch (error) {
          console.error("Upload processing failed:", error);
          return Response.json({
            error: "Processing failed",
            details: String(error)
          }, { status: 500 });
        }
      },
    },

    "/api/sheets": () => {
      const allSheets = sheets.getAll();
      return Response.json({
        count: allSheets.length,
        sheets: allSheets.map(s => ({
          id: s.id,
          sheet_number: s.sheet_number,
          sheet_type: s.sheet_type,
          sheet_title: s.sheet_title,
          page_number: s.page_number,
          width: s.width,
          height: s.height,
          image_url: `/images/${basename(s.image_path ?? "")}`,
        })),
      });
    },

    "/api/sheets/:id": (req) => {
      const sheet = sheets.getById(req.params.id);
      if (!sheet) {
        return Response.json({ error: "Sheet not found" }, { status: 404 });
      }
      return Response.json({
        ...sheet,
        image_url: `/images/${basename(sheet.image_path ?? "")}`,
      });
    },

    "/api/sheets/:id/entities": (req) => {
      const sheet = sheets.getById(req.params.id);
      if (!sheet) {
        return Response.json({ error: "Sheet not found" }, { status: 404 });
      }

      const sheetEntities = entities.getBySheet(req.params.id);
      return Response.json({
        sheet_id: sheet.id,
        sheet_number: sheet.sheet_number,
        count: sheetEntities.length,
        entities: sheetEntities.map(enrichEntity),
      });
    },

    "/api/sheets/:id/detect": {
      async POST(req) {
        const sheet = sheets.getById(req.params.id);
        if (!sheet) {
          return Response.json({ error: "Sheet not found" }, { status: 404 });
        }

        try {
          const body = await req.json().catch(() => ({})) as Partial<YOLOExtractionOptions>;
          const options: YOLOExtractionOptions = {
            useGemini: true,  // Default to Gemini for better text extraction
            ...body,
          };

          console.log(`\n=== Running YOLO detection on sheet ${sheet.sheet_number} ===`);
          const newEntities = await detectOnSheet(req.params.id, options);

          return Response.json({
            success: true,
            sheet_id: sheet.id,
            sheet_number: sheet.sheet_number,
            entities_detected: newEntities.length,
            entities: newEntities.map(enrichEntity),
          });
        } catch (error) {
          console.error("Detection failed:", error);
          return Response.json({
            error: "Detection failed",
            details: String(error),
          }, { status: 500 });
        }
      },
    },

    "/api/detect": {
      async POST(req) {
        try {
          const formData = await req.formData();
          const file = formData.get("pdf") as File | null;
          const optionsJson = formData.get("options") as string | null;

          if (!file) {
            return Response.json({ error: "No PDF file provided" }, { status: 400 });
          }

          const parsedOptions = optionsJson ? JSON.parse(optionsJson) : {};
          const options: YOLOExtractionOptions = {
            useGemini: true,  // Default to Gemini for better text extraction
            ...parsedOptions,
          };

          const uploadsDir = join(import.meta.dir, "../../uploads");
          if (!existsSync(uploadsDir)) {
            mkdirSync(uploadsDir, { recursive: true });
          }

          const pdfPath = join(uploadsDir, file.name);
          const arrayBuffer = await file.arrayBuffer();
          writeFileSync(pdfPath, Buffer.from(arrayBuffer));

          console.log(`\n=== Running YOLO pipeline on ${file.name} ===`);

          console.log("Step 0: Clearing previous data...");
          const db = getDb();
          db.exec(`PRAGMA foreign_keys = OFF`);
          db.exec(`DELETE FROM relationships`);
          db.exec(`DELETE FROM entities`);
          db.exec(`DELETE FROM sheets`);
          db.exec(`PRAGMA foreign_keys = ON`);
          resetDetectionCache();

          console.log("Step 1: Ingesting PDF...");
          const ingestionResult = await ingestPdf(pdfPath);

          console.log("Step 2: Running YOLO detection...");
          const yoloResult = await extractWithYOLO(pdfPath, options);

          console.log("Step 3: Building relationships...");
          const linkResult = buildRelationships();

          console.log("=== YOLO pipeline complete ===\n");

          return Response.json({
            success: true,
            pdf_name: file.name,
            sheets_created: ingestionResult.sheets.length,
            entities_found: yoloResult.entities.length,
            needs_review: yoloResult.summary?.needs_review ?? 0,
            relationships_created: linkResult.created,
            run_id: yoloResult.runId,
            by_class: yoloResult.summary?.by_class ?? {},
          });
        } catch (error) {
          console.error("Detection failed:", error);
          return Response.json({
            error: "Detection failed",
            details: String(error),
          }, { status: 500 });
        }
      },
    },

    "/api/entities": (req) => {
      const url = new URL(req.url);
      const sheetNumber = url.searchParams.get("sheet");
      const label = url.searchParams.get("label");
      const type = url.searchParams.get("type");

      let allSheets = sheets.getAll();
      let results: Entity[] = [];

      for (const sheet of allSheets) {
        if (sheetNumber && sheet.sheet_number?.toUpperCase() !== sheetNumber.toUpperCase()) {
          continue;
        }

        const sheetEntities = entities.getBySheet(sheet.id);
        for (const entity of sheetEntities) {
          if (label && entity.ocr_text?.toUpperCase() !== label.toUpperCase()) {
            continue;
          }
          if (type && entity.class_label !== type) {
            continue;
          }
          results.push(entity);
        }
      }

      return Response.json({
        count: results.length,
        entities: results.map(enrichEntity),
      });
    },

    "/api/entities/:id": (req) => {
      const entity = entities.getById(req.params.id);
      if (!entity) {
        return Response.json({ error: "Entity not found" }, { status: 404 });
      }
      return Response.json(enrichEntity(entity));
    },

    "/api/entities/:id/provenance": (req) => {
      const entity = entities.getById(req.params.id);
      if (!entity) {
        return Response.json({ error: "Entity not found" }, { status: 404 });
      }

      const sheet = getSheetForEntity(entity);
      const provenance = getProvenanceChain(req.params.id);

      return Response.json({
        entity: {
          ...entity,
          sheet_number: sheet?.sheet_number,
        },
        source_location: {
          sheet_id: sheet?.id,
          sheet_number: sheet?.sheet_number,
          image_url: `/images/${basename(sheet?.image_path ?? "")}`,
          width: sheet?.width,
          height: sheet?.height,
          bbox: {
            x1: entity.bbox_x1,
            y1: entity.bbox_y1,
            x2: entity.bbox_x2,
            y2: entity.bbox_y2,
          },
        },
        references: provenance?.references.map(e => ({
          ...e,
          sheet_number: getSheetForEntity(e)?.sheet_number,
        })) ?? [],
        referenced_by: provenance?.referencedBy.map(e => ({
          ...e,
          sheet_number: getSheetForEntity(e)?.sheet_number,
        })) ?? [],
      });
    },

    "/api/entities/:id/crop": async (req) => {
      const entity = entities.getById(req.params.id);
      if (!entity) {
        return Response.json({ error: "Entity not found" }, { status: 404 });
      }

      if (!entity.crop_image_path) {
        return Response.json({ error: "No crop image available for this entity" }, { status: 404 });
      }

      const cropPath = entity.crop_image_path;
      if (!existsSync(cropPath)) {
        return Response.json({ error: "Crop image file not found" }, { status: 404 });
      }

      const file = Bun.file(cropPath);
      return new Response(file, {
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "public, max-age=3600",
        },
      });
    },

    "/api/entities/:id/review": {
      async POST(req) {
        const entity = entities.getById(req.params.id);
        if (!entity) {
          return Response.json({ error: "Entity not found" }, { status: 404 });
        }

        const body = await req.json() as {
          corrected_label?: string;
          corrected_text?: string;
        };

        entities.update(entity.id, {
          reviewed: 1,
          needs_review: 0,
          corrected_label: body.corrected_label ?? entity.class_label,
        });

        const db = getDb();
        const trainingId = nanoid();
        db.run(
          `INSERT INTO training_data (id, entity_id, original_label, corrected_label, reviewer)
           VALUES (?, ?, ?, ?, ?)`,
          [trainingId, entity.id, entity.class_label, body.corrected_label ?? entity.class_label, "hitl-ui"]
        );

        return Response.json({
          success: true,
          entity_id: entity.id,
          corrected_label: body.corrected_label,
          training_data_id: trainingId,
        });
      },
    },

    "/api/review": () => {
      const needsReview = entities.getNeedingReview();
      return Response.json({
        count: needsReview.length,
        entities: needsReview.map(e => {
          const sheet = getSheetForEntity(e);
          return {
            ...enrichEntity(e),
            image_url: `/images/${basename(sheet?.image_path ?? "")}`,
            sheet_width: sheet?.width,
            sheet_height: sheet?.height,
          };
        }),
      });
    },

    "/api/retrain": {
      async POST() {
        try {
          const db = getDb();

          const trainingCount = db.query(`SELECT COUNT(*) as count FROM training_data`).get() as { count: number };
          if (trainingCount.count === 0) {
            return Response.json({ error: "No training data. Review some entities first." }, { status: 400 });
          }

          const rules = loadCorrectionRules();
          console.log(`\n=== Retraining with ${rules.length} correction rules ===`);

          const beforeCount = db.query(`SELECT COUNT(*) as count FROM entities`).get() as { count: number };

          db.exec(`PRAGMA foreign_keys = OFF`);
          db.exec(`DELETE FROM relationships`);
          db.exec(`DELETE FROM entities`);
          db.exec(`PRAGMA foreign_keys = ON`);
          console.log("Cleared existing entities and relationships");

          const allSheets = sheets.getAll();
          const pdfPaths = [...new Set(allSheets.map(s => s.pdf_path).filter(Boolean))];

          let totalEntities = 0;
          let totalCorrections = 0;

          for (const pdfPath of pdfPaths) {
            if (pdfPath) {
              console.log(`Re-extracting from: ${pdfPath}`);
              const results = await extractAll(pdfPath, true);
              totalEntities += results.reduce((sum, r) => sum + r.entities.length, 0);
              totalCorrections += results.reduce((sum, r) => sum + (r.corrections_applied ?? 0), 0);
            }
          }

          const linkResult = buildRelationships();

          console.log(`=== Retraining complete ===\n`);

          return Response.json({
            success: true,
            correction_rules: rules.length,
            entities_before: beforeCount.count,
            entities_after: totalEntities,
            corrections_applied: totalCorrections,
            false_positives_removed: beforeCount.count - totalEntities,
            relationships_created: linkResult.created,
          });
        } catch (error) {
          console.error("Retrain failed:", error);
          return Response.json({ error: "Retrain failed", details: String(error) }, { status: 500 });
        }
      },
    },

    "/api/metrics": () => {
      const db = getDb();

      const trainingData = db.query(`
        SELECT original_label, corrected_label, COUNT(*) as count
        FROM training_data
        GROUP BY original_label, corrected_label
      `).all() as { original_label: string; corrected_label: string; count: number }[];

      const totalReviewed = trainingData.reduce((sum, row) => sum + row.count, 0);
      const correct = trainingData
        .filter(row => row.original_label === row.corrected_label)
        .reduce((sum, row) => sum + row.count, 0);
      const falsePositives = trainingData
        .filter(row => row.corrected_label === "not_a_callout")
        .reduce((sum, row) => sum + row.count, 0);
      const misclassified = trainingData
        .filter(row => row.original_label !== row.corrected_label && row.corrected_label !== "not_a_callout")
        .reduce((sum, row) => sum + row.count, 0);

      const accuracy = totalReviewed > 0 ? correct / totalReviewed : 0;
      const falsePositiveRate = totalReviewed > 0 ? falsePositives / totalReviewed : 0;

      const confusionMatrix: Record<string, Record<string, number>> = {};
      for (const row of trainingData) {
        if (!confusionMatrix[row.original_label]) {
          confusionMatrix[row.original_label] = {};
        }
        confusionMatrix[row.original_label]![row.corrected_label] = row.count;
      }

      const precisionByClass: Record<string, number> = {};
      const labels = [...new Set(trainingData.map(r => r.original_label))];
      for (const label of labels) {
        const predicted = trainingData.filter(r => r.original_label === label);
        const totalPredicted = predicted.reduce((sum, r) => sum + r.count, 0);
        const truePositive = predicted.find(r => r.corrected_label === label)?.count ?? 0;
        precisionByClass[label] = totalPredicted > 0 ? truePositive / totalPredicted : 0;
      }

      return Response.json({
        total_reviewed: totalReviewed,
        correct,
        false_positives: falsePositives,
        misclassified,
        accuracy: Math.round(accuracy * 100),
        false_positive_rate: Math.round(falsePositiveRate * 100),
        precision_by_class: Object.fromEntries(
          Object.entries(precisionByClass).map(([k, v]) => [k, Math.round(v * 100)])
        ),
        confusion_matrix: confusionMatrix,
        training_data: trainingData,
      });
    },

    "/images/:filename": async (req) => {
      const filename = req.params.filename;
      const imagePath = join(OUTPUT_DIR, filename);

      if (!existsSync(imagePath)) {
        return new Response("Image not found", { status: 404 });
      }

      const file = Bun.file(imagePath);
      return new Response(file, {
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "public, max-age=3600",
        },
      });
    },
  },

  fetch(req) {
    return Response.json({ error: "Not found" }, { status: 404 });
  },
});

console.log(`SiteLink Interpreter running at http://localhost:${PORT}`);
console.log(`\n  Explorer:    http://localhost:${PORT}/`);
console.log(`  HITL Review: http://localhost:${PORT}/review`);
console.log(`  Metrics API: http://localhost:${PORT}/api/metrics`);
