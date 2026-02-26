# 07 - Experiment Designs

## 1. Overview

These experiments validate core product hypotheses before and after launch. Each follows a standard format to ensure rigor and reproducibility:

| Field | Description |
|---|---|
| **Hypothesis** | Falsifiable statement linking a change to an expected outcome |
| **Primary Metric** | Single metric that determines success or failure |
| **Secondary Metrics** | Supporting signals that add context |
| **Guardrail Metric** | Must not regress beyond tolerance |
| **Variants** | Control (A) and Treatment (B) definitions |
| **Sample Size** | Per-variant count, calculated for 80% power at 5% significance |
| **Duration** | Minimum calendar time to collect sample and account for weekly patterns |
| **Success Criteria** | Threshold the primary metric must clear |
| **Risks** | What could go wrong, with mitigations |

All experiments require analytics instrumentation to be in place before launch (see `06-instrumentation.md`). Results are appended to each experiment section after completion.

---

## 2. Pre-Launch Experiments

### Experiment 1: Onboarding Path (Demo-First vs Upload-First)

**Hypothesis:** Showing the demo project first (before asking for upload) will increase the signup-to-first-upload rate because users see value before committing effort.

**Primary Metric:** `plans_uploaded` within 24 hours of `signup_completed`

**Secondary Metrics:**

| Metric | Description |
|---|---|
| `demo_project_opened` | Whether user opened the demo project |
| `onboarding_completed` | Whether user finished the onboarding flow |
| Time to first `callout_tapped` | Seconds from signup to first callout interaction |

**Guardrail Metric:** Day 7 retention (should not decrease)

**Variants:**

| Variant | Name | Description |
|---|---|---|
| A (Control) | Upload-first | Trial Start screen offers "Upload Your First Plans" as primary CTA. "Explore the demo project" is a secondary text link below. |
| B (Treatment) | Demo-first | After signup, auto-open the demo project. Show "Upload Your Plans" banner after user taps 3+ callouts. |

**Sample Size:** 200 users per variant (80% power, 5% significance, expected 15% lift)

**Duration:** 4 weeks or until sample reached

**Success Criteria:** Treatment B achieves >15% relative increase in 24-hour upload rate

**Risks:**
- Demo-first users may think the app only works with demo data.
- **Mitigation:** Clear banner text: "These are sample plans. Upload your own to get started."

---

### Experiment 2: Callout Confidence Threshold

**Hypothesis:** Hiding callouts with confidence <80% (instead of showing them with yellow/orange warnings) will increase successful navigation rate because users won't tap unreliable links.

**Primary Metric:** Navigation success rate (user taps callout and spends >5 seconds on target sheet)

**Secondary Metrics:**

| Metric | Description |
|---|---|
| Total `callout_tapped` events per session | Volume of callout interactions |
| User-reported errors | In-app "report wrong link" submissions |

**Guardrail Metric:** Total `callout_navigated` events (should not decrease by more than 5%)

**Variants:**

| Variant | Name | Callout Display Rules |
|---|---|---|
| A (Control) | Show all | Confidence >=90%: green. 80-89%: yellow. <80%: orange with "verify on drawing" label. |
| B (Treatment) | Hide low-confidence | Hide callouts with confidence <80%. Show >=80% only. Add "Show all markers" toggle in the overflow menu. |

**Sample Size:** 150 users per variant

**Duration:** 3 weeks

**Success Criteria:** Navigation success rate increases >10% without >5% decrease in total navigations

**Risks:**
- Users may miss legitimate callouts hidden below threshold.
- **Mitigation:** "Show all markers" toggle available in overflow menu so power users can still access everything.

---

### Experiment 3: Plan Info Entry Point

**Hypothesis:** Adding a red badge count to the "Plan Info" tab (showing the number of extracted items) will increase Plan Info discovery rate because users notice badge indicators.

**Primary Metric:** `plan_info_viewed` within first 3 sessions

**Secondary Metrics:**

| Metric | Description |
|---|---|
| `schedule_detail_viewed` | Whether user drilled into a schedule |
| `view_on_sheet_tapped` | Whether user navigated from Plan Info back to the sheet |

**Guardrail Metric:** Overall session length (should not decrease)

**Variants:**

