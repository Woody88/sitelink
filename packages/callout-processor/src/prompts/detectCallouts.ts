/**
 * Prompt builders for Vision LLM callout detection.
 *
 * These prompts are used for the LLM-only detection path.
 * The CV+LLM hybrid path uses batchValidation.ts prompts instead.
 */

/**
 * Build detection prompt for Vision LLM with comprehensive positive and negative examples.
 */
export function buildDetectionPrompt(
  imageWidth: number,
  imageHeight: number,
  existingSheets: string[] = [],
  totalSheetCount?: number
): string {
  const sheetInfo = existingSheets.length > 0
    ? `\n**VALID SHEET REGISTRY**: ${existingSheets.join(', ')}\nOnly report callouts targeting sheets in this list.`
    : '';

  return `You are analyzing a construction drawing sheet. Your task is to identify callout symbols that reference OTHER sheets.

## WHAT ARE CALLOUTS (report these):

### Style A: Section Flags (Circle + Triangle)
- A circle containing text with a solid/hollow triangular "flag" attached to the side
- The triangle points to a cutting plane on the drawing
- Format: "detail/sheet" inside the circle (e.g., "1/A6", "2/A6")
- **CRITICAL**: The triangle and circle together form ONE callout

### Style B: Circular Detail Markers
- A circle, often with a horizontal line dividing it
- Upper half: detail number, Lower half: sheet reference
- Format: "2/A5" means "Detail 2 on Sheet A5"

### Style C: Triangular Revision/Detail Markers
- A standalone triangle (delta symbol) containing a reference
- Format: "1/A5" or just a revision number

### Style D: Borderless Text References
- Plain text in format "X/YY" or "XX/YY" without surrounding geometry
- Must clearly be a cross-reference, not a dimension or note

## WHAT ARE NOT CALLOUTS (do NOT report these):

### Scale Indicators (CRITICAL - most common false positive!)
- **Any text with equals sign**: "1/4" = 1'-0"", "1/2" = 1'-0""
- **Scale notations**: "SCALE: 1/4" = 1'-0"", "1:50", "NTS"
- **The fraction BEFORE an equals sign is a scale ratio, NOT a callout**
- Examples to REJECT: "1/4"", "1/2"", "3/8"", "1" = 10'"

### Dimension Text
- Measurements with units: "12'-6"", "4 1/2"", "2'-0""
- Radius/diameter: "R=36"", "Ø24""
- Angles: "45°", "90°"

### Grid Bubbles (Column/Row Markers)
- Single letters in circles: "A", "B", "C", "D"
- Single numbers in circles: "1", "2", "3", "4"
- These mark grid lines, NOT detail references

### North Arrows and Symbols
- Directional indicators with "N" or arrow symbols
- Compass roses or orientation markers

### Room Labels and Tags
- Text labels like "OFFICE", "LOBBY", "STAIR 1"
- Equipment tags: "AHU-1", "P-1"
- Door/window tags that aren't cross-references

### Title Block Information
- Sheet numbers in title blocks (these are the CURRENT sheet, not references)
- Drawing titles, dates, revision info
- Company logos and stamps

### Match Lines and Viewport Labels
- "MATCH LINE - SEE SHEET A3" (this is a note, not a callout symbol)
- Viewport labels around the drawing border

${sheetInfo}

## OUTPUT FORMAT

The image dimensions are ${imageWidth} x ${imageHeight} pixels.
Report the CENTER position of each callout symbol in pixels.

Return your response as JSON only (no markdown):
{
  "sheetNumber": "A2",
  "sheetTitle": "FOUNDATION PLAN",
  "imageWidth": ${imageWidth},
  "imageHeight": ${imageHeight},
  "callouts": [
    {
      "ref": "1/A6",
      "targetSheet": "A6",
      "type": "section",
      "x": 1200,
      "y": 800,
      "confidence": 0.95
    }
  ]
}`;
}

/**
 * Build retry prompt for failed/unclear results with specific correction guidance.
 */
