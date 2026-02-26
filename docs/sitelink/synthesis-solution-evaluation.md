---
artifact: interview-synthesis
version: "1.0"
created: 2026-02-22
status: complete
context: Evaluating SiteLink's overall solution and AI approach against field research findings
---

# Interview Synthesis: Solution & AI Fit Evaluation

## Research Overview

### Objective

Evaluate whether SiteLink's current solution design and AI-powered features align with observed field worker needs, and identify where the solution is strong, where it has risk, and where AI is solving real problems versus assumed ones.

### Methodology

- **Format:** Field observations (in-person) + structured interviews (in-person and phone)
- **Duration:** 30-60 minutes per interview; half-day site visits
- **Interviewer(s):** Product Team
- **Date Range:** Late 2025 to January 2026

### Participant Summary

| ID | Role/Segment | Tenure | Interview Type | Notes |
|----|--------------|--------|----------------|-------|
| P1 (Carlos) | Rebar Foreman, 6-person crew | 15 years | Interview + site visit | Primary persona; reads plans fluently, iPhone user |
| P2 (Mike) | Journeyman Electrician, 15-person company | 8 years | Interview + site visit | Works independently; high tech comfort; Samsung user |
| P3 (Rosa) | Building Inspector, City dept | 12 yrs construction, 5 as inspector | Interview + site visit | Inspects 6-8 sites/day; City-issued iPad |
| P4 (Sarah) | GC Owner, 8 employees | 18 yrs construction, 7 as owner | Interview | Buyer persona; tried Fieldwire and Procore; MacBook + iPhone |
| P5 (Danny) | Plumber, 2-person crew | 22 years | Interview | Low-tech tolerance; works for multiple GCs; older iPhone |
| P6-P24 | Various foremen, workers, PMs | 5-25 years | Interviews (19) | Residential and commercial structural projects |
| SV1-SV12 | Site visits across Denver, Seattle, Phoenix | N/A | Field observation (12) | Parking structures, multi-family, commercial office |

---

## Key Themes

### Theme 1: Multi-Sheet Navigation Is the Universal Pain Point

**Prevalence:** 24 of 24 participants

**Summary:** Every participant, regardless of role, trade, or experience level, described the same core frustration: construction plans scatter related information across multiple sheets, forcing constant back-and-forth navigation. This isn't an inconvenience — it's a productivity drain that cascades through the entire crew. The foreman becomes an information bottleneck while 4+ workers stand idle.

**Evidence:**
- P1 (Carlos): "I've been doing this 15 years. I can read plans in my sleep. But I shouldn't have to flip through 50 sheets just to find what size rebar goes in a footing. Just tell me what goes here."
- P2 (Mike): "I spend half my day just finding the right sheet. The callout says 5/E-402, so I have to find E-402, then find detail 5. By the time I find it, I forgot what I was looking for."
- SV3 (Phoenix parking structure): Observed foreman print key sheets and carry paper because zero cell signal in lower levels made cloud PDF viewers useless.

**Solution fit:** STRONG. SiteLink's one-tap callout navigation directly addresses the #1 stated pain point. The 5-15 min → 30 sec time savings is not hypothetical — it maps directly to the observed workflow.

### Theme 2: Workers Reject Complexity Categorically

**Prevalence:** 20 of 24 participants (all field workers + Sarah)

**Summary:** Small contractor field workers have zero tolerance for software complexity. They have tried enterprise tools and abandoned them. The rejection isn't about features — it's about the cognitive load of learning something new when your hands are full of rebar. The phrase "my guys won't use it" appeared in nearly every GC/foreman interview. This is the graveyard where Fieldwire, PlanGrid, and Procore adoption dies.

**Evidence:**
- P4 (Sarah): "I've tried Fieldwire, I've tried Procore. My guys open them once and never again. Too many features. They just want to see the plans and take pictures. That's it."
- P5 (Danny): "Every GC wants me to use their app. I'm on 5 different jobs with 5 different GCs. I'm not learning 5 different systems. Just send me the plans."
- P1 (Carlos): "I don't have time to learn another app." (Barrier to adoption, stated unprompted)
- P2 (Mike): "Apps never work the way they show in the demo."

