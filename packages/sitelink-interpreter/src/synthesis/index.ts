import { sheets, entities, relationships, type Sheet, type Entity, type Relationship } from "../db/index.ts";

interface LinkResult {
  created: number;
  failed: number;
  details: { source: string; target: string | null; reason: string }[];
}

export function findTargetEntity(sourceEntity: Entity, allSheets: Sheet[], allEntities: Entity[]): Entity | null {
  if (!sourceEntity.target_sheet || !sourceEntity.identifier) {
    return null;
  }

  const targetSheet = allSheets.find(
    s => s.sheet_number?.toUpperCase() === sourceEntity.target_sheet?.toUpperCase()
  );

  if (!targetSheet) {
    return null;
  }

  const entitiesOnTargetSheet = allEntities.filter(e => e.sheet_id === targetSheet.id);

  const isTitleCallout = (e: Entity) =>
    e.class_label === "title_callout" && e.identifier === sourceEntity.identifier;

  const isMatchingDetail = (e: Entity) =>
    e.identifier === sourceEntity.identifier &&
    !e.target_sheet &&
    (e.class_label === "detail_callout" || e.class_label === "title_callout");

  let target = entitiesOnTargetSheet.find(isTitleCallout);
  if (!target) {
    target = entitiesOnTargetSheet.find(isMatchingDetail);
  }

  return target ?? null;
}

export function buildRelationships(): LinkResult {
  const result: LinkResult = {
    created: 0,
    failed: 0,
    details: [],
  };

  const allSheets = sheets.getAll();
  const allEntities: Entity[] = [];

  for (const sheet of allSheets) {
    const sheetEntities = entities.getBySheet(sheet.id);
    allEntities.push(...sheetEntities);
  }

  console.log(`Building relationships for ${allEntities.length} entities...`);

  const calloutsWithTargets = allEntities.filter(e => e.target_sheet && e.identifier);
  console.log(`Found ${calloutsWithTargets.length} callouts with target references\n`);

  for (const source of calloutsWithTargets) {
    const target = findTargetEntity(source, allSheets, allEntities);

    if (target) {
      const existingRels = relationships.getBySource(source.id);
      const alreadyLinked = existingRels.some(r => r.target_entity_id === target.id);

      if (!alreadyLinked) {
        relationships.insert({
          source_entity_id: source.id,
          target_entity_id: target.id,
          relationship_type: "REFERENCES",
          confidence: Math.min(source.confidence ?? 0.5, target.confidence ?? 0.5),
        });
        result.created++;
        result.details.push({
          source: `${source.ocr_text} on sheet ${getSheetNumber(source.sheet_id, allSheets)}`,
          target: `${target.ocr_text} on sheet ${getSheetNumber(target.sheet_id, allSheets)}`,
          reason: "linked",
        });
      }
    } else {
      result.failed++;
      result.details.push({
        source: `${source.ocr_text} on sheet ${getSheetNumber(source.sheet_id, allSheets)}`,
        target: null,
        reason: `Target not found: ${source.identifier} on ${source.target_sheet}`,
      });
    }
  }

  return result;
}

function getSheetNumber(sheetId: string, allSheets: Sheet[]): string {
  return allSheets.find(s => s.id === sheetId)?.sheet_number ?? "?";
}

export function getProvenanceChain(entityId: string): { entity: Entity; references: Entity[]; referencedBy: Entity[] } | null {
  const entity = entities.getById(entityId);
  if (!entity) return null;

  const outgoing = relationships.getBySource(entityId);
  const incoming = relationships.getByTarget(entityId);

  const references = outgoing
    .map(r => entities.getById(r.target_entity_id))
    .filter((e): e is Entity => e !== null);

  const referencedBy = incoming
    .map(r => entities.getById(r.source_entity_id))
    .filter((e): e is Entity => e !== null);

  return { entity, references, referencedBy };
}

if (import.meta.main) {
  console.log("--- Building Knowledge Graph Relationships ---\n");

  const result = buildRelationships();

  console.log("\n--- Summary ---");
  console.log(`Created: ${result.created} relationships`);
  console.log(`Failed to link: ${result.failed} callouts\n`);

  console.log("--- Successful Links ---");
  result.details
    .filter(d => d.reason === "linked")
    .slice(0, 10)
    .forEach(d => console.log(`  ${d.source} → ${d.target}`));

  if (result.failed > 0) {
    console.log("\n--- Failed Links ---");
    result.details
      .filter(d => d.reason !== "linked")
      .slice(0, 5)
      .forEach(d => console.log(`  ${d.source}: ${d.reason}`));
  }

  console.log("\n--- Sample Provenance Query ---");
  const allSheets = sheets.getAll();
  const sampleEntity = entities.getBySheet(allSheets[1]?.id ?? "")[0];
  if (sampleEntity) {
    const provenance = getProvenanceChain(sampleEntity.id);
    if (provenance) {
      console.log(`Entity: ${provenance.entity.ocr_text} (${provenance.entity.class_label})`);
      console.log(`  References: ${provenance.references.map(e => e.ocr_text).join(", ") || "none"}`);
      console.log(`  Referenced by: ${provenance.referencedBy.map(e => e.ocr_text).join(", ") || "none"}`);
    }
  }
}