| Variant | Name | Tab Appearance |
|---|---|---|
| A (Control) | No badge | "Plan Info" tab label only, no indicator |
| B (Treatment) | Badge count | "Plan Info" tab with red badge showing total count (e.g., "8" for 4 schedules + 2 notes + 2 legends) |

**Sample Size:** 100 users per variant

**Duration:** 2 weeks

**Success Criteria:** Plan Info discovery rate increases >20% relative

**Risks:**
- Badge fatigue if users cannot dismiss it.
- **Mitigation:** Badge only appears on the first project and clears after the first tap.

---

## 3. Post-Launch Experiments

### Experiment 4: Pricing Sensitivity

**Hypothesis:** A $49/month Pro tier (vs $79) will increase trial-to-paid conversion by >30% relative, generating more total revenue despite lower per-user price.

**Primary Metric:** Trial-to-paid conversion rate

**Secondary Metrics:**

| Metric | Description |
|---|---|
| Revenue per signup | Total revenue divided by number of signups in cohort |
| Average lifetime value | Projected LTV based on churn rate at 8-week mark |

**Guardrail Metric:** Feature usage per paying user (ensure low-price users still engage meaningfully)

**Variants:**

| Variant | Name | Pro Tier Price | Features |
|---|---|---|---|
| A (Control) | Standard pricing | $79/month | Full Pro feature set |
| B (Treatment) | Lower pricing | $49/month | Same full Pro feature set |

**Sample Size:** 300 users per variant (large sample needed for revenue impact measurement)

**Duration:** 8 weeks (full trial cycle + 2 weeks of paid usage observation)

**Success Criteria:** Total revenue per 100 signups is higher in Treatment B than Control A

**Risks:**
- Cannot easily raise price after lowering it publicly.
- **Mitigation:** Run as a limited-time promotion ("Launch pricing: $49/month") so the $79 price remains the listed default.

---

### Experiment 5: Daily Summary Reminder

**Hypothesis:** A 5 PM push notification reminder ("Ready to generate today's summary? 12 photos captured.") will increase daily summary usage by >50%.

**Primary Metric:** `daily_summary_generated` events per week per user

**Secondary Metrics:**

| Metric | Description |
|---|---|
| Push notification open rate | Taps on the reminder notification |
| `daily_summary_shared` events | Summaries forwarded to foremen or GCs |

**Guardrail Metric:** Notification opt-out rate (should stay <10%)

**Variants:**

| Variant | Name | Reminder Behavior |
|---|---|---|
| A (Control) | Reminder off | Daily summary reminder OFF by default (current behavior) |
| B (Treatment) | Reminder on | Daily summary reminder ON by default at 5 PM local time, personalized with photo count |

**Sample Size:** 100 users per variant

**Duration:** 3 weeks

**Success Criteria:** Summary generation increases >50% relative

**Risks:**
- Notification fatigue leading to app-level notification disabling.
- **Mitigation:** Easy one-tap disable directly from the notification. Reminder auto-disables after 3 consecutive ignores.

---

## 4. Experiment Governance

| Rule | Detail |
|---|---|
| **Instrumentation prerequisite** | All experiments require analytics events to be instrumented and validated in staging before the experiment launches. |
| **Minimum run time** | 2 weeks, to account for weekday/weekend usage patterns in construction. |
| **No metric collisions** | No two experiments may run simultaneously if they affect the same primary or guardrail metric. |
| **Review before shipping** | Results reviewed with full team (product, engineering, design) before the winning variant ships to 100%. |
| **Documentation** | Append results to each experiment section in this file, including actual sample sizes, p-values, and the decision made. |
| **Rollback plan** | Every treatment must have a feature flag that allows instant revert to control behavior. |

### Results Template

When an experiment concludes, add a `### Results` subsection under the experiment with:

```
### Results (YYYY-MM-DD)

**Status:** Winner / No significant difference / Stopped early
**Actual sample:** N per variant
**Primary metric:**
  - Control: X%
  - Treatment: Y%
  - Relative lift: Z% (p = 0.0XX)
**Guardrail check:** [metric] stayed within tolerance (Control: X, Treatment: Y)
**Decision:** Ship Treatment / Keep Control / Redesign and re-run
**Notes:** [Any unexpected observations or follow-up experiments needed]
```