**Solution fit:** STRONG — WITH A RISK. SiteLink's deliberate "no task management" philosophy and 5-feature focus directly addresses this. The positioning statement ("does 5 things exceptionally well") is exactly right. **Risk:** The buyer persona (Sarah) may expect task management because competitors have it. The product's restraint is its greatest strength AND a potential sales objection.

### Theme 3: Photos Are Already Happening — Organization Is Not

**Prevalence:** 18 of 24 participants

**Summary:** Field workers already take photos constantly — they just have no system for organizing them. Photos end up in the camera roll mixed with personal pictures, unsearchable, unlinked to plan locations. The pain isn't "I need to take photos" (they do that already) — it's "I can't find the photo when I need it" and "I can't make sense of 200 photos at end of day." This is a workflow fit, not a behavior change.

**Evidence:**
- P2 (Mike): Boss wants more photo documentation, but organizing photos is daily time overhead.
- P1 (Carlos): "Photos of first tie for documentation" happens at 7 AM; finding them for the inspector at 9 AM means scrolling through 200+ photos.
- P4 (Sarah): Spends 45-60 minutes every evening writing daily reports, manually sifting through the day's photos.

**Solution fit:** VERY STRONG. SiteLink's camera-linked-to-callout approach doesn't ask workers to change behavior — it adds metadata to something they already do. This is the "fits existing workflow" principle at its best. The AI daily summary (photos + voice notes → report) directly eliminates Sarah's 45-minute evening ritual.

### Theme 4: Offline Is Non-Negotiable, Not a Nice-to-Have

**Prevalence:** 15 of 24 participants (100% from site visits in parking structures and rural sites)

**Summary:** 40%+ of job sites have poor or no connectivity. Parking structures, basements, rural areas, and high-rise cores are dead zones. Any solution that requires internet to view plans is immediately disqualified. Workers observed this as a binary — if it doesn't work offline, it doesn't work at all.

**Evidence:**
- SV3 (Phoenix): Zero cell signal in lower levels. Foreman carried paper printouts as workaround.
- P3 (Rosa): Couldn't verify plans on-site when contractor's cloud app wouldn't load.
- P1 (Carlos): 30% of his jobs are in parking structures with no connectivity.

**Solution fit:** STRONG. LiveStore's local-first architecture with SQLite on-device is architecturally sound for this requirement. The key insight is that SiteLink pre-extracts all data in the cloud and syncs structured results — so offline isn't degraded, it's the same experience.

### Theme 5: Trust Requires Seeing the Source

**Prevalence:** 12 of 24 participants (strongest among foremen and inspectors)

**Summary:** Construction workers will not act on information they can't verify against the source drawing. This isn't paranoia — it's professional discipline born from the consequences of errors (demolished concrete, failed inspections, liability). Any AI system that presents extracted data without showing where it came from will be rejected. Workers need the "because the drawing says so" proof.

**Evidence:**
- P3 (Rosa): "I'm not here to argue with the foreman. I just need to see that the rebar matches what's on the approved drawing."
- P1 (Carlos): Crew asks "Are you sure it's F1? Check again" — verification is part of the workflow.
- P4 (Sarah): "Is this the latest set?" — revision certainty is an existing anxiety.

**Solution fit:** STRONG. SiteLink's provenance design ("[Source: S0.0 Footing Schedule] [View]") directly addresses this. Every AI-extracted piece of data links back to its source sheet and location. This is the most architecturally correct decision in the product — trust through transparency, not authority.

### Theme 6: Voice Input Has Strong Appeal But Uncertain Adoption

**Prevalence:** 8 of 24 participants explicitly mentioned voice; 5 additional mentioned "can't type with gloves"

**Summary:** Workers with dirty or gloved hands cannot type on phones. Voice input is a natural solution to this physical constraint. However, voice note adoption is unproven with this demographic — construction sites are loud, workers may feel self-conscious talking to a phone, and the habit doesn't exist yet. The appeal is logical but the adoption is uncertain.

**Evidence:**
- P2 (Mike): "Can't type with work gloves" — the physical constraint is real and daily.
- SV2 (Seattle): Observed electrician trying to type with gloves, giving up, removing gloves, typing, putting gloves back on. ~45 seconds overhead per interaction.
- No participant currently uses voice memos on their phone for work documentation.

