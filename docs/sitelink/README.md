# SiteLink Product Documentation

**Status:** Living document
**Last Updated:** February 2026

---

## Document Structure

This directory contains the modular PRD and supporting documentation for SiteLink.

### Core PRD Documents

| Document | Description | Status |
|----------|-------------|--------|
| [01-vision.md](./01-vision.md) | Market thesis, competitive positioning, value proposition | Draft |
| [02-users.md](./02-users.md) | User personas, workflows, jobs-to-be-done, retention analysis | Draft |
| [03-product.md](./03-product.md) | Feature specifications, screens, flows | Draft |
| [04-architecture.md](./04-architecture.md) | Technical architecture, processing pipeline, offline model | Draft |
| [05-ai-features.md](./05-ai-features.md) | Plan Assistant, extraction pipeline, query system | Draft |
| 06-implementation.md | Phases, success metrics, risks | TODO |

### Legacy Documents (To Be Deprecated)

These documents contain valuable content but will be consolidated into the modular structure:

| Document | Content | Migration Status |
|----------|---------|------------------|
| [prd.md](./prd.md) | Original comprehensive PRD | Migrating to 03-product.md |
| [plan-assistant-prd.md](./plan-assistant-prd.md) | AI features PRD | Migrating to 05-ai-features.md |

### Supporting Documents

| Document | Description |
|----------|-------------|
| [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) | UI/UX design tokens and patterns |
| [concrete-flows.md](./concrete-flows.md) | Specific user flows for concrete work |
| [deep-dive.md](./deep-dive.md) | Technical deep dives |
| [product-analysis.md](./product-analysis.md) | Market and product analysis |

---

## Key Decisions

### Offline Model (Clarified)

**Cloud processing, offline querying.**

- All PDF processing (YOLO, OCR, LLM extraction) runs in cloud during upload
- Extracted structured data syncs to device via LiveStore
- Device queries run against local SQLite - fully offline
- AI features requiring inference (complex queries, daily summaries) need cloud

This is NOT an "on-device AI" approach. See [04-architecture.md](./04-architecture.md) for details.

### Target Market

**Structural construction professionals at small-to-mid contractors (1-20 persons).**

Why structural:
- Highest information fragmentation (schedules, plans, details across sheets)
- Highest cost of errors ($30K+/day rework for concrete)
- Most standardized notation (easier AI extraction)
- Clearest ROI calculation

See [01-vision.md](./01-vision.md) for market validation.

### Competitive Positioning

| | SiteLink | Fieldwire | Procore |
|-|----------|-----------|---------|
| Monthly cost (5 users) | $79 flat | $195-270 | $375+ |
| Setup time | 60 seconds | 30+ min | Days |
| Complexity | Low | Medium | Very High |
| Focus | Plan viewing + photos | Full project management | Enterprise platform |

We compete on simplicity and price, not features.

### Pricing

**Status: TBD** - Pricing structure will be finalized closer to launch. Current competitive positioning uses $79/month for comparison purposes. Final pricing (flat vs tiered) depends on feature costs, market testing, and go-to-market strategy.

### Detection Metrics

**Callout Model: YOLO-26n (4-class, grid_bubble_v15)**

| Metric | Value |
|--------|-------|
| mAP50 | 96.48% |
| Precision | 95.03% |
| Recall | 95.98% |
| Classes | detail, elevation, title, grid_bubble |

**Document Layout Model: DocLayout-YOLO (fine-tuned)**

| Metric | Value |
|--------|-------|
| mAP50 | 96.8% |
| Precision | 93.9% |
| Recall | 95.3% |
| Classes | schedule, notes, legend |

**Current Focus: Plan Info Feature**
- Schedule extraction via LLM (crop detected regions → structured JSON)
- Notes extraction via LLM (crop → text)
- Legend display via image crop (no LLM needed)
- Plan Info browse UI in mobile app

**Phase 2 (Deferred):**
- Grid coordinate system UI (grid bubbles detected and stored, UI deferred)
- Element label detection (footing_label, pier_label, column_label)
- Plan Assistant voice queries
- Schedule-to-element tap linking

Research and specs complete - see beads tickets:
- `sitelink-j1q` (closed): Element label research findings
- `sitelink-3r0` (closed): Detection classes implementation spec
- `sitelink-bg8` (closed): Grid bubble training (96.48% mAP50)
- `sitelink-ws0` (closed): DocLayout-YOLO fine-tuning (96.8% mAP50)

---

## Contributing

When updating these documents:

1. Keep each document focused on its domain
2. Cite sources for market claims and statistics
3. Flag conflicts between documents for reconciliation
4. Update this README when adding new documents

---

## Document Evolution

| Date | Change |
|------|--------|
| Jan 2026 | Initial modular structure created from merged PRDs |
| Feb 2026 | Clarified detection metrics (91.8% recall on 3 classes). Added element label research (sitelink-j1q, multi-model validated). Created implementation spec (sitelink-3r0) for new YOLO classes. Confirmed: YOLO + LLM pipeline, tap-based interaction, schedule parsing as differentiator. |
| Feb 2026 | Updated to 4-class callout model (96.48% mAP50, includes grid_bubble). DocLayout-YOLO complete (96.8% mAP50). Added Plan Info feature spec (schedule/notes/legend browse UI). Defined end-to-end pipeline with parallel dual-model detection. Phase 2 defined: grid UI, element tap, Plan Assistant voice. |

## Related Beads Tickets

For implementation context, see these tickets:

### Completed
| Ticket | Description | Status |
|--------|-------------|--------|
| sitelink-j1q | Element label detection research | Closed |
| sitelink-3r0 | Detection classes enumeration & implementation spec | Closed |
| sitelink-bg8 | Grid bubble YOLO training (96.48% mAP50) | Closed |
| sitelink-ws0 | DocLayout-YOLO fine-tuning (96.8% mAP50) | Closed |

### Current Focus: Plan Info Feature
See beads tickets for implementation work (created from pipeline planning session).

Run `bd show <ticket-id>` for full details. Run `bd ready` for available work.
