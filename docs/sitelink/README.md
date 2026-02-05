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

### Detection Metrics (Clarified)

**Current Model: YOLO-26n (iteration-5)**

Implemented callout classes:
| Class | Recall | Precision |
|-------|--------|-----------|
| detail | 90.7% | 87.7% |
| elevation | 93.8% | 95.2% |
| title | 90.5% | 84.1% |
| **Overall** | **91.8%** | **88.6%** |

**Element Labels & Schedules: Not Yet Implemented**

Research complete - see beads tickets:
- `sitelink-j1q` (closed): Research findings, multi-model validated
- `sitelink-3r0`: Full implementation spec for new YOLO classes
- `sitelink-d3w`: Implementation planning (blocked by 3r0)

New classes to train: `grid_bubble`, `footing_schedule`, `footing_label`, etc.
Pipeline: YOLO detects bbox → LLM extracts text (consistent with callouts).

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

## Related Beads Tickets

For implementation context, see these tickets:

| Ticket | Description | Status |
|--------|-------------|--------|
| sitelink-j1q | Element label detection research | Closed (complete) |
| sitelink-3r0 | Detection classes enumeration & implementation spec | Open |
| sitelink-d3w | Implementation planning | Open (blocked by 3r0) |

Run `bd show <ticket-id>` for full details.
