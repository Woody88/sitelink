# SiteLink Vision Document

**Version:** 1.0
**Date:** January 31, 2026
**Author:** Product Management
**Status:** Draft

---

## Executive Summary

SiteLink is a mobile-first construction plan viewer designed specifically for small-to-mid structural construction contractors (1-20 person companies). Our thesis is that structural professionals experience the most acute pain from information fragmentation in construction documentation, where schedules, plans, details, and specifications are scattered across dozens of sheets that reference each other through callout symbols.

The cost of this fragmentation is staggering. Poor communication causes 52% of rework in construction, costing the U.S. industry $31.3 billion annually in labor and materials alone ([Revizto](https://revizto.com/en/construction-issues-challenges/)). For structural work specifically, a single rebar detailing error can cost $30,000 per day in schedule delays ([DBM Vircon](https://www.dbmvircon.com/the-true-cost-of-detailing-errors-in-reinforced-concrete/)). These are not enterprise problems - they hit small contractors hardest, where margin for error is razor-thin and expensive software adoption is prohibitive.

SiteLink addresses this with AI-powered automatic callout detection (91.5% recall) that eliminates the time wasted manually hunting across sheets, combined with photo documentation that creates a visual audit trail tied directly to plan locations. We're building for the contractor who says, "I've tried Fieldwire and Procore. My guys just won't use them. Too complicated."

---

## Market Thesis: Why Structural, Why Now

### The Structural Pain Point

Structural construction work has uniquely severe information fragmentation compared to other trades:

**1. Sequential Dependency Creates Cascading Delays**

Unlike MEP trades that can often work in parallel, structural work is on the critical path. Concrete pours cannot be rescheduled easily - when a rebar placement error is discovered after the cage is tied, it can cost $30,000+ per day in delays ([DBM Vircon](https://www.dbmvircon.com/the-true-cost-of-detailing-errors-in-reinforced-concrete/)). Workers can be left standing around on-site while teams scramble to resolve discrepancies between what's on the drawing and what's in the field.

**2. Multi-Sheet Reference Complexity**

Structural drawings require constant cross-referencing between:
- Foundation plans (sheet S-101)
- Framing plans by level (S-201, S-202, etc.)
- Structural details (S-500 series)
- Beam and column schedules
- Rebar bending schedules
- Section cuts and elevations

A single pour may require checking 10+ sheets to understand the complete reinforcement requirements. Working drawing sets are like "web pages with hyperlinks" - but these links work in one direction only, forcing workers to constantly return to plans to regain orientation ([jonochshorn.com](https://jonochshorn.com/academics/notes-bldgtech/13a.html)).

**3. Inspection Documentation Requirements**

Structural work requires special inspections per IBC Chapter 17, including verification against ACI 318 concrete code requirements. Inspectors and foremen must document compliance with certified mill test reports, bar placement, spacing, and concrete cover depth ([F&R](https://www.fandr.com/placement-and-inspection-of-rebar-crsi-is-the-bible/)). This creates a heavy documentation burden that small contractors often handle with paper and disconnected photos.

**4. Error Cost Asymmetry**

| Trade | Cost of Rework | Discovery Timing |
|-------|---------------|------------------|
| Electrical | Replace wiring | Often caught before concealment |
| Plumbing | Replace pipe runs | Pressure testing catches issues |
| **Structural** | **Demolition + re-pour** | **After concrete sets = catastrophic** |

Errors in spacing rebar an extra inch on centers can reduce structural member strength by 20% ([Barton Supply](https://www.barton-supply.com/the-latest/blog/posts/2017/september/what-a-construction-supervisor-should-know-about-rebar-in-concrete-construction/)), creating liability that can haunt contractors for decades.

### The Market Opportunity

**U.S. Steel Rebar Market:** $6.5-7.3 billion (2024-2025), growing at 5.2% CAGR through 2030 ([Grand View Research](https://www.grandviewresearch.com/industry-analysis/us-steel-rebar-market-report)). The Infrastructure Investment and Jobs Act allocated $110 billion for roads and bridges alone, driving sustained demand.

**Small Contractor Software Gap:** While 65% of large enterprises use construction software consistently, small and medium enterprises represent the fastest-growing software segment at 11.2% CAGR ([Mordor Intelligence](https://www.mordorintelligence.com/industry-reports/construction-management-software-market)) - because they're starting from a lower baseline. 70% of contractors have no formal technology roadmap, and 2/3 cite uncertain payback periods exceeding 24 months as the chief deterrent to adoption ([IoT Marketing](https://iotmktg.com/accelerating-technology-adoption-in-the-u-s-construction-industry-key-drivers-emerging-solutions-and-implementation-strategies-for-2025/)).

**Why Now:**
1. **AI maturation**: OCR + LLM pipelines can now achieve 91.5%+ callout detection accuracy
2. **Mobile ubiquity**: Field workers carry smartphones capable of running local-first databases
3. **Pricing shifts**: Cloud-native architectures enable flat-rate pricing that undercuts per-user models
4. **Generational change**: Younger foremen expect mobile-native tools, not paper or desktop software

---

## Competitive Positioning

### Feature & Pricing Comparison (5 Users)

| Capability | SiteLink | Fieldwire | PlanGrid/Autodesk Build | Procore |
|------------|----------|-----------|------------------------|---------|
| **Monthly Cost** | **$79 flat** | $195-270 | $675+ | $375+ |
| **Setup Time** | 60 seconds | 30+ minutes | Hours | Days |
| **Auto Sheet Linking** | 91.5% recall | Yes (undocumented) | Yes (undocumented) | Yes |
| **True Offline** | Full (LiveStore) | Full | Partial | Full |
| **Voice Notes + AI Transcription** | Yes | No | No | No |
| **AI Photo Analysis** | Planned | No | Basic | No |
| **Task Management** | No (by design) | Yes | Yes | Yes |
| **RFI/Submittals** | No | Yes | Yes | Yes |
| **BIM Viewer** | No | Business tier | Yes | Yes |
| **Learning Curve** | Self-explanatory | Moderate | Steep (93% report) | Very steep |

*Sources: [SelectHub](https://www.selecthub.com/construction-management-software/plangrid-vs-fieldwire/), [ITQlick](https://www.itqlick.com/procore/pricing), [Archdesk](https://archdesk.com/blog/best-fieldwire-alternatives)*

### Competitor Weaknesses We Exploit

| Competitor | Critical Weakness | SiteLink Advantage |
|------------|-------------------|-------------------|
| **Fieldwire** | Per-user pricing adds up quickly; forms lack industry-standard templates; "frustrating limitations, clunky mobile interface" ([Fluix](https://fluix.io/blog/fieldwire-alternatives)) | Flat pricing; focused feature set |
| **PlanGrid/Autodesk Build** | 92% of users cite cost as too expensive; folded into broader ACC stack with feature bloat; support has shifted away from field focus ([Ingenious.Build](https://www.ingenious.build/blog-posts/top-plangrid-alternatives-for-construction-teams-in-2025)) | Purpose-built for small contractors |
| **Procore** | Enterprise-grade complexity; requires dedicated admin; minimum ~$4,500/year even for smallest companies ([ITQlick](https://www.itqlick.com/procore/pricing)) | No admin required; self-service |
| **Paper/PDF viewers** | No linking; no photo organization; no audit trail | AI-powered linking; photo-to-plan association |

### Our Positioning Statement

> **For small structural contractors** who need to navigate complex multi-sheet plan sets and document their work, **SiteLink** is a mobile plan viewer that **automatically links callout symbols and organizes photos by plan location**. Unlike enterprise platforms like Procore or feature-heavy tools like Fieldwire, **SiteLink does 5 things exceptionally well at a price small teams can justify**.

---

## Value Proposition: Quantified Benefits

### Time Savings

| Activity | Without SiteLink | With SiteLink | Weekly Savings (5 workers) |
|----------|------------------|---------------|---------------------------|
| Finding referenced detail | 2-5 min/lookup | 1 tap | 2-5 hours |
| Organizing job photos | 30+ min/day | Automatic | 12+ hours |
| Creating daily documentation | 45 min manual | AI-generated | 3+ hours |
| Syncing with office | End-of-day batch | Real-time | Eliminates delays |

**Conservative estimate:** 15-20 hours/week saved across a 5-person crew

### Cost Avoidance

| Risk | Industry Cost | SiteLink Mitigation |
|------|--------------|---------------------|
| Rework from miscommunication | 5-12% of project cost ([PlanRadar](https://www.planradar.com/us/cost-of-rework-construction/)) | Single source of truth, photo evidence |
| Schedule delays from errors | $30,000/day structural ([DBM Vircon](https://www.dbmvircon.com/the-true-cost-of-detailing-errors-in-reinforced-concrete/)) | Faster verification before pour |
| Failed inspections | Re-mobilization costs | Photo documentation at every stage |
| Disputes over completed work | Legal/mediation fees | Timestamped, geotagged audit trail |

**ROI Calculation:**
- If SiteLink prevents ONE inspection failure per quarter: ~$5,000+ saved
- Monthly cost: $79
- **Annual ROI: 15x+** (before counting time savings)

### AI Feature Value

| AI Capability | Daily Usage Driver | Retention Impact |
|---------------|-------------------|------------------|
| Auto callout detection | Every sheet navigation | Core value - 91.5% accuracy |
| Voice note transcription | Hands-free documentation | High - "can't type with work gloves" |
| AI daily summary | End-of-shift reports | Medium - saves 30+ min/day |
| Photo intelligence (planned) | Issue detection, progress tracking | High - proactive alerts |

The AI market in construction is projected to grow from $4.86 billion (2025) to $22.68 billion by 2032 at 24.6% CAGR ([Autodesk](https://www.autodesk.com/blogs/construction/top-2025-ai-construction-trends-according-to-the-experts/)). AI coding tools show 89% retention rates ([GetDX](https://getdx.com/blog/ai-assisted-engineering-q4-impact-report-2025/)), suggesting that once users experience AI-augmented workflows, they rarely go back.

---

## What SiteLink is NOT

Clarity on boundaries is essential for focus. SiteLink will **not** become:

### 1. A Task Management System
Photos ARE the documentation. We don't need workers to update task statuses - the timestamped photo stream with plan associations provides the audit trail. Adding task management would recreate the complexity workers reject.

### 2. An RFI/Submittal Workflow Tool
These workflows require integration with architects, engineers, and approval chains that enterprise software handles. Our users forward RFIs to their GC's system if needed.

### 3. A Budget or Cost Tracker
Financial management requires different data structures, approvals, and integrations (QuickBooks, etc.). We stay in the field documentation domain.

### 4. An Enterprise Compliance Platform
ISO certifications, SSO, advanced permissions, API integrations - these are enterprise requirements. We serve teams small enough that trust replaces formal access controls.

### 5. A BIM Viewer
3D model viewing requires specialized technology and workflows. Our users receive 2D PDFs from their structural engineers; we optimize for that reality.

### 6. A General-Purpose Platform
We resist the temptation to add "just one more feature" that serves a different persona. Every feature must serve our core user: the structural field worker who needs to see plans, take photos, and go home.

---

## Success Metrics

### North Star Metric
**Weekly Active Users (WAU) per Paying Account**

This measures actual field adoption, not just purchases. Target: 80%+ of team members active weekly within 3 months of signup.

### Supporting Metrics

| Metric | Industry Baseline | Target | Timeline |
|--------|-------------------|--------|----------|
| Time to First Sheet View | ~15 min (Fieldwire setup) | < 2 minutes | Launch day |
| Callout Taps per Session | N/A (new metric) | > 5 | 1 month post-launch |
| Photos per Week per User | N/A (new metric) | > 10 | 1 month post-launch |
| Voice Notes with Transcription | N/A (new metric) | > 3/week | 2 months post-launch |
| 30-Day Retention | ~30% (construction field apps) | > 70% | 6 months post-launch |
| NPS (structural contractors) | ~30 (construction software avg) | > 50 | 6 months post-launch |

---

## Open Questions

These questions require validation before or shortly after launch. Each has a proposed validation method.

| # | Question | Why It Matters | Validation Method | Owner | Target Date |
|---|----------|----------------|-------------------|-------|-------------|
| 1 | What is the minimum callout detection accuracy that sustains user trust? | 91.5% recall works in testing, but real-world tolerance is unknown. Below threshold = users stop trusting links | A/B test confidence thresholds (see 07-experiments.md, Exp. 2). Track callout_navigated success rate vs confidence | ML Lead | Pre-launch |
| 2 | Will "no task management" be a sales objection from GC owners? | Sarah persona (buyer) may expect task features. "By design" won't satisfy if competitors offer it | Interview 10 GC owners specifically about task management expectations. Track feature requests post-launch | Product Lead | Month 1 |
| 3 | Is $79/month the optimal price point? | $49 might dramatically expand addressable segment; $79 might limit to price-insensitive early adopters | Price sensitivity test (see 07-experiments.md, Exp. 4). Start with $79, test $49 promotion after 100 signups | Product Lead | Month 2 |
| 4 | What % of target segment uses any digital plan viewer vs paper-only? | Affects go-to-market messaging: "switch from Fieldwire" vs "replace paper plans" | Survey at 3 trade shows. Track signup source ("switching from" question in onboarding) | Product Lead | Pre-launch |
| 5 | How do competitor auto-linking accuracy numbers compare? | If Fieldwire's undocumented accuracy is comparable, our 91.5% is not a differentiator | Benchmark test: upload same plan set to Fieldwire free tier, count correct vs incorrect links | Engineering | Pre-launch |
| 6 | Are 24 interviews sufficient to generalize? | Sample size may not represent full diversity of structural contractors (regions, project types, company sizes) | Launch closed beta with 5 contractors from underrepresented segments. Compare their behavior to interview predictions | Product Lead | Month 1 |
| 7 | Will workers adopt voice notes, or prefer typing/not documenting? | Voice features are a key differentiator but adoption is uncertain with construction workers | Track voice_note_recorded adoption rate in first month. Compare to photo_captured rate | Product Lead | Month 1 |
| 8 | Should demo project auto-open on first launch? | Affects onboarding conversion. Demo-first shows value but may delay real usage | A/B test (see 07-experiments.md, Exp. 1) | Product Lead | Pre-launch |

---

## Appendix: Research Sources

### Industry Statistics
- [Revizto - Construction Challenges 2025](https://revizto.com/en/construction-issues-challenges/)
- [PlanRadar - Cost of Rework](https://www.planradar.com/us/cost-of-rework-construction/)
- [DBM Vircon - True Cost of Detailing Errors](https://www.dbmvircon.com/the-true-cost-of-detailing-errors-in-reinforced-concrete/)
- [Mordor Intelligence - Construction Software Market](https://www.mordorintelligence.com/industry-reports/construction-management-software-market)
- [Grand View Research - U.S. Steel Rebar Market](https://www.grandviewresearch.com/industry-analysis/us-steel-rebar-market-report)

### Competitive Research
- [SelectHub - PlanGrid vs Fieldwire](https://www.selecthub.com/construction-management-software/plangrid-vs-fieldwire/)
- [Archdesk - Fieldwire Alternatives](https://archdesk.com/blog/best-fieldwire-alternatives)
- [Fluix - Fieldwire Alternatives](https://fluix.io/blog/fieldwire-alternatives)
- [Ingenious.Build - PlanGrid Alternatives](https://www.ingenious.build/blog-posts/top-plangrid-alternatives-for-construction-teams-in-2025)
- [ITQlick - Procore Pricing](https://www.itqlick.com/procore/pricing)

### AI & Technology Trends
- [Autodesk - 2025 AI Construction Trends](https://www.autodesk.com/blogs/construction/top-2025-ai-construction-trends-according-to-the-experts/)
- [GetDX - AI Engineering Impact Report](https://getdx.com/blog/ai-assisted-engineering-q4-impact-report-2025/)
- [Civalgo - Software Adoption Barriers](https://www.civalgo.com/en/blog/construction-software-adoption-barriers)

### Construction Documentation
- [F&R - Rebar Inspection](https://www.fandr.com/placement-and-inspection-of-rebar-crsi-is-the-bible/)
- [Barton Supply - Rebar in Concrete Construction](https://www.barton-supply.com/the-latest/blog/posts/2017/september/what-a-construction-supervisor-should-know-about-rebar-in-concrete-construction/)
- [CRSI Standards](https://www.crsi.org/crsi-standards/)
