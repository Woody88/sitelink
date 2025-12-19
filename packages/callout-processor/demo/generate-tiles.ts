/**
 * Generate DZI tiles from PDF using vips
 *
 * Usage: bun run demo/generate-tiles.ts
 */

import { $ } from "bun";
import { join, dirname } from "path";
import { existsSync, rmSync } from "fs";

const DEMO_DIR = dirname(import.meta.path);
const PROJECT_DIR = dirname(DEMO_DIR);
const PDF_PATH = join(PROJECT_DIR, "sample-single-plan.pdf");
const TILES_DIR = join(DEMO_DIR, "tiles");
const OUTPUT_NAME = "plan";

async function generateTiles() {
  console.log("🖼️  Generating DZI tiles from PDF...");
  console.log(`   Source: ${PDF_PATH}`);
  console.log(`   Output: ${TILES_DIR}/${OUTPUT_NAME}.dzi`);

  // Check if PDF exists
  if (!existsSync(PDF_PATH)) {
    console.error(`❌ PDF not found: ${PDF_PATH}`);
    process.exit(1);
  }

  // Clean existing tiles
  const dziPath = join(TILES_DIR, `${OUTPUT_NAME}.dzi`);
  const tilesPath = join(TILES_DIR, `${OUTPUT_NAME}_files`);

  if (existsSync(dziPath)) {
    rmSync(dziPath);
    console.log("   Removed existing .dzi file");
  }
  if (existsSync(tilesPath)) {
    rmSync(tilesPath, { recursive: true });
    console.log("   Removed existing tiles directory");
  }

  // Generate tiles using vips
  // [page=0] = first page, [dpi=150] = good quality for web
  // --tile-size=254 = standard for OpenSeadragon
  // --overlap=1 = minimal overlap between tiles
  // --suffix=.jpg[Q=85] = JPEG output with 85% quality
  const inputSpec = `${PDF_PATH}[page=0,dpi=150]`;
  const outputPath = join(TILES_DIR, OUTPUT_NAME);

  try {
    await $`vips dzsave ${inputSpec} ${outputPath} --tile-size=254 --overlap=1 --suffix=.jpg[Q=85]`;
    console.log("✅ Tiles generated successfully!");

    // Show output info
    if (existsSync(tilesPath)) {
      const levels = await $`ls ${tilesPath}`.text();
      console.log(`   Tile levels: ${levels.trim().split('\n').join(', ')}`);
    }
  } catch (error) {
    console.error("❌ Failed to generate tiles:", error);
    console.error("\nMake sure vips is installed:");
    console.error("  brew install vips");
    process.exit(1);
  }
}

generateTiles();
