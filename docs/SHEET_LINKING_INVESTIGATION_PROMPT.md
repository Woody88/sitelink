# Sheet Linking Investigation Prompt

**Purpose:** Use this prompt with a fresh Claude agent to research the best approach for implementing automatic sheet reference detection in construction drawings.

---

## Prompt for Investigation Agent

```
I'm building a construction plan viewer app where the killer feature is "sheet linking" -
allowing users to click on sheet references in construction drawings (e.g., "See Detail A-1")
and instantly navigate to that referenced sheet.

CONTEXT:
- We already have PDF processing working: PDFs are converted to Deep Zoom Image (DZI) tiles
  using vips in a Docker container
- Tiles are stored in R2 (S3-compatible storage)
- Backend is Cloudflare Workers (Effect-TS) with D1 database
- We can use containerized services for heavy processing

TWO APPROACHES WE'VE DISCUSSED:

1. **Manual Linking** (Simpler MVP)
   - Admin draws rectangles on plans to mark clickable regions
   - Admin manually selects which sheet the region links to
   - No OCR needed, just coordinate tracking

2. **Automatic OCR Detection** (Better UX)
   - Use OCR to detect text like "A-1", "Detail 3", "Section B"
   - Match detected references to sheet numbers in the project
   - Auto-generate clickable regions

QUESTIONS TO INVESTIGATE:

1. What OCR libraries/services would work best for construction drawings?
   - Tesseract OCR (open source)
   - Google Cloud Vision API
   - AWS Textract
   - Azure Computer Vision
   - Cloudflare AI Workers
   - Others?

2. How would we integrate OCR into our architecture?
   - Run in the same Docker container as PDF processing?
   - Separate containerized service?
   - Cloudflare AI Workers (if capable)?
   - Third-party API?

3. What are the accuracy considerations?
   - Construction drawings often have stylized fonts
   - Sheet references can be in various formats ("A-1", "DETAIL A", "SEE SHEET 3")
   - How to handle false positives/negatives?
   - Can we validate detected references against project sheet list?

4. Implementation complexity vs value tradeoff
   - Should we start with manual linking for MVP?
   - Add OCR as Phase 2?
   - Or is OCR essential for the feature to work well?
   - How much would manual linking hurt adoption?

5. Cost considerations
   - Processing cost per PDF (estimate for 20-page PDF)
   - Storage for OCR data (bounding boxes, text)
   - API costs if using third-party
   - Comparison: self-hosted vs API

6. Reference detection patterns
   - What regex patterns detect sheet references?
   - How to match "See A-1" to actual sheet named "Foundation Plan - A1"?
   - Should we ask users to provide sheet numbering convention?

SEARCH THE CODEBASE:
- Check /home/woodson/Code/projects/sitelink/docs/ folder for any previous discussions
- Look for files mentioning: OCR, sheet linking, text extraction, computer vision
- Check PDF_PROCESSING_*.md files
- See if we have any prototypes or experiments

DELIVERABLES:

Please provide:
1. **Recommendation:** Manual vs OCR for MVP, with reasoning
2. **If OCR recommended:**
   - Specific library/service recommendation with pros/cons
   - Architecture diagram or description
   - Integration steps with our existing Docker pipeline
3. **If Manual recommended:**
   - UI/UX considerations for drawing regions
   - How to make it fast enough for practical use
4. **Cost Analysis:**
   - Estimated cost per PDF processed
   - Self-hosted vs API comparison
5. **Timeline Estimate:**
   - MVP manual implementation: X days
   - MVP with OCR: Y days
6. **Risk Assessment:**
   - What could go wrong?
   - How accurate would OCR be in practice?
   - Fallback plan if OCR doesn't work well?

CONSTRAINTS:
- We're a small team, need to ship MVP quickly
- Budget conscious - prefer open source over expensive APIs
- Construction plans are our only document type
- Users expect "magic" - manual linking might seem tedious
```

---

## Usage Instructions

1. Copy the prompt above
2. Start a new conversation with Claude (claude.ai or API)
3. Paste the prompt
4. Optionally provide context by uploading relevant docs from the `/docs` folder
5. Review the recommendations and bring them back to this codebase

---

## Expected Outcome

The investigation agent should provide:
- Clear recommendation on whether to use manual linking or OCR for MVP
- If OCR: specific technology recommendations with integration plan
- Cost and timeline estimates
- Risk analysis

This will inform our decision on how to implement the sheet linking feature (the #1 product differentiator).