**Solution fit:** MODERATE — HIGH POTENTIAL, UNPROVEN. Voice notes with AI transcription is a compelling Pro-tier feature. The physical constraint is real and observed. But no participant had an existing voice documentation habit, making this a behavior change, not a workflow fit. Experiment 5 in `07-experiments.md` (daily summary reminder) partially addresses adoption.

---

## Notable Quotes

> "I've been doing this 15 years. I can read plans in my sleep. But I shouldn't have to flip through 50 sheets just to find what size rebar goes in a footing. Just tell me what goes here."
> — P1 (Carlos), Rebar Foreman, 15 years experience

> "I've tried Fieldwire, I've tried Procore. My guys open them once and never again. Too many features. They just want to see the plans and take pictures. That's it."
> — P4 (Sarah), GC Owner, 8 employees

> "I spend half my day just finding the right sheet. The callout says 5/E-402, so I have to find E-402, then find detail 5. By the time I find it, I forgot what I was looking for."
> — P2 (Mike), Journeyman Electrician

> "I'm not here to argue with the foreman. I just need to see that the rebar matches what's on the approved drawing. If it doesn't match, I have to be able to show them exactly what the drawing says."
> — P3 (Rosa), Building Inspector

> "Every GC wants me to use their app. I'm on 5 different jobs with 5 different GCs. I'm not learning 5 different systems. Just send me the plans."
> — P5 (Danny), Plumber, 22 years experience

> "The architect thinks they're being helpful putting all these details on the drawing. But when I'm standing at one footing, I don't care about the other 50. Just tell me what goes here."
> — P1 (Carlos), Rebar Foreman, on-site observation

> "I bought Fieldwire licenses for all 8 guys. Know how many actually use it? Two. Me and my superintendent."
> — P4 (Sarah), GC Owner, on competitor adoption failure

---

## Insights

### Insight 1: The AI solves the right problem, but the UI is the actual product

SiteLink's YOLO callout detection (96.48% mAP50) and LLM schedule extraction are technically impressive, but field workers don't care about the AI — they care that tapping a callout takes them to the right sheet in one tap. The AI is infrastructure, not the value proposition. The value proposition is "30 seconds instead of 10 minutes." If the UI feels like a PDF viewer with extra steps, workers will reject it regardless of detection accuracy. If it feels like the plans "just know" where everything links, they'll adopt it without understanding (or needing to understand) the AI.

**Implication:** Marketing and onboarding should never mention AI, YOLO, or detection accuracy. Frame the product as "plans that link themselves." Lead with the experience, not the technology. Save technical proof points for Sarah (buyer) and Rosa (verifier).

### Insight 2: The "no task management" decision is strategically correct but commercially risky

The research strongly supports SiteLink's decision to omit task management. Workers explicitly reject feature-heavy apps, and "photos ARE the documentation" is a genuinely innovative insight. But Sarah (buyer persona) evaluates tools against a mental checklist that includes task management because competitors have it. She may not choose SiteLink if she perceives a gap, even though her workers prefer it. The product is designed for Carlos; it's sold to Sarah.

**Implication:** Create a specific "Why No Task Management" page in the marketing site that reframes the absence as a feature ("Your team actually uses it because it doesn't have task management"). During beta, explicitly interview buyer personas about this. If >30% cite task management as a blocker, consider a minimal "issues log" (not task management) that bridges the gap without adding complexity.

### Insight 3: Photo-to-plan linking is the sleeper retention mechanism

Callout navigation is the activation feature (first "wow" moment), but photo documentation is the retention mechanism. Once a contractor has 3+ months of photos organized by plan location, they cannot leave SiteLink without losing that history. This is the real lock-in, not the AI. Competitors have auto-linking, but no competitor auto-organizes photos by plan location from the camera capture moment. The combination of "take photo → it knows where you are on the plans → it's searchable by location and voice transcript" creates a documentation system that accumulates value over time.

**Implication:** Prioritize the photo timeline UI and search over Plan Info polish. Measure "photos per user per day" as a leading indicator of retention, not just feature usage. Consider making photo features available in the Starter tier to maximize lock-in before upselling AI features.

### Insight 4: The AI pipeline's "cloud extraction, device querying" architecture is the correct offline strategy

