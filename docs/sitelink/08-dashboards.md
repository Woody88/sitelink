# 08 - Dashboard Requirements

**Status:** Draft
**Last Updated:** February 2026

---

## 1. Overview

Three reporting surfaces, two operational dashboards and one strategic report, give different audiences the data they need at the cadence they need it.

| Surface | Audience | Cadence | Platform |
|---|---|---|---|
| Product Health Dashboard | Product team, founder | Daily | PostHog |
| AI Pipeline Health Dashboard | Engineering team | Weekly (alerts: real-time) | PostHog + Cloudflare |
| Weekly Business Report | Founder, advisors | Monday morning | Auto-generated email / Discord |

All metrics derive from PostHog events defined in `06-instrumentation.md`. No additional tracking is required beyond what that document specifies.

---

## 2. Product Health Dashboard

**Audience:** Product team, founder
**Review Cadence:** Daily
**Platform:** PostHog dashboard

### 2.1 Key Questions This Dashboard Answers

- Are users engaging with core features?
- Where do users drop off in onboarding?
- Is offline usage growing?
- Are trial users converting?

### 2.2 Metrics & Visualizations

| Metric | Chart Type | Breakdown | Data Source |
|---|---|---|---|
| Daily/Weekly Active Users | Line chart (7d trend) | By subscription tier | `session_started` |
| Onboarding Funnel | Funnel chart | `signup_started` -> `signup_completed` -> `project_created` -> `plans_uploaded` -> `sheet_viewed` -> `callout_tapped` | Multiple events |
| Trial Conversion Rate | Single number + trend | 7-day rolling | `trial_started` -> `subscription_activated` |
| Feature Adoption Heatmap | Table with sparklines | `callout_tapped`, `photo_captured`, `voice_note_recorded`, `plan_info_viewed`, `daily_summary_generated` | Event counts per feature |
| Callout Taps per Session | Line chart (7d avg) | By `callout_type` | `callout_tapped` |
| Photos per Active User per Day | Line chart | By `is_linked`, `is_issue` | `photo_captured` |
| Plan Info Discovery Rate | Percentage | % of users who view Plan Info in first week | `plan_info_viewed` |
| Offline vs Online Sessions | Stacked area chart | -- | `offline_mode_entered` / `session_started` ratio |
| DAU/MAU Ratio | Single number + trend | -- | `session_started` |
| Session Length Distribution | Histogram | -- | `session_ended.duration_seconds` |

### 2.3 Filters

| Filter | Values | Default |
|---|---|---|
| Date range | Any range | Last 7 days |
| Subscription tier | All, Starter, Pro, Business, Trial | All |
| Platform | iOS, Android | All |
| Is first week | true / false | Not applied |

The "Is first week" filter enables activation-specific analysis: apply it to the Onboarding Funnel and Plan Info Discovery Rate to isolate new-user behavior from power-user noise.

---

## 3. AI Pipeline Health Dashboard

**Audience:** Engineering team
**Review Cadence:** Weekly (alerts trigger immediately)
**Platform:** PostHog dashboard + Cloudflare analytics

### 3.1 Key Questions

- Is processing reliable?
- Are extraction quality metrics holding?
- What is pipeline cost per plan?

### 3.2 Metrics & Visualizations

| Metric | Chart Type | Data Source |
|---|---|---|
| Processing Success Rate | Single number (%) + trend | `plans_processing_completed` / `plans_processing_started` |
| Processing Failure Rate by Error Type | Stacked bar | `plans_processing_failed.error_type` |
| Processing Latency (P50 / P95) | Line chart | `plans_processing_completed.duration_seconds` |
| Callout Detection Accuracy (user-reported) | Line chart | User error reports / total `callout_tapped` |
| Schedule Extraction Confidence Distribution | Histogram | `schedule_detail_viewed.confidence` |
| LLM Cost per Plan (estimated) | Line chart | Calculated: `pages * cost_per_page` per plan |
| Voice Transcription Latency | Line chart (P50 / P95) | `voice_note_transcribed.latency_seconds` |
| Voice Transcription Failure Rate | Single number + trend | `voice_note_transcription_failed` / `voice_note_recorded` |
| Sync Success Rate | Single number | `sync_completed` / (`sync_completed` + `sync_failed`) |
| Daily Summary Generation Success Rate | Single number | `daily_summary_generated` / (`daily_summary_generated` + `daily_summary_failed`) |

