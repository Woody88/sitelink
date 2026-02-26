import { readFileSync } from "fs";
import { sheets, type Sheet } from "../db/index.ts";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const USE_VLM = !!OPENROUTER_API_KEY;

export interface SymbolDefinition {
  shape: string;
  pattern?: string;
  meaning: string;
  example?: string;
}

export interface Abbreviation {
  abbr: string;
  meaning: string;
}

export interface ProjectContext {
  project_name: string | null;
  standard: string;
  country: string;
  symbols: SymbolDefinition[];
  abbreviations: Abbreviation[];
  notes: string[];
  legend_sheet_id: string | null;
}

async function callOpenRouterVision(prompt: string, imageBase64: string): Promise<string | null> {
  if (!OPENROUTER_API_KEY) return null;

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://sitelink.dev",
        "X-Title": "SiteLink Drawing Interpreter",
      },
      body: JSON.stringify({
        model: "anthropic/claude-sonnet-4",
        messages: [{
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: `data:image/png;base64,${imageBase64}`,
              },
            },
            {
              type: "text",
              text: prompt,
            },
          ],
        }],
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      console.error(`OpenRouter error: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json() as {
      choices: Array<{ message: { content: string } }>;
    };

    return data.choices[0]?.message?.content ?? null;
  } catch (error) {
    console.error("OpenRouter call failed:", error);
    return null;
  }
}

function getDefaultContext(legendSheetId: string | null): ProjectContext {
  return {
    project_name: "Sample House",
    standard: "PSPC",
    country: "Canada",
    symbols: [
      { shape: "circle", meaning: "detail_callout", pattern: "(\\d+)", example: "4" },
      { shape: "circle_with_triangle_top", meaning: "elevation_callout", pattern: "([A-Z]|\\d+)", example: "2" },
      { shape: "circle_with_triangles_sides", meaning: "section_cut", pattern: "([A-Z])", example: "A" },
      { shape: "circle_with_line_below", meaning: "title_callout", pattern: "(\\d+|[A-Z])/([A-Z]\\d+)", example: "4/A7" },
    ],
    abbreviations: [
      { abbr: "VIF", meaning: "Verify In Field" },
      { abbr: "TYP", meaning: "Typical" },
      { abbr: "SIM", meaning: "Similar" },
      { abbr: "NTS", meaning: "Not To Scale" },
      { abbr: "EQ", meaning: "Equal" },
      { abbr: "CLR", meaning: "Clear" },
      { abbr: "CONC", meaning: "Concrete" },
      { abbr: "REINF", meaning: "Reinforcement" },
    ],
    notes: [
      "All dimensions are in millimeters unless noted otherwise",
      "All concrete to be 25 MPa minimum",
      "All reinforcing to CSA G30.18",
    ],
    legend_sheet_id: legendSheetId,
  };
}

async function detectLegendSheet(sheetsList: Sheet[]): Promise<Sheet | null> {
  for (const sheet of sheetsList) {
    if (sheet.sheet_number?.toLowerCase().includes("g") ||
        sheet.sheet_number?.toLowerCase().includes("legend")) {
      return sheet;
    }
  }

  if (USE_VLM) {
    for (const sheet of sheetsList) {
      if (sheet.image_path) {
        const imageBase64 = readFileSync(sheet.image_path).toString("base64");
        const response = await callOpenRouterVision(
          "Does this architectural/engineering drawing sheet contain a LEGEND section that defines symbols, abbreviations, or general notes for the drawing set? Answer only YES or NO.",
          imageBase64
        );

        if (response?.toUpperCase().includes("YES")) {
          return sheet;
        }
      }
    }
  }

  const a3 = sheetsList.find(s => s.sheet_number === "A3");
  if (a3) return a3;

  return null;
}

async function extractContextFromLegend(sheet: Sheet): Promise<ProjectContext> {
  if (!sheet.image_path) {
    throw new Error("Sheet has no image path");
  }

  if (!USE_VLM) {
    console.log("VLM not available (set OPENROUTER_API_KEY), using PSPC defaults");
    return getDefaultContext(sheet.id);
  }

  const imageBase64 = readFileSync(sheet.image_path).toString("base64");

  const prompt = `Analyze this architectural/engineering drawing sheet and extract the following information into a JSON object:

1. **project_name**: The project name from the title block (or null if not visible)

2. **symbols**: An array of symbol definitions found in the legend. For each symbol, include:
   - shape: The geometric shape (e.g., "circle", "circle_with_triangle", "hexagon", "diamond")
   - meaning: What the symbol represents (e.g., "detail_callout", "section_cut", "elevation_marker")
   - pattern: If the symbol contains text, the regex pattern (e.g., "(\\d+)/([A-Z]\\d+)" for "4/A7")
   - example: An example label if shown

3. **abbreviations**: An array of abbreviations and their meanings:
   - abbr: The abbreviation (e.g., "VIF", "TYP", "SIM")
   - meaning: The full meaning (e.g., "Verify In Field", "Typical", "Similar")

4. **notes**: An array of general notes found on the sheet (key construction notes, not symbol definitions)

5. **standard**: The drawing standard being used (e.g., "PSPC", "ACI", or "UNKNOWN")

6. **country**: The country (e.g., "Canada", "USA", or "UNKNOWN")

Return ONLY valid JSON, no markdown or explanation:
{
  "project_name": "...",
  "standard": "...",
  "country": "...",
  "symbols": [...],
  "abbreviations": [...],
  "notes": [...]
}`;

  const response = await callOpenRouterVision(prompt, imageBase64);

  if (!response) {
    console.log("VLM extraction failed, using defaults");
    return getDefaultContext(sheet.id);
  }

  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in response");
    }

    const parsed = JSON.parse(jsonMatch[0]) as Partial<ProjectContext>;

    return {
      project_name: parsed.project_name ?? null,
      standard: parsed.standard ?? "UNKNOWN",
      country: parsed.country ?? "UNKNOWN",
      symbols: parsed.symbols ?? [],
      abbreviations: parsed.abbreviations ?? [],
      notes: parsed.notes ?? [],
      legend_sheet_id: sheet.id,
    };
  } catch (error) {
    console.error("Failed to parse VLM response:", error);
    return getDefaultContext(sheet.id);
  }
}

export async function extractProjectContext(pdfPath?: string): Promise<ProjectContext> {
  const sheetsList = pdfPath ? sheets.getByPdf(pdfPath) : sheets.getAll();

  if (sheetsList.length === 0) {
    throw new Error("No sheets found in database. Run ingestion first.");
  }

  console.log(`Searching for legend sheet among ${sheetsList.length} sheets...`);

  const legendSheet = await detectLegendSheet(sheetsList);

  if (!legendSheet) {
    console.log("No legend sheet found, using defaults");
    return getDefaultContext(null);
  }

  console.log(`Found legend sheet: ${legendSheet.sheet_number} (page ${legendSheet.page_number})`);
  console.log("Extracting project context...");

  const context = await extractContextFromLegend(legendSheet);

  console.log("\nExtracted Project Context:");
  console.log(JSON.stringify(context, null, 2));

  return context;
}

if (import.meta.main) {
  const context = await extractProjectContext();
  console.log("\n--- Final Context ---");
  console.log(JSON.stringify(context, null, 2));
}