The temptation with AI features is to run models on-device for offline use. SiteLink correctly rejects this. On-device LLMs have 8-15 second latency, drain battery, and produce lower quality results. By running YOLO + OCR + LLM in the cloud during upload and syncing structured results to SQLite, SiteLink achieves <100ms query times offline with the same data quality. Field workers get instant answers even in a parking structure basement. This is the architecturally correct approach that competitors haven't matched.

**Implication:** Never compromise on this architecture. If users request offline LLM chat, explain that structured data queries work offline; natural language chat requires connectivity. The 95% use case (What's at F/5? What's the footing schedule?) works offline. The 5% use case (free-form questions) doesn't — and that's the right tradeoff.

### Insight 5: The Plan Info feature (schedules, notes, legends) serves a real but secondary need

Schedule extraction via DocLayout-YOLO + Gemini Flash is technically sound (100% row extraction, ~4s latency, ~$0.0004/schedule). But in the research, no participant spontaneously asked for "browse all schedules from my plans." What they asked for was "tell me what goes HERE" — a location-first query, not a schedule-first browse. Plan Info is valuable as a secondary discovery path (especially for Sarah reviewing plans from the office), but the primary interaction should always be location → information, not information → location.

**Implication:** The "View on Sheet" button in Plan Info (navigate from schedule back to the plan) is more important than the schedule list itself. Prioritize the callout-to-schedule linking (tap callout → see schedule row for this element) over standalone schedule browsing. Plan Info is the supporting cast, not the lead.

### Insight 6: The sub/inspector access model (view-only link, no account) addresses a real adoption barrier

Danny's frustration ("I'm not creating another account") represents an entire segment that will never install an app. The view-only link sharing model lets Danny access plans without creating an account, which means Sarah can share plans with 5 subs without fighting 5 adoption battles. This is the viral loop for SiteLink: Sarah buys it, shares plans with subs via link, subs experience the value, some upgrade on their own projects.

**Implication:** Invest early in the shared link viewer quality. If the shared link experience is a degraded web view, the viral loop dies. Make it fast, make it work on old phones, and make it feel like "the plans work better here than in the PDF my GC usually emails me."

---

## Recommendations

| Priority | Recommendation | Related Insight | Confidence |
|----------|---------------|-----------------|------------|
| 1 | Frame product as "plans that link themselves" — hide the AI | Insight 1 | High |
| 2 | Validate "no task management" with buyer persona interviews during beta | Insight 2 | High |
| 3 | Promote photos per user per day as leading retention metric | Insight 3 | High |
| 4 | Invest in shared link viewer quality as viral loop driver | Insight 6 | High |
| 5 | Prioritize callout → schedule row linking over standalone Plan Info browse | Insight 5 | Medium |
| 6 | Design voice note onboarding as a prompted behavior (not passive discovery) | Theme 6 | Medium |
| 7 | Run pricing sensitivity test early — $79 may limit adoption among paper-only segment | Insight 2 | Medium |

### Recommendation Details

**1. Frame Product as "Plans That Link Themselves"**

Drop all AI/ML language from user-facing surfaces. The app store listing, onboarding, and marketing should never say "AI-powered detection" — they should say "Tap any callout to jump to the detail. Works offline." Workers don't want to know how the sausage is made. They want the plans to feel smart.

**Next steps:** Audit all copy for AI/ML references. Replace with outcome-focused language. Exception: confidence indicators for Rosa (inspector) persona should remain — she needs to know the system's certainty level.

**2. Validate Task Management Decision with Buyer Interviews**

The research supports the decision, but the sample is skewed toward field workers (who love simplicity) over buyers (who compare feature lists). Recruit 10 GC owners (Sarah persona) during beta. Ask specifically: "What features would prevent you from subscribing?" If >30% say task management, design a minimal "issues log" that captures flagged photos as action items without becoming a task management system.

**Next steps:** Create beta interview guide focused on the buyer decision process. Include question: "If your workers loved this app but it lacked [X], would you still subscribe?"

**3. Promote Photo Documentation as Retention Mechanism**

Track "photos per active user per day" from day 1. Target >3 photos/day within 1 month. If adoption is low, investigate whether the camera link from callout action sheet is discoverable enough. Consider an onboarding prompt: "Take a photo of your first inspection point — it'll be linked to this location on the plans forever."

**Next steps:** Add prominent camera CTA in callout action sheet. Ensure photo timeline is featured in the main navigation, not buried in a sub-menu.

---

## Overall Assessment

### Where the Solution Is Strong

