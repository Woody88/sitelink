/**
 * Build prompt for detecting title block information (sheet number, title, notes)
 */

export function buildTitleBlockPrompt(
  imageWidth: number,
  imageHeight: number
): string {
  return `You are analyzing a construction drawing to extract TITLE BLOCK information.

**TITLE BLOCK IDENTIFICATION:**
The title block is a distinct, structured information area on the drawing. Identify it by these VISUAL CHARACTERISTICS, not by position (as the drawing may be rotated):

**Visual Characteristics:**
- **Structured layout**: Contains multiple labeled fields organized in rows/columns
- **Bordered area**: Usually has visible borders, boxes, or lines separating fields
- **Labeled fields**: Contains text labels like "SHEET NUMBER", "SHEET NO.", "TITLE", "DATE", "SCALE", "PROJECT", etc.
- **Project information**: Typically includes project name, address, or client information
- **Dense text area**: More text-dense than the main drawing area
- **Standard elements**: Usually contains: project name, date, scale, sheet number, sheet title, sometimes revision info
- **Position-independent**: Can be in any corner or edge (bottom-right, top-right, bottom-left, etc.) depending on drawing orientation
- **May be rotated**: If the drawing is rotated, the title block rotates with it - look for the structured information area

**WHAT TO DETECT:**

1. **SHEET NUMBER** (Required):
   - Look for labels like "SHEET NUMBER", "SHEET NO.", "DWG NO.", "DRAWING NO.", or just a number/letter combination
   - Common formats: "A1", "A2", "A2.01", "S-101", "M1.1", "E2", "A-101"
   - Usually in a clearly labeled field or box
   - This is the unique identifier for this specific sheet

2. **SHEET TITLE** (Required):
   - The descriptive name of what this sheet shows
   - Usually near the sheet number
   - Examples: "FOUNDATION PLAN", "FIRST FLOOR FRAMING", "ELEVATIONS", "SITE PLAN"
   - May be labeled as "TITLE", "SHEET TITLE", "DRAWING TITLE", or unlabeled
   - Often in larger text than other title block fields

3. **NOTES** (Optional):
   - General notes, specifications, or important information
   - May be in a "NOTES" section, "GENERAL NOTES", "SPECIFICATIONS", etc.
   - Could include revision notes, scale information, or project-wide notes
   - Look for text blocks that contain multiple lines of instructions or requirements

**DETECTION STRATEGY:**
- Scan the ENTIRE image for a structured information area with the visual characteristics above
- Look for areas with multiple labeled fields (e.g., "SHEET NUMBER:", "TITLE:", "DATE:", "SCALE:")
- Identify the region that contains project information, dates, and sheet metadata
- The title block is usually a rectangular or boxed area, but its position depends on drawing orientation
- Don't assume position - identify by structure and content, not location
- Check all corners and edges - the title block could be anywhere if the drawing is rotated

**IMAGE DIMENSIONS:** ${imageWidth} x ${imageHeight} pixels

**INSTRUCTIONS:**
- Scan the ENTIRE image systematically to find the structured title block area
- Identify it by its visual characteristics (labeled fields, borders, structured layout), not by position
- Look for the area containing project info, dates, scale, and sheet metadata
- Extract the sheet number and sheet title accurately from the identified title block
- If notes are present (usually in a "NOTES" or "GENERAL NOTES" section), extract them as well
- If you cannot find certain information, use null for that field
- Report the region where you found the title block (this helps verify correct identification)

Return your response as JSON only, with no additional text:

{
  "sheetNumber": "A2",
  "sheetTitle": "FOUNDATION AND LOWER FLOOR FRAMING PLAN",
  "notes": "GENERAL NOTES:\n1. All dimensions are in feet and inches.\n2. See architectural drawings for finish details.",
  "titleBlockLocation": {
    "region": "bottom-right",
    "confidence": 0.95
  }
}

If you cannot determine a field, use null for that field.`;

}

