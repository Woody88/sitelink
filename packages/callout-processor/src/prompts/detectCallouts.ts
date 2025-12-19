/**
 * Build detection prompt for Vision LLM
 */

export function buildDetectionPrompt(
  imageWidth: number,
  imageHeight: number,
  existingSheets: string[] = [],
  totalSheetCount?: number
): string {
  return `You are analyzing a construction drawing sheet. Your task is to identify:

1. **SHEET NUMBER**: Located in the title block (usually bottom-right corner).
   - Common formats: "A1", "A2.01", "S-101", "M1.1", "E2"
   - Look for text labeled "SHEET NUMBER" or "SHEET NO." or "DWG NO."

2. **SHEET TITLE**: The name/description of this sheet.
   - Usually near the sheet number in the title block
   - Examples: "FOUNDATION PLAN", "FIRST FLOOR FRAMING", "ELEVATIONS"

3. **ALL CALLOUT SYMBOLS** that reference other sheets:

   **CIRCULAR Markers** (Detail/Section Callouts):
   - Circle with an arrow pointing in a direction
   - Contains a number on top (detail number) and sheet reference below
   - Format: "2/A5" means "Detail 2 on Sheet A5"
   - The arrow indicates viewing direction
   - Often have a leader line pointing to an area
   - Examples: "1/A6", "2/A7", "3/A5"
   
   **TRIANGULAR Markers** (Revision Indicators):
   - Triangle shape (delta symbol Δ = change)
   - Shows: Revision Number / Sheet
   - Format: [number] / [sheet] (e.g., "3/A5" means "Revision 3 on Sheet A5")
   - Examples: "1/A5", "2/A5", "3/A5", "1/A6", "2/A6", "3/A7"
   - Text orientation follows diagonal slash line
   - Usually solid black or filled
   - Can be smaller than circular markers
   - **CRITICAL**: Look carefully for triangular shapes - they are often smaller and may be less obvious than circles
   
   **Other Callout Types**:
   - Elevation Markers: Circles with directional arrows
   - Building Section Markers: Circles with cutting plane lines
   - Reference format like "A/A3.01"

The image dimensions are ${imageWidth} x ${imageHeight} pixels.

**IMPORTANT INSTRUCTIONS:**
- Report the CENTER position of each callout symbol in pixels
- **CRITICAL: Report ALL instances of each callout, even if the text is identical**
  - If "1/A6" appears 2 times in different positions, report BOTH with their respective coordinates
  - If "2/A5" appears 3 times, report ALL 3 instances
  - Do NOT deduplicate - each position is a separate callout that must be reported
- **MUST include BOTH circular AND triangular markers** - do not skip triangular ones
- Only report callouts that reference OTHER sheets (ignore dimension callouts, keynotes, etc.)
- The sheet numbers in the title block should NOT be included as callouts
- Triangular markers may be smaller or less obvious - examine the image carefully
- Scan the entire image systematically - the same callout can appear in multiple locations
${existingSheets.length > 0 ? `\n\n**VALID SHEET REGISTRY**:
The following sheets exist in this plan set: ${existingSheets.join(', ')}

**SYSTEMATIC SEARCH INSTRUCTIONS**:
You MUST systematically search for callouts referencing EACH of these target sheets:
${existingSheets.map(sheet => `- Look for ALL callouts targeting "${sheet}" (e.g., "1/${sheet}", "2/${sheet}", "3/${sheet}", etc.)`).join('\n')}

**SEARCH STRATEGY**:
1. Scan the ENTIRE image from left to right, top to bottom
2. For EACH valid target sheet (${existingSheets.join(', ')}), look for:
   - Circular markers containing "X/[sheet]" where X is a detail number (1, 2, 3, etc.)
   - Triangular markers containing "X/[sheet]"
3. Each target sheet may have MULTIPLE callouts pointing to it - find ALL of them
4. The SAME callout (e.g., "1/A6") may appear in MULTIPLE positions - report EACH position

**VALIDATION RULES**:
- Only report callouts where the TARGET SHEET (after "/") is one of: ${existingSheets.join(', ')}
- REJECT callouts to sheets not in the registry (e.g., "1/A99" is invalid)
- ACCEPT multiple instances of the same callout text at different positions

**COMPLETENESS CHECK**:
Before returning, verify you have searched for callouts to EACH target sheet: ${existingSheets.join(', ')}
Ask yourself: "Did I find ALL callouts to A5? All to A6? All to A7?" etc.` : ''}
${totalSheetCount !== undefined ? `\n\n**CRITICAL CONTEXT - SHEET COUNT CONSTRAINT**:
This plan set contains exactly ${totalSheetCount} unique SHEET NUMBERS (e.g., A1, A2, A3, A4, A5, A6, A7 for a 7-sheet plan).

**IMPORTANT DISTINCTION**:
- The ${totalSheetCount} unique sheets constraint applies to the TARGET SHEET REFERENCES (the part after "/" in callouts like "1/A5" → target is "A5")
- The same CALLOUT TEXT (e.g., "1/A6" or "2/A5") can appear MULTIPLE TIMES in different positions on the same sheet
- You MUST report ALL instances of each callout, even if they have identical text - each position is unique and important

**VALIDATION RULES**:
- Only report callouts where the TARGET SHEET (after "/") is within the valid ${totalSheetCount} sheets (e.g., A1-A${totalSheetCount})
- If you see "1/A99" or "2/A50" in a 7-sheet plan, it's likely a false positive - reject it
- But if you see "1/A6" appearing 3 times in different positions, report ALL 3 instances
- The callout text itself (like "1/A6") can repeat - that's normal and expected

**EXAMPLE**: In a 7-sheet plan:
- ✅ Valid: "1/A5", "2/A6", "3/A7" (targets A5, A6, A7 are within A1-A7)
- ✅ Valid: "1/A6" appearing twice (report both positions)
- ❌ Invalid: "1/A99" (target A99 doesn't exist in a 7-sheet plan)
- ❌ Invalid: "1/A50" (target A50 doesn't exist in a 7-sheet plan)` : ''}

Return your response as JSON only, with no additional text:

{
  "sheetNumber": "A2",
  "sheetTitle": "FOUNDATION PLAN",
  "imageWidth": ${imageWidth},
  "imageHeight": ${imageHeight},
  "callouts": [
    {
      "ref": "A6",
      "targetSheet": "A6",
      "type": "section",
      "x": 4100,
      "y": 750,
      "confidence": 0.85
    },
    {
      "ref": "2/A5",
      "targetSheet": "A5", 
      "type": "detail",
      "x": 3700,
      "y": 1100,
      "confidence": 0.90
    },
    {
      "ref": "3/A5",
      "targetSheet": "A5",
      "type": "revision",
      "x": 2500,
      "y": 1500,
      "confidence": 0.75
    },
    {
      "ref": "1/A6",
      "targetSheet": "A6",
      "type": "detail",
      "x": 1200,
      "y": 800,
      "confidence": 0.88
    },
    {
      "ref": "1/A6",
      "targetSheet": "A6",
      "type": "detail",
      "x": 2400,
      "y": 900,
      "confidence": 0.88
    }
  ]
}

**IMPORTANT**: For each callout, include a "confidence" score (0.0 to 1.0) indicating how certain you are:
- 0.9-1.0: Very clear, unambiguous callout
- 0.7-0.9: Clear callout, minor uncertainty
- 0.5-0.7: Visible but may have some ambiguity
- 0.3-0.5: Unclear or partially obscured
- 0.0-0.3: Very uncertain, likely false positive

If no callouts are found, return an empty array for "callouts".
If you cannot determine the sheet number, use "UNKNOWN".`;
}

/**
 * Build retry prompt for failed/unclear results
 */
export function buildRetryPrompt(
  imageWidth: number,
  imageHeight: number,
  previousAttempt: string,
  issue: string,
  totalSheetCount?: number
): string {
  return `Your previous analysis had an issue: ${issue}

Previous response:
${previousAttempt}

Please re-analyze the construction drawing more carefully.

Remember:
- Sheet number is in the title block (bottom-right corner)
- Callout symbols include BOTH circular and triangular shapes
- Circular callouts: circles with sheet references like "A6" or "2/A5"
- Triangular callouts: triangles with revision/sheet references like "3/A5" or "1/A6"
- Report pixel coordinates for the CENTER of each callout
- Image size is ${imageWidth} x ${imageHeight} pixels
- Look carefully for triangular markers - they may be smaller and less obvious
- **CRITICAL: Report ALL instances of each callout, even if the text is identical**
  - If "1/A6" appears 2 times, report BOTH with their different coordinates
  - Do NOT deduplicate - each position is a separate callout
${totalSheetCount !== undefined ? `\n- This plan set has exactly ${totalSheetCount} unique SHEET NUMBERS (A1-A${totalSheetCount})
- The constraint applies to TARGET SHEET REFERENCES (the part after "/"), not to callout instances
- The same callout text (like "1/A6") can appear multiple times - report ALL instances
- Only reject callouts where the target sheet is outside the valid range (e.g., A99 in a 7-sheet plan)` : ''}

Return corrected JSON only.`;
}

/**
 * Build focused retry prompt to find missing callouts
 * This is used when first pass didn't find all expected callouts
 */
export function buildFocusedRetryPrompt(
  imageWidth: number,
  imageHeight: number,
  targetSheets: string[],
  alreadyFoundCallouts: { ref: string; x: number; y: number }[],
  existingSheets: string[] = []
): string {
  const foundSummary = alreadyFoundCallouts.length > 0
    ? `Already found these callouts (DO NOT report these again):\n${alreadyFoundCallouts.map(c => `- "${c.ref}" at position (${c.x}, ${c.y})`).join('\n')}`
    : 'No callouts found yet.';

  return `You are performing a FOCUSED SEARCH for callouts that may have been missed.

The image dimensions are ${imageWidth} x ${imageHeight} pixels.

**MISSION**: Find callouts referencing these target sheets: ${targetSheets.join(', ')}

${foundSummary}

**CRITICAL INSTRUCTIONS**:
1. Search the ENTIRE drawing systematically - left to right, top to bottom
2. Look for BOTH circular and triangular callout markers
3. Focus specifically on finding callouts to: ${targetSheets.join(', ')}
4. Common patterns to look for:
   - "1/${targetSheets[0]}", "2/${targetSheets[0]}", "3/${targetSheets[0]}"
   - Similar patterns for each target sheet
5. Triangular markers may be SMALLER and less obvious than circles - look carefully
6. Check areas you might have missed: corners, edges, densely detailed areas

**CALLOUT MARKER SHAPES**:
- CIRCULAR: Circle with arrow, contains "number/sheet" format (e.g., "1/A5")
- TRIANGULAR: Triangle shape, contains "number/sheet" format (e.g., "3/A7")

**SEARCH AREAS** (scan each carefully):
- Top edge of drawing
- Bottom edge of drawing  
- Left edge of drawing
- Right edge of drawing
- Around detailed areas with dense information
- Near structural elements

${existingSheets.length > 0 ? `**VALID SHEETS**: Only report callouts targeting: ${existingSheets.join(', ')}` : ''}

**RESPONSE FORMAT**:
Return ONLY the NEW callouts found (not the ones already reported).
Return as JSON:

{
  "callouts": [
    {
      "ref": "3/A7",
      "targetSheet": "A7",
      "type": "detail",
      "x": 1500,
      "y": 600
    }
  ]
}

If no additional callouts are found, return: {"callouts": []}`;
}

/**
 * Build a prompt specifically looking for duplicate callouts
 * This targets callouts with detail numbers that may appear multiple times
 */
export function buildDuplicateSearchPrompt(
  imageWidth: number,
  imageHeight: number,
  targetCallouts: string[],
  alreadyFoundCallouts: { ref: string; x: number; y: number }[],
  existingSheets: string[] = []
): string {
  const foundSummary = alreadyFoundCallouts.length > 0
    ? `Already found these callouts at these positions (find ADDITIONAL instances at DIFFERENT positions):\n${alreadyFoundCallouts.map(c => `- "${c.ref}" at (${c.x}, ${c.y})`).join('\n')}`
    : 'No callouts found yet.';

  return `You are searching for ADDITIONAL INSTANCES of specific callouts.

The image dimensions are ${imageWidth} x ${imageHeight} pixels.

**MISSION**: Find additional instances of these callouts: ${targetCallouts.join(', ')}

${foundSummary}

**IMPORTANT**: The same callout text (like "2/A6") can appear MULTIPLE TIMES in DIFFERENT positions on the same drawing. You need to find instances that are NOT at the positions listed above.

**SEARCH STRATEGY**:
1. For each target callout (${targetCallouts.join(', ')}), scan the ENTIRE image
2. Look for the EXACT same callout text appearing in a DIFFERENT location
3. Check all areas: top, bottom, left, right, center of the drawing
4. Both circular and triangular markers can contain duplicates

**CALLOUT FORMATS**:
- Detail callouts: "2/A6" means Detail 2 on Sheet A6
- The same detail may be referenced from multiple locations

${existingSheets.length > 0 ? `**VALID SHEETS**: Only report callouts targeting: ${existingSheets.join(', ')}` : ''}

**RESPONSE FORMAT**:
Return ONLY NEW instances at DIFFERENT positions (at least 200 pixels away from known positions).
Return as JSON:

{
  "callouts": [
    {
      "ref": "2/A6",
      "targetSheet": "A6",
      "type": "detail",
      "x": 800,
      "y": 1200
    }
  ]
}

If no additional instances are found, return: {"callouts": []}`;
}

