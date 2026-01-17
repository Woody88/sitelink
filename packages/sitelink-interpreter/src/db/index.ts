import { Database } from "bun:sqlite";
import { nanoid } from "nanoid";
import { readFileSync } from "fs";
import { join } from "path";

const DB_PATH = join(import.meta.dir, "../../db/sitelink.db");
const SCHEMA_PATH = join(import.meta.dir, "../../db/schema.sql");

let db: Database | null = null;

export function getDb(): Database {
  if (!db) {
    db = new Database(DB_PATH, { create: true });
    db.exec("PRAGMA journal_mode = WAL");
    db.exec("PRAGMA foreign_keys = ON");

    const schema = readFileSync(SCHEMA_PATH, "utf-8");
    db.exec(schema);
  }
  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

export interface Sheet {
  id: string;
  pdf_path: string;
  page_number: number;
  sheet_number: string | null;
  sheet_type: string | null;
  sheet_title: string | null;
  image_path: string | null;
  width: number | null;
  height: number | null;
  dpi: number;
  created_at: string;
}

export interface Entity {
  id: string;
  sheet_id: string;
  class_label: string;
  ocr_text: string | null;
  confidence: number | null;
  bbox_x1: number;
  bbox_y1: number;
  bbox_x2: number;
  bbox_y2: number;
  identifier: string | null;
  target_sheet: string | null;
  triangle_count: number | null;
  triangle_positions: string | null;
  needs_review: number;
  reviewed: number;
  reviewed_by: string | null;
  corrected_label: string | null;
  created_at: string;
}

export interface Relationship {
  id: string;
  source_entity_id: string;
  target_entity_id: string;
  relationship_type: string;
  confidence: number | null;
  created_at: string;
}

export const sheets = {
  insert(data: Omit<Sheet, "id" | "created_at">): Sheet {
    const db = getDb();
    const id = nanoid();
    db.run(
      `INSERT INTO sheets (id, pdf_path, page_number, sheet_number, sheet_type, sheet_title, image_path, width, height, dpi)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.pdf_path, data.page_number, data.sheet_number, data.sheet_type, data.sheet_title, data.image_path, data.width, data.height, data.dpi]
    );
    return db.query<Sheet, [string]>("SELECT * FROM sheets WHERE id = ?").get(id)!;
  },

  getById(id: string): Sheet | null {
    return getDb().query<Sheet, [string]>("SELECT * FROM sheets WHERE id = ?").get(id);
  },

  getAll(): Sheet[] {
    return getDb().query<Sheet, []>("SELECT * FROM sheets ORDER BY page_number").all();
  },

  getByPdf(pdfPath: string): Sheet[] {
    return getDb().query<Sheet, [string]>("SELECT * FROM sheets WHERE pdf_path = ? ORDER BY page_number").all(pdfPath);
  },

  getBySheetNumber(sheetNumber: string): Sheet | null {
    return getDb().query<Sheet, [string]>("SELECT * FROM sheets WHERE sheet_number = ?").get(sheetNumber);
  },

  update(id: string, data: Partial<Sheet>): void {
    const db = getDb();
    const fields = Object.keys(data).filter(k => k !== "id" && k !== "created_at");
    const values = fields.map(k => data[k as keyof Sheet] ?? null);
    const setClause = fields.map(f => `${f} = ?`).join(", ");
    db.run(`UPDATE sheets SET ${setClause} WHERE id = ?`, [...values, id]);
  },
};

export const entities = {
  insert(data: Omit<Entity, "id" | "created_at">): Entity {
    const db = getDb();
    const id = nanoid();
    db.run(
      `INSERT INTO entities (id, sheet_id, class_label, ocr_text, confidence, bbox_x1, bbox_y1, bbox_x2, bbox_y2,
        identifier, target_sheet, triangle_count, triangle_positions, needs_review, reviewed, reviewed_by, corrected_label)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.sheet_id, data.class_label, data.ocr_text, data.confidence,
       data.bbox_x1, data.bbox_y1, data.bbox_x2, data.bbox_y2,
       data.identifier, data.target_sheet, data.triangle_count, data.triangle_positions,
       data.needs_review, data.reviewed, data.reviewed_by, data.corrected_label]
    );
    return db.query<Entity, [string]>("SELECT * FROM entities WHERE id = ?").get(id)!;
  },

  getById(id: string): Entity | null {
    return getDb().query<Entity, [string]>("SELECT * FROM entities WHERE id = ?").get(id);
  },

  getBySheet(sheetId: string): Entity[] {
    return getDb().query<Entity, [string]>("SELECT * FROM entities WHERE sheet_id = ?").all(sheetId);
  },

  getNeedingReview(): Entity[] {
    return getDb().query<Entity, []>("SELECT * FROM entities WHERE needs_review = 1 AND reviewed = 0").all();
  },

  update(id: string, data: Partial<Entity>): void {
    const db = getDb();
    const fields = Object.keys(data).filter(k => k !== "id" && k !== "created_at");
    const values = fields.map(k => data[k as keyof Entity] ?? null);
    const setClause = fields.map(f => `${f} = ?`).join(", ");
    db.run(`UPDATE entities SET ${setClause} WHERE id = ?`, [...values, id]);
  },
};

export const relationships = {
  insert(data: Omit<Relationship, "id" | "created_at">): Relationship {
    const db = getDb();
    const id = nanoid();
    db.run(
      `INSERT INTO relationships (id, source_entity_id, target_entity_id, relationship_type, confidence)
       VALUES (?, ?, ?, ?, ?)`,
      [id, data.source_entity_id, data.target_entity_id, data.relationship_type, data.confidence]
    );
    return db.query<Relationship, [string]>("SELECT * FROM relationships WHERE id = ?").get(id)!;
  },

  getBySource(entityId: string): Relationship[] {
    return getDb().query<Relationship, [string]>("SELECT * FROM relationships WHERE source_entity_id = ?").all(entityId);
  },

  getByTarget(entityId: string): Relationship[] {
    return getDb().query<Relationship, [string]>("SELECT * FROM relationships WHERE target_entity_id = ?").all(entityId);
  },
};

export { nanoid };
