import { $ } from "bun";
import { existsSync, mkdirSync } from "fs";
import { join, basename, dirname } from "path";
import { sheets, getDb, closeDb, type Sheet } from "../db/index.ts";

const OUTPUT_DIR = join(import.meta.dir, "../../output/sheets");
const DPI = 150;

interface IngestionResult {
  pdfPath: string;
  pageCount: number;
  sheets: Sheet[];
  errors: string[];
}

async function getPdfPageCount(pdfPath: string): Promise<number> {
  const result = await $`pdfinfo ${pdfPath} | grep "Pages:" | awk '{print $2}'`.text();
  return parseInt(result.trim(), 10);
}

async function convertPdfToImages(pdfPath: string, outputDir: string): Promise<string[]> {
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  const pdfBasename = basename(pdfPath, ".pdf");
  const outputPrefix = join(outputDir, pdfBasename);

  await $`pdftoppm -png -r ${DPI} ${pdfPath} ${outputPrefix}`;

  const images: string[] = [];
  const pageCount = await getPdfPageCount(pdfPath);

  for (let i = 1; i <= pageCount; i++) {
    const paddedNum = i.toString().padStart(pageCount.toString().length, "0");
    const imagePath = `${outputPrefix}-${paddedNum}.png`;

    if (existsSync(imagePath)) {
      images.push(imagePath);
    } else {
      const altPath = `${outputPrefix}-${i}.png`;
      if (existsSync(altPath)) {
        images.push(altPath);
      }
    }
  }

  return images;
}

async function getImageDimensions(imagePath: string): Promise<{ width: number; height: number }> {
  const result = await $`file ${imagePath}`.text();
  const match = result.match(/(\d+)\s*x\s*(\d+)/);
  if (match) {
    return { width: parseInt(match[1]!, 10), height: parseInt(match[2]!, 10) };
  }
  return { width: 0, height: 0 };
}

const SHEET_NUMBER_EXTRACTOR = join(import.meta.dir, "extract_sheet_number.py");
const SHEET_INFO_GEMINI_EXTRACTOR = join(import.meta.dir, "extract_sheet_info_gemini.py");

interface SheetInfo {
  sheet_number: string;
  sheet_title: string | null;
}

interface GeminiResult {
  sheet_number: string | null;
  sheet_title: string | null;
  error?: string;
}

async function extractSheetInfoBatch(imagePaths: string[]): Promise<SheetInfo[]> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const results: SheetInfo[] = [];

  if (apiKey && imagePaths.length > 0) {
    try {
      console.log(`  Extracting sheet info with Gemini (${imagePaths.length} pages, batched)...`);
      const args = [...imagePaths, '--openrouter-key', apiKey];
      const output = await $`python ${SHEET_INFO_GEMINI_EXTRACTOR} ${args}`.quiet().text();
      const parsed = JSON.parse(output) as GeminiResult[];

      for (let i = 0; i < imagePaths.length; i++) {
        const pageNumber = i + 1;
        const geminiResult = parsed[i];

        if (geminiResult && (geminiResult.sheet_number || geminiResult.sheet_title)) {
          results.push({
            sheet_number: geminiResult.sheet_number ?? `Sheet-${pageNumber}`,
            sheet_title: geminiResult.sheet_title ?? null,
          });
        } else {
          results.push(await fallbackToOCR(pageNumber, imagePaths[i]!));
        }
      }

      const successCount = parsed.filter(r => r.sheet_number || r.sheet_title).length;
      console.log(`  Gemini extracted ${successCount}/${imagePaths.length} sheets`);
      return results;
    } catch (error) {
      console.warn(`  Gemini batch extraction failed: ${error}`);
    }
  }

  console.log(`  Falling back to OCR extraction...`);
  for (let i = 0; i < imagePaths.length; i++) {
    results.push(await fallbackToOCR(i + 1, imagePaths[i]!));
  }
  return results;
}

async function fallbackToOCR(pageNumber: number, imagePath: string): Promise<SheetInfo> {
  try {
    const result = await $`python ${SHEET_NUMBER_EXTRACTOR} ${imagePath}`.quiet().text();
    const parsed = JSON.parse(result);
    if (parsed.sheet_number) {
      return {
        sheet_number: parsed.sheet_number,
        sheet_title: null,
      };
    }
  } catch (error) {
    // Silent fallback
  }
  return {
    sheet_number: `Sheet-${pageNumber}`,
    sheet_title: null,
  };
}

export async function ingestPdf(pdfPath: string): Promise<IngestionResult> {
  const result: IngestionResult = {
    pdfPath,
    pageCount: 0,
    sheets: [],
    errors: [],
  };

  if (!existsSync(pdfPath)) {
    result.errors.push(`PDF file not found: ${pdfPath}`);
    return result;
  }

  try {
    console.log(`Ingesting PDF: ${pdfPath}`);

    result.pageCount = await getPdfPageCount(pdfPath);
    console.log(`Found ${result.pageCount} pages`);

    const images = await convertPdfToImages(pdfPath, OUTPUT_DIR);
    console.log(`Converted to ${images.length} PNG images`);

    const sheetInfos = await extractSheetInfoBatch(images);

    for (let i = 0; i < images.length; i++) {
      const imagePath = images[i]!;
      const pageNumber = i + 1;
      const sheetInfo = sheetInfos[i]!;

      const dimensions = await getImageDimensions(imagePath);

      const sheet = sheets.insert({
        pdf_path: pdfPath,
        page_number: pageNumber,
        sheet_number: sheetInfo.sheet_number,
        sheet_type: null,
        sheet_title: sheetInfo.sheet_title,
        image_path: imagePath,
        width: dimensions.width,
        height: dimensions.height,
        dpi: DPI,
      });

      result.sheets.push(sheet);
      const titleSuffix = sheetInfo.sheet_title ? ` - ${sheetInfo.sheet_title}` : '';
      console.log(`  Sheet ${pageNumber}: ${sheetInfo.sheet_number}${titleSuffix} (${dimensions.width}x${dimensions.height})`);
    }

    console.log(`\nIngestion complete: ${result.sheets.length} sheets processed`);
  } catch (error) {
    result.errors.push(`Error during ingestion: ${error}`);
  }

  return result;
}

if (import.meta.main) {
  const pdfPath = process.argv[2];

  if (!pdfPath) {
    console.error("Usage: bun run src/ingestion/index.ts <pdf-path>");
    process.exit(1);
  }

  const absolutePath = pdfPath.startsWith("/") ? pdfPath : join(process.cwd(), pdfPath);

  const result = await ingestPdf(absolutePath);

  if (result.errors.length > 0) {
    console.error("\nErrors:");
    result.errors.forEach(e => console.error(`  - ${e}`));
    process.exit(1);
  }

  console.log("\nSheets in database:");
  const allSheets = sheets.getAll();
  allSheets.forEach(s => {
    console.log(`  ${s.id}: page ${s.page_number}, ${s.sheet_number ?? "?"}, ${s.width}x${s.height}`);
  });

  closeDb();
}
