# SiteLink Implementation Planning

**Version:** 1.0
**Date:** February 2026
**Status:** Living Document

---

## Table of Contents

1. [Risk Register](#1-risk-register)
2. [Dependency Table](#2-dependency-table)
3. [Open Questions](#3-open-questions)
4. [Timeline & Milestones](#4-timeline--milestones)
5. [Success Criteria for Launch Readiness](#5-success-criteria-for-launch-readiness)

---

## 1. Risk Register

Every risk is tracked with likelihood, impact, mitigation strategy, and current status. Risks are reviewed weekly during planning sessions and updated as conditions change.

| ID | Risk Description | Likelihood | Impact | Mitigation Strategy | Owner | Status |
|----|------------------|------------|--------|---------------------|-------|--------|
| R1 | **LiveStore is pre-release software** (preview docs at next.livestore.dev). Breaking changes, bugs, or abandonment could force architecture rewrite. | Medium | Critical | Pin to specific version. Maintain abstraction layer between LiveStore APIs and application code. Monitor LiveStore Discord/GitHub for breaking change announcements. Have fallback plan for expo-sqlite + custom sync layer if project stalls. | Engineering Lead | Open |
| R2 | **Cloudflare Worker CPU/memory limits** may be insufficient for 10-stage processing pipeline. Workers have a 30s CPU time limit on the paid plan. | Medium | High | Profile pipeline per-stage. Heavy stages (tile generation via pyvips, YOLO inference) run on a separate GPU worker (Modal/Runpod), not on Cloudflare Workers. Only lightweight coordination, metadata extraction, and event dispatch run on Workers. | Engineering Lead | Open |
| R3 | **YOLO model accuracy may degrade on unseen plan styles** (architectural firms not in training set). 96.48% mAP50 measured on known datasets only. | Medium | Medium | Implement user feedback loop ("Report incorrect link"). Collect diverse training data via sitelink-669. Quarterly retraining on expanded dataset. Track per-project accuracy metrics to detect degradation early. | ML Lead | Open |
| R4 | **LLM extraction costs may exceed $79/month flat rate** for heavy users. Per-plan processing cost not modeled at scale. | Medium | High | Model unit economics: measure cost per plan page for each LLM call (metadata extraction, schedule extraction, notes extraction). Set processing page limits per tier. Cache extraction results to avoid reprocessing. Build cost monitoring dashboard with alerts. | Product Lead | Open |
| R5 | **Single-person team risk.** All docs authored by "Product Team" with no named individuals. Bus factor = 1. | High | Critical | Document architecture decisions thoroughly (this document and beads tickets). Record implementation context in beads tickets with rationale, not just outcomes. Prioritize code clarity over cleverness. Maintain comprehensive CLAUDE.md for AI-assisted development continuity. | Founder | Accepted |
| R6 | **Market validation limited.** 24 interviews and 12 site visits may not generalize to the broader 1-20 person structural contractor segment. No beta users or pilot data yet. | Medium | High | Launch closed beta with 5 contractors before public launch. Track activation metrics from day 1 (see instrumentation plan in Section 4). Iterate based on observed behavior data, not assumptions. Define clear go/no-go criteria for public launch. | Product Lead | Open |
| R7 | **Privacy/compliance for construction photos.** Photos may contain worker faces, license plates, proprietary designs. No privacy policy defined yet. | Low | High | Draft privacy policy before launch. Photos stored in user's R2 namespace with no cross-user access. GPS coordinates are optional and user-controlled. Consult legal counsel regarding CCPA/GDPR obligations for international users. No facial recognition or biometric processing on photos. | Legal/Product | Open |
| R8 | **Polar payment integration maturity.** Polar is newer than Stripe for subscription management. Edge cases in trial management, upgrades, downgrades, and cancellations may surface. | Low | Medium | Test all subscription lifecycle flows end-to-end (trial start, trial expiry, upgrade, downgrade, cancellation, reactivation, payment failure, refund). Implement webhook handlers for all Polar events. Build manual override capability for edge cases. | Engineering Lead | Open |
| R9 | **Offline-first sync conflicts.** Multiple team members editing while offline. LiveStore's conflict resolution behavior not fully tested at scale with concurrent offline writers. | Medium | Medium | Design for "last-write-wins" on non-critical metadata. Photos and voice notes are append-only (no conflict possible). Test multi-device sync scenarios in QA with simulated offline periods. Document expected behavior for each conflict type. | Engineering Lead | Open |
| R10 | **App store rejection risk.** Apple review may flag AI-generated content features or require additional disclosures about AI usage. | Low | Medium | Review Apple's current AI/ML guidelines before submission. Add appropriate disclosures in app description and within the app itself (confidence indicators already designed). Submit early for review feedback rather than waiting until full launch readiness. | Engineering Lead | Open |

---

## 2. Dependency Table

External and internal dependencies that gate feature delivery. Each dependency is tracked with its current status and the impact of delay.

| Dependency | Type | Owner | Status | Impact if Delayed |
|------------|------|-------|--------|-------------------|
| **LiveStore SDK stability** | Technical | Engineering | In Progress | Blocks all data features. LiveStore is the foundation for offline-first architecture, event sourcing, and device sync. A breaking change requires reworking the entire data layer. |
| **Cloudflare Workers paid plan** | External | Engineering | Done | Blocks processing pipeline deployment. Required for D1 database, R2 storage, and Worker execution beyond free tier limits. |
| **Polar API integration** | External | Engineering | Not Started | Blocks subscription management, trial lifecycle, and payment processing. No revenue collection without this. |
| **YOLO 4-class model deployment** (sitelink-8x8) | Technical | ML | In Progress | Blocks callout detection in production pipeline. Currently trained and validated (96.48% mAP50) but not deployed to the processing worker. |
| **DocLayout-YOLO deployment** (sitelink-bav) | Technical | ML | In Progress | Blocks Plan Info feature entirely. Model trained (96.8% mAP50) but not integrated into PlanCoordinator pipeline. |
| **PostHog React Native SDK** | Technical | Engineering | Not Started | Blocks analytics and instrumentation. Required for onboarding funnel measurement, feature adoption tracking, and launch readiness validation. Moved from Phase 3 to Phase 1 per instrumentation requirements. |
| **Apple Developer Account** | External | Product | Done | Blocks iOS distribution via TestFlight (beta) and App Store (launch). |
| **Google Play Developer Account** | External | Product | Done | Blocks Android distribution via internal testing tracks and Play Store. |
| **OAuth provider setup** (Google, Microsoft) | External | Engineering | Not Started | Blocks authentication. Users cannot sign in without at least one OAuth provider configured. Google OAuth requires verified app status for production. |
| **Privacy policy and terms of service** | Legal | Product | Not Started | Blocks app store submission on both platforms. Apple and Google both require published privacy policy URL. Also blocks compliance (R7). |
| **Domain + SSL** (sitelink.app) | External | Engineering | Not Started | Blocks shared reports web pages (`sitelink.app/r/{id}`), OAuth redirect URLs, and public-facing privacy/terms pages. |

---

## 3. Open Questions

Unresolved questions that affect product direction, pricing, or technical approach. Each question includes why it matters, how to validate, and a target resolution date.

| # | Question | Why It Matters | Proposed Validation Method | Owner | Target Resolution |
|---|----------|---------------|---------------------------|-------|-------------------|
| Q1 | **What is the minimum callout detection accuracy that sustains user trust?** 91.5% recall works in testing, but what is the real-world threshold where users stop trusting auto-linking? | If users encounter too many incorrect links, they will stop tapping callouts and the core value proposition collapses. The gap between "works in testing" and "works in the field" may be significant. | Measure callout tap rate vs. accuracy per project during beta. Survey beta users on perceived accuracy. A/B test showing confidence badges vs. hiding them. | ML Lead | Beta launch + 4 weeks |
| Q2 | **Will the "no task management" design philosophy be a sales objection from GC owners (Sarah persona)?** | Sarah (GC Owner) evaluates tools for her team. If she expects task management and SiteLink lacks it, she may reject it regardless of field worker enthusiasm. This could limit top-down adoption. | Include Sarah-persona users in beta. Track how many beta evaluators ask about task management. Monitor feature request submissions. Survey: "What is missing that would prevent you from subscribing?" | Product Lead | Beta launch + 6 weeks |
| Q3 | **Is $79/month the right price point, or would $49 dramatically expand the addressable segment?** | Pricing determines both revenue trajectory and market penetration. At $79, SiteLink is already 60% cheaper than Fieldwire for 5 users, but small contractors may anchor to "$0" (paper) rather than "$195" (Fieldwire). | Price sensitivity testing during beta. Offer different price points to different beta cohorts. Track conversion rates at each price. Calculate break-even subscriber count at each tier. | Product Lead | Pre-launch (4 weeks before public) |
| Q4 | **What percentage of target segment (1-20 person structural contractors) currently uses any digital plan viewer vs. paper-only?** | If the majority is paper-only, the sales motion is "adopt digital" (harder). If many use free PDF viewers, the motion is "upgrade to smart viewer" (easier). This changes messaging, onboarding, and marketing spend. | Survey during beta onboarding: "How do you currently view plans on-site?" Options: paper only, free PDF viewer, paid software, other. Cross-reference with company size. | Product Lead | Beta launch + 2 weeks |
| Q5 | **How do competitors' undocumented auto-linking accuracy numbers actually compare to SiteLink's?** | Fieldwire and PlanGrid both claim auto-linking but publish no accuracy metrics. If their accuracy is comparable to SiteLink's 91.5%, the differentiator weakens. If theirs is lower, it strengthens positioning. | Create a benchmark plan set (10 diverse PDFs from different firms). Process through SiteLink, Fieldwire trial, and PlanGrid trial. Manually count true positives, false positives, and false negatives for each. | Engineering Lead | Pre-launch |
| Q6 | **Are 24 interviews and 12 site visits sufficient to generalize pain points across the structural contractor segment?** | If the sample is biased (e.g., all from one region, one project type, one company size), the product may solve the wrong problems. Structural contractors working on residential vs. commercial vs. infrastructure may have different workflows. | During beta, segment users by project type (residential, commercial, infrastructure) and company size. Track whether feature usage patterns match interview predictions. If they diverge significantly, expand research scope. | Product Lead | Beta launch + 8 weeks |
| Q7 | **Will construction workers adopt voice notes, or will they prefer typing/not documenting at all?** | Voice notes with transcription is a key Pro-tier differentiator ($79 vs. $29). If field workers do not use voice features, the Pro tier value proposition weakens and retention may suffer. | Track voice note creation rate per user during beta. Compare with photo capture rate. Survey: "Do you currently use voice memos on your phone for work?" A/B test: prominent voice CTA vs. subtle. | Product Lead | Beta launch + 4 weeks |
| Q8 | **Should the demo project auto-open on first launch, or should upload-first be the default path?** | The onboarding path determines time-to-value. Auto-opening a demo shows capabilities immediately but delays the user's own data. Upload-first gets users invested in their own project but risks dropout if processing takes too long. | A/B test during beta. Group A: demo auto-opens with "Upload your plans" CTA. Group B: upload flow is primary with "Or explore demo" secondary. Track: time to first real upload, 7-day retention, feature discovery breadth. | Product Lead | Beta launch + 3 weeks |

---

## 4. Timeline & Milestones

This timeline restructures the Phase 1/2/3 scope from [03-product.md](./03-product.md) Section 11 into concrete weekly milestones with measurable deliverables.

**Key change from 03-product.md:** PostHog analytics integration has been moved from Phase 3 to Phase 1. Instrumentation must be in place before beta to measure onboarding funnel, feature adoption, and launch readiness criteria.

### Phase 1: Core MVP (Weeks 1-6)

| Week | Milestone | Deliverables | Exit Criteria |
|------|-----------|-------------|---------------|
| **1** | **Foundation** | LiveStore + Expo integration working. LiveStore sync backend deployed on Cloudflare. Domain package with events, tables, materializers. PostHog SDK integrated with basic session tracking. | App launches, creates a local LiveStore database, syncs a test event to cloud and back. PostHog receives session_start event. |
| **2** | **Auth + Projects** | OAuth sign-in (Google, Microsoft). Project creation flow. Trial start screen. PostHog tracks signup funnel events (welcome_viewed, oauth_started, oauth_completed, trial_started). | User can sign in, see trial status, and create a named project. Analytics events visible in PostHog. |
| **3** | **Plan Upload + Processing** | PDF upload to R2. Processing pipeline stages 1-3 (split, metadata, tiles). Progress screen with step indicators. PostHog tracks upload funnel (upload_started, processing_started, processing_complete). | User uploads a multi-page PDF, sees processing progress, and receives sheet list with thumbnails when complete. |
| **4** | **Plan Viewer + Callouts** | Sheet viewer with PMTiles rendering (pan/zoom). Callout marker overlay. Callout action sheet. Sheet-to-sheet navigation via callout tap. YOLO 4-class model deployed (sitelink-8x8). | User views a sheet, taps a callout marker, sees linked sheet reference, and navigates to the target sheet. 60fps pan/zoom verified. |
| **5** | **Camera + Photos** | Camera with callout linking. Issue toggle. Photo capture and local storage. Photo timeline per callout. Offline photo queue. PostHog tracks photo funnel (camera_opened, photo_captured, photo_linked, issue_flagged). | User opens camera from callout action sheet, takes a photo linked to the callout, toggles issue mode, and sees the photo in the callout timeline. |
| **6** | **Offline + Payments** | Offline sheet viewing with cached PMTiles. Offline photo capture with sync queue. Voice note recording (audio only, no transcription). Polar payment integration. Trial lifecycle (start, expiry, upgrade). Basic project sharing (view-only link). PostHog tracks offline usage and subscription events. | User downloads a project for offline use, takes photos offline, and sees them sync when connectivity returns. Subscription purchase flow works end-to-end via Polar. |

### Phase 2: AI Features + Plan Info (Weeks 7-10)

| Week | Milestone | Deliverables | Exit Criteria |
|------|-----------|-------------|---------------|
| **7** | **Voice + Search** | Voice note transcription via Whisper API. Plan text search (full-text index over OCR results). Photo text extraction (OCR on captured photos). | User records a voice note and sees transcription within 10 seconds. User searches for text and finds matches across sheets with highlighted snippets. |
| **8** | **Plan Info Backend** | DocLayout-YOLO deployed in processing pipeline (sitelink-bav). Schedule extraction via LLM (sitelink-bz4). Notes extraction via LLM (sitelink-73f). Legend image crop generation. | Processing a PDF with schedules, notes, and legends produces correct layout_regions, schedule_entries, and legend crops stored in R2. |
| **9** | **Plan Info UI** | Plan Info browse view (sitelink-0hy). Schedule detail screen with table rendering. Notes detail screen with formatted text. Legend detail screen with zoomable image crop. "View on Sheet" navigation from all detail screens. | User switches to Plan Info tab, sees categorized list of schedules/notes/legends, taps into each, and navigates back to the source region on the sheet. |
| **10** | **Daily Summaries + Sharing** | Daily summary generation via LLM. Share daily report (hosted page + PDF download). On-sheet region overlays for detected layout regions (sitelink-9tj). | User generates a daily summary from photos and voice notes, shares it via link, and recipient views it in browser. Region overlays appear on sheets with detected schedules/notes/legends. |

### Phase 3: Polish & Launch Prep (Weeks 11-14)

| Week | Milestone | Deliverables | Exit Criteria |
|------|-----------|-------------|---------------|
| **11** | **Team + Notifications** | Team member invitation flow. Role-based permissions (owner, admin, member, viewer). Push notification system (plan processing complete, issue flagged, team activity). | Owner invites team member by email. Member joins, sees shared project. Push notifications fire for relevant events. |
| **12** | **Quality + Performance** | Performance optimization (60fps viewer, <2s sheet load, <100ms offline queries). Error handling and retry logic for all network operations. Crash-free rate >99.5%. Edge case testing (500-page PDFs, slow networks, concurrent offline edits). | All performance targets met. No known crashes. 500-page PDF processes without timeout. |
| **13** | **Launch Prep** | Privacy policy and terms of service published. App store metadata and screenshots prepared. Beta feedback incorporated. Feature request screen. Help and support content. | Privacy policy live at sitelink.app/privacy. App store submissions ready. All launch readiness criteria (Section 5) met. |
| **14** | **Submission + Beta Close** | App store submissions (iOS + Android). Final beta user feedback collection. Go/no-go decision for public launch. Marketing site live. | Both app stores approve the submission. Beta metrics meet launch readiness thresholds. |

### Post-Launch (Weeks 15+)

| Priority | Feature | Dependency |
|----------|---------|------------|
| P1 | RFI draft generation (Business tier) | Daily summary infrastructure |
| P1 | Grid coordinate system UI (Phase 2 of AI features) | Grid bubble detections (already stored) |
| P1 | Element label detection and tap | New YOLO classes + grid system |
| P2 | Plan Assistant voice queries | Grid system + element detection + schedule extraction |
| P2 | Schedule-to-element cross-linking | Element detection + schedule extraction |
| P3 | PDF annotation tools | User demand validation |
| P3 | Revision comparison | Multiple revision data |
| P3 | API access (Business tier) | Stable data model |

---

## 5. Success Criteria for Launch Readiness

The following criteria define "ready to launch." All must be met before public app store release. Each criterion is binary (pass/fail) with a specific measurement method.

### 5.1 Technical Readiness

| Criterion | Measurement | Pass Threshold |
|-----------|-------------|----------------|
| **Processing pipeline handles large PDFs** | Upload a 500-page PDF and verify all stages complete | All 500 pages processed without timeout or error |
| **Callout detection accuracy on unseen plans** | Run YOLO 4-class model on 3 plan sets from firms not in training data | Recall >90% across all 3 sets |
| **Offline mode: core features work without connectivity** | Enable airplane mode, verify: view sheets, tap callouts, navigate links, take photos, record voice notes | All listed features functional with zero network calls |
| **Sync resilience** | Take 20 photos offline, restore connectivity, verify all sync | 100% of offline photos uploaded and visible on second device within 5 minutes |
| **Performance targets met** | Automated performance test suite | Sheet load <2s, pan/zoom 60fps, offline query <100ms, app launch <3s |
| **Crash-free rate** | Firebase Crashlytics or PostHog monitoring during final beta week | >99.5% crash-free sessions |
| **Processing pipeline cost model validated** | Process 50 sample PDFs of varying sizes, calculate per-page cost | Per-page cost documented and sustainable at $79/month for expected usage |

### 5.2 Product Readiness

| Criterion | Measurement | Pass Threshold |
|-----------|-------------|----------------|
| **Trial to paid flow tested end-to-end** | Walk through: signup, trial start, use features for 14 days, trial expiry warning, upgrade via Polar, payment confirmation, tier features unlocked | Complete flow works on both iOS and Android without manual intervention |
| **Onboarding funnel instrumented** | Verify PostHog events fire for every onboarding step: app_opened, welcome_viewed, oauth_started, oauth_completed, trial_started, first_project_created, first_upload_started, first_upload_complete, first_sheet_viewed, first_callout_tapped | All 10 events fire with correct properties and are visible in PostHog dashboard |
| **Feature adoption tracking live** | Verify PostHog events for core features: photo_captured, voice_note_recorded, plan_info_viewed, daily_summary_generated, project_shared | All events fire with correct properties |
| **Demo project functional** | Open demo project, verify: 5 sheets with callout links, sample photos, Plan Info populated | Demo loads instantly, all callouts link correctly, Plan Info shows schedules/notes/legends |
| **Error states handled gracefully** | Test: network timeout during upload, OAuth failure, payment failure, processing error, sync conflict | Each error shows user-friendly message with recovery action. No unhandled exceptions. |

### 5.3 Legal & Compliance Readiness

| Criterion | Measurement | Pass Threshold |
|-----------|-------------|----------------|
| **Privacy policy published** | Visit sitelink.app/privacy | Page loads with complete privacy policy covering data collection, storage, sharing, AI processing, and user rights |
| **Terms of service published** | Visit sitelink.app/terms | Page loads with complete terms covering subscription, data ownership, liability, and acceptable use |
| **App store compliance** | Submit to both stores and receive approval | Both Apple App Store and Google Play approve without rejection |
| **AI disclosure** | Review app for AI-generated content disclosures | Confidence indicators shown on all AI-extracted data. App description mentions AI-powered features. |

### 5.4 Beta Validation Thresholds

These metrics must be observed during the final 2 weeks of beta with at least 5 active contractor accounts.

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Signup to first upload** | >50% of signups upload a PDF | PostHog funnel: oauth_completed to first_upload_started |
| **Day 7 retention** | >30% of signups return after 7 days | PostHog cohort analysis |
| **Photos per active user per day** | >3 photos/day average | PostHog event count per user per day |
| **Callout taps per session** | >5 taps/session average | PostHog event count per session |
| **Processing success rate** | >95% of uploaded PDFs complete processing | Pipeline monitoring dashboard |
| **Support tickets per user** | <0.5/month | Support system count divided by active users |

---

## Document History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | Feb 2026 | Initial implementation planning document. Risk register, dependency table, open questions, timeline, and launch readiness criteria. |

---

## Cross-References

- **Market & Vision:** [01-vision.md](./01-vision.md)
- **User Research & Personas:** [02-users.md](./02-users.md)
- **Product Specification:** [03-product.md](./03-product.md)
- **Technical Architecture:** [04-architecture.md](./04-architecture.md)
- **AI Features Specification:** [05-ai-features.md](./05-ai-features.md)

---

_End of Document_