export function buildRetryPrompt(
  imageWidth: number,
  imageHeight: number,
  previousAttempt: string,
  issue: string,
  totalSheetCount?: number
): string {
  return `Your previous analysis had an issue: **${issue}**

Previous response:
${previousAttempt}

## CORRECTION GUIDELINES

Please re-analyze the image with these specific corrections:

1. **If issue mentions "scale indicators"**: Look more carefully for equals signs ("=") after fractions. "1/4" = 1'-0"" is a SCALE, not a callout.

2. **If issue mentions "missing callouts"**: Scan the entire image systematically:
   - Check all four corners
   - Look along cutting plane lines
   - Check near section markers and elevation indicators

3. **If issue mentions "invalid format"**: Ensure all refs follow "detail/sheet" format (e.g., "1/A6" not just "A6").

4. **If issue mentions "coordinates"**: Verify x,y positions are within image bounds (0 to ${imageWidth}, 0 to ${imageHeight}).

## REMINDER: What to look for
- Section Flags: Circle with triangle attached (e.g., "1/A6")
- Detail Circles: Circle with horizontal divider (e.g., "2/A5")
- Triangles: Delta shapes with references
- Borderless Text: Plain "X/YY" references

Return corrected JSON only (no markdown).`;
}

/**
 * Build focused retry prompt to find callouts for specific target sheets.
 */
export function buildFocusedRetryPrompt(
  imageWidth: number,
  imageHeight: number,
  targetSheets: string[],
  alreadyFoundCallouts: { ref: string; x: number; y: number }[],
  existingSheets: string[] = []
): string {
  const foundSummary = alreadyFoundCallouts.length > 0
    ? `\n## ALREADY FOUND (do not duplicate)\n${alreadyFoundCallouts.map(c => `- ${c.ref} at (${c.x}, ${c.y})`).join('\n')}`
    : '';

  return `Perform a FOCUSED SEARCH for callouts referencing these specific target sheets:
**${targetSheets.join(', ')}**

${foundSummary}

## SEARCH STRATEGY

1. **Scan cutting plane lines**: Section callouts often appear at the ends of dashed cutting lines.

2. **Check elevation markers**: Look for callouts near elevation/section indicators.

3. **Examine detail bubbles**: Small circles with horizontal dividers near details.

4. **Look for triangular flags**: Section flags have triangles pointing to cut lines.

5. **Search borderless text**: Plain "X/${targetSheets[0]}" style references.

## AREAS TO CHECK
- Drawing edges and margins
- Near stairs, elevators, and complex assemblies
- Around wall sections and typical details
- At intersection points of major elements

Image dimensions: ${imageWidth} x ${imageHeight} pixels.
Report CENTER positions in pixels.

Return JSON only with any NEW callouts found (excluding already-found ones).`;
}

/**
 * Build a prompt specifically looking for duplicate/additional instances of known callouts.
 */
export function buildDuplicateSearchPrompt(
  imageWidth: number,
  imageHeight: number,
  targetCallouts: string[],
  alreadyFoundCallouts: { ref: string; x: number; y: number }[],
  existingSheets: string[] = []
): string {
  const foundByRef = new Map<string, { x: number; y: number }[]>();
  for (const c of alreadyFoundCallouts) {
    if (!foundByRef.has(c.ref)) foundByRef.set(c.ref, []);
    foundByRef.get(c.ref)!.push({ x: c.x, y: c.y });
  }

  const foundSummary = Array.from(foundByRef.entries())
    .map(([ref, positions]) => `- ${ref}: ${positions.length} instance(s) at ${positions.map(p => `(${p.x}, ${p.y})`).join(', ')}`)
    .join('\n');

  return `Search for ADDITIONAL INSTANCES of these callouts: **${targetCallouts.join(', ')}**

## WHY DUPLICATES EXIST
Construction drawings often have multiple instances of the same callout when:
- A detail applies to multiple locations (e.g., typical wall section)
- Section cuts pass through multiple areas
- The same detail is referenced from different views

## ALREADY FOUND
${foundSummary || 'None yet'}

## SEARCH STRATEGY

1. **Check opposite sides**: If a section callout is on the left, check if there's a matching one on the right.

2. **Scan symmetrical locations**: Typical details often appear at symmetric points.

3. **Look at different scales**: Same callout may appear on enlarged details.

4. **Check near similar elements**: If "2/A5" is at one column, check other columns.

## DISTANCE RULE
New instances must be at least 200 pixels away from known instances to count as separate.

Image dimensions: ${imageWidth} x ${imageHeight} pixels.
Report CENTER positions in pixels.

Return JSON with ONLY new instances (different locations from already-found).`;
}