| Aspect | Alignment with Research | Confidence |
|--------|------------------------|------------|
| Core problem (multi-sheet navigation) | Direct match to #1 pain point across all 24 participants | Very High |
| Simplicity philosophy ("5 things well") | Matches the complexity rejection observed universally | Very High |
| Photo organization model | Fits existing behavior (already taking photos) | Very High |
| Offline architecture (LiveStore + local SQLite) | Matches non-negotiable field requirement | Very High |
| Provenance/trust design ("[View] source") | Matches verification behavior observed in foremen and inspectors | High |
| Pricing ($79 flat vs per-user) | Clear competitive advantage; aligns with Sarah's cost sensitivity | High |
| AI daily summary | Directly addresses Sarah's 45-min daily report pain | High |

### Where the Solution Has Risk

| Risk | Severity | Mitigation |
|------|----------|------------|
| "No task management" as sales objection from buyer persona | Medium | Beta buyer interviews; "issues log" fallback design |
| Voice note adoption is unproven behavior change | Medium | Prompted onboarding; Experiment 5 (push notification) |
| 91.5% recall may not be perceived as "accurate enough" by workers | Medium | Experiment 2 (confidence threshold A/B test); error reporting loop |
| $79 price may be high for paper-only segment | Medium | Experiment 4 (pricing sensitivity); launch pricing promotion |
| Single-trade focus (structural) may limit TAM | Low | Electrical (Mike) and plumbing (Danny) personas already in research; same core need |
| LiveStore pre-release stability | High | Pin version; abstraction layer; fallback plan documented in 06-implementation.md |

### AI Features: Solving Real Problems vs. Assumed Problems

| AI Feature | Real Problem? | Evidence Strength |
|------------|---------------|-------------------|
| **Callout detection (YOLO)** | YES — #1 pain point, universal | Very Strong (24/24) |
| **Photo auto-organization** | YES — existing behavior, no organization system | Strong (18/24) |
| **Voice transcription (Whisper)** | LIKELY — physical constraint is real, adoption unproven | Moderate (13/24) |
| **Daily summary generation (LLM)** | YES — 45-min nightly pain for Sarah | Strong (for buyer persona) |
| **Schedule extraction (DocLayout + Gemini)** | PARTIAL — location-first queries more natural than schedule browse | Moderate (contextual value) |
| **Plan Assistant (voice queries)** | ASSUMED — no participant spontaneously requested conversational plan queries | Low (Phase 2, needs validation) |
| **Photo intelligence (planned)** | ASSUMED — sounds valuable, no field evidence yet | Low (future feature) |

---

## Appendix

### Methodology Notes

This synthesis is based on 24 structured interviews and 12 site visits conducted by the Product Team in late 2025 through January 2026. Participants span 5 trades (rebar, electrical, plumbing, general contracting, inspection) across 3 metro areas (Denver, Seattle, Phoenix). The research focused on small contractors (1-20 person companies) in structural construction.

Interviews were semi-structured, covering: current workflow for plan navigation, photo documentation practices, software adoption history, barriers to tool adoption, and reactions to specific solution concepts.

### Limitations

- **Geographic concentration:** All research in western US (Denver, Seattle, Phoenix). East coast, midwest, and rural contractors may differ.
- **Sample size:** 24 interviews and 12 site visits. While themes are consistent, this may not represent the full diversity of structural contractors (residential vs. commercial vs. infrastructure).
- **No beta data:** All findings are pre-product. Real-world adoption may diverge from stated preferences ("say vs. do" gap).
- **Buyer persona underrepresented:** Only 3 of 24 participants (Sarah + 2 others) were GC owners who make purchasing decisions. The rest were field workers who use but don't buy tools.
- **Competitor accuracy unknown:** SiteLink's 91.5% recall claim cannot be validated against competitors, who do not publish their accuracy metrics.
- **Voice adoption is inference:** No participant currently uses voice memos for work. The voice feature appeal is based on the observed physical constraint (gloves), not demonstrated demand.
- **No pricing validation:** The $79 price point has not been tested with any participant. Reactions are assumed based on competitive pricing analysis, not direct feedback.

### Raw Notes

Detailed field research notes are in `02-users.md`, Section 8 (Appendix: Field Research Notes). Participant profiles are in Section 3 (User Personas).
