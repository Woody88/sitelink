import { sheets, entities, relationships, getDb, nanoid, type Sheet, type Entity } from "../db/index.ts";
import { getProvenanceChain } from "../synthesis/index.ts";
import reviewHtml from "../ui/review.html";
import { join, basename } from "path";
import { existsSync } from "fs";

const PORT = 3456;
const OUTPUT_DIR = join(import.meta.dir, "../../output/sheets");

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
    "/": reviewHtml,

    "/api": () => {
      return Response.json({
        name: "SiteLink Interpreter API",
        version: "1.0.0",
      });
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
console.log(`\nHITL Review UI: http://localhost:${PORT}/`);