### 3.3 Alerts

| Alert | Trigger | Channel | Severity |
|---|---|---|---|
| Processing failure spike | Failure rate > 5% over 1 hour | Slack/Discord + email | P1 |
| Processing latency degradation | P95 > 2x baseline | Discord | P2 |
| Sync failures | Failure rate > 2% over 1 hour | Discord | P1 |
| Voice transcription failures | Failure rate > 10% over 24 hours | Email | P2 |
| Daily summary failures | Any failure | Email | P3 |

Alert configuration notes:

- **Baselines** are computed from the rolling 7-day median at the same hour-of-day. "2x baseline" means 2x that median.
- **P1 alerts** page on-call immediately. P2 alerts create a ticket and notify the channel. P3 alerts batch into the weekly report unless they persist for 48 hours, at which point they escalate to P2.
- All alerts include a direct link to the relevant PostHog insight for one-click investigation.

---

## 4. Weekly Business Report

**Audience:** Founder, advisors
**Review Cadence:** Weekly (Monday morning)
**Format:** Auto-generated email or Discord message

### 4.1 Contents

| Line Item | Comparison | Source Events |
|---|---|---|
| New signups this week | vs last week (absolute + %) | `signup_completed` |
| Trial conversions this week | vs last week | `subscription_activated` |
| MRR trend | 4-week sparkline | `subscription_activated`, `subscription_cancelled` |
| Top 3 feature adoption metrics | Week-over-week change | Highest-count events from Feature Adoption Heatmap |
| Active projects count | vs last week | `project_created` (cumulative minus deleted) |
| Plans processed this week | vs last week | `plans_processing_completed` |
| Churned users | List of users | `subscription_cancelled` |

The report is a plain-text summary with inline numbers. No charts; it must be readable in email and Discord without rendering issues.

### 4.2 Generation

Trigger a PostHog scheduled query every Monday at 06:00 UTC. Format the output as a structured message and deliver via:

1. Email to the distribution list.
2. Discord webhook to the `#metrics` channel.

If PostHog's scheduled export does not support the desired format, use a Cloudflare Worker on a cron trigger that queries the PostHog API and posts the formatted message.

---

## 5. Baseline Establishment

Before launch, establish these industry baselines. Targets represent goals for post-launch milestones.

| Metric | Industry Baseline | SiteLink Target | Timeline |
|---|---|---|---|
| 30-Day Retention | ~30% (construction field apps) | > 70% | 6 months post-launch |
| DAU/MAU | ~25% (field apps) | > 60% | 3 months post-launch |
| Time to First Sheet View | ~15 min (Fieldwire setup) | < 2 min | Launch day |
| Trial-to-Paid Conversion | ~5% (SaaS average, no-CC trial) | > 10% | 3 months post-launch |
| NPS | ~30 (construction software average) | > 50 | 6 months post-launch |
| Photos per active user/day | N/A (new metric) | > 3 | 1 month post-launch |
| Callout taps per session | N/A (new metric) | > 5 | 1 month post-launch |

### 5.1 How to Establish Baselines

1. **Pre-launch (beta period):** Collect at least 2 weeks of data from beta testers. Use medians, not means, to avoid skew from power users.
2. **Week 1 post-launch:** Snapshot all metrics above as the "Day 0 baseline."
3. **Monthly review:** Compare current metrics against Day 0 baseline and industry baseline. Adjust targets if initial assumptions were wrong.

Baselines are stored as PostHog annotations so they render directly on trend charts.

---

## 6. Implementation Checklist

| Step | Owner | Dependency |
|---|---|---|
| Verify all referenced events emit correctly | Engineering | `06-instrumentation.md` events instrumented |
| Create Product Health dashboard in PostHog | Product | Events emitting |
| Create AI Pipeline Health dashboard in PostHog | Engineering | Events emitting |
| Configure P1/P2/P3 alert rules | Engineering | Pipeline dashboard exists |
| Build weekly report query + delivery (Worker or PostHog export) | Engineering | Events emitting |
| Establish Day 0 baselines | Product + Engineering | 2 weeks of beta data |
| First weekly review meeting | All | Dashboards live |
