# SiteLink Analytics Instrumentation Spec

**Version:** 1.0
**Date:** February 2026
**Document Type:** Instrumentation Specification
**Analytics Platform:** PostHog (React Native SDK)

---

## Table of Contents

1. [Overview](#1-overview)
2. [Event Taxonomy](#2-event-taxonomy)
3. [User Properties](#3-user-properties)
4. [PII & Privacy](#4-pii--privacy)
5. [Key Funnels to Track](#5-key-funnels-to-track)
6. [Implementation Notes](#6-implementation-notes)

---

## 1. Overview

### Why Instrument from Day 1

The current product roadmap (`03-product.md`, Section 11.3) places PostHog integration in Phase 3 (Weeks 9-12). This spec recommends moving analytics to Phase 1 for three reasons:

1. **You cannot measure success metrics you are not tracking.** The activation rate target (>60% of signups upload plans within 7 days) requires instrumentation from the first user session.
2. **Funnel bottlenecks are invisible without data.** If users sign up but never upload plans, we need to know where they drop off before building more features.
3. **PostHog's React Native SDK is lightweight.** Integration cost is roughly one day of engineering work for the base setup, with incremental effort per event thereafter.

### Analytics Platform

PostHog was selected for its self-hostable option, feature flag support, session recording capabilities, and transparent pricing. We use the PostHog React Native SDK (`posthog-react-native`).

### Event Naming Convention

All events use `snake_case` in `verb_noun` format:

- `sheet_viewed` (not `SheetViewed`, not `view-sheet`)
- `photo_captured` (not `PhotoCaptured`, not `capture-photo`)
- Properties also use `snake_case`: `file_size_mb`, `is_offline`, `duration_seconds`

Boolean properties are prefixed with `is_` or `has_` where grammatically natural. Temporal properties use `_seconds` or `_ms` suffixes to specify units.

---

## 2. Event Taxonomy

### 2.1 Session & App Lifecycle

| Event | Properties | Purpose |
|-------|------------|---------|
| `app_opened` | `is_offline: boolean`, `app_version: string` | Measure installs and offline usage patterns |
| `session_started` | `is_first_session: boolean`, `subscription_tier: string` | Segment behavior by subscription status |
| `session_ended` | `duration_seconds: number`, `events_count: number` | Measure session depth and engagement |

### 2.2 Onboarding

| Event | Properties | Purpose |
|-------|------------|---------|
| `signup_started` | `auth_method: "google" \| "microsoft" \| "email"` | Top of onboarding funnel |
| `signup_completed` | `auth_method: string` | Signup completion rate by method |
| `trial_started` | (none) | Trial activation |
| `demo_project_opened` | (none) | Measure demo path usage |
| `onboarding_completed` | `path: "upload" \| "demo"` | Onboarding completion and path split |

### 2.3 Project Management

| Event | Properties | Purpose |
|-------|------------|---------|
| `project_created` | `has_address: boolean` | Project setup behavior |
| `plans_uploaded` | `page_count: number`, `file_size_mb: number`, `file_count: number` | Upload characteristics |
| `plans_processing_started` | (none) | Processing pipeline entry |
| `plans_processing_completed` | `duration_seconds: number`, `sheet_count: number`, `callout_count: number` | Pipeline performance and yield |
| `plans_processing_failed` | `error_type: string`, `page_at_failure: number` | Reliability monitoring |

### 2.4 Plan Viewing

| Event | Properties | Purpose |
|-------|------------|---------|
| `sheet_viewed` | `sheet_id: string`, `discipline: string`, `source: "sheet_list" \| "callout_navigation" \| "search" \| "plan_info"` | Navigation patterns and entry points |
| `callout_tapped` | `callout_type: "detail" \| "elevation" \| "title"`, `confidence: number` | Feature engagement and model quality |
| `callout_navigated` | `source_sheet: string`, `target_sheet: string`, `time_on_target_seconds: number` | Cross-sheet navigation depth |
| `sheet_zoomed` | `zoom_level: number` | Zoom behavior for UX tuning |
| `discipline_filter_applied` | `discipline: string` | Filter usage frequency |

### 2.5 Plan Info

| Event | Properties | Purpose |
|-------|------------|---------|
| `plan_info_viewed` | (none) | Feature discovery rate |
| `schedule_detail_viewed` | `schedule_type: string`, `row_count: number`, `confidence: number` | Schedule engagement and extraction quality |
| `schedule_row_tapped` | `mark: string`, `schedule_type: string` | Row-level interaction depth |
| `notes_detail_viewed` | `notes_type: string` | Notes feature usage |
| `legend_detail_viewed` | (none) | Legend feature usage |
| `view_on_sheet_tapped` | `source: "schedule" \| "notes" \| "legend"` | Cross-reference between Plan Info and viewer |
| `region_overlay_tapped` | `region_class: string` | Overlay interaction |

### 2.6 Photo & Voice

| Event | Properties | Purpose |
|-------|------------|---------|
| `photo_captured` | `is_linked: boolean`, `is_issue: boolean`, `has_voice_note: boolean`, `is_offline: boolean` | Core workflow engagement |
| `voice_note_recorded` | `duration_seconds: number`, `is_offline: boolean` | Voice feature adoption |
| `voice_note_transcribed` | `latency_seconds: number`, `word_count: number` | Transcription performance |
| `voice_note_transcription_failed` | `error_type: string` | Transcription reliability |
| `photo_text_extracted` | `text_length: number` | OCR feature usage |

### 2.7 Search

| Event | Properties | Purpose |
|-------|------------|---------|
| `search_performed` | `query_length: number`, `result_count: number`, `is_offline: boolean` | Search usage and effectiveness |
| `search_result_tapped` | `result_position: number`, `sheet_id: string` | Result relevance (lower position = better ranking) |

### 2.8 Daily Summary

| Event | Properties | Purpose |
|-------|------------|---------|
| `daily_summary_generated` | `photo_count: number`, `voice_note_count: number`, `latency_seconds: number` | Summary generation patterns |
| `daily_summary_shared` | `share_method: "link" \| "email" \| "whatsapp" \| "pdf"` | Share method distribution |
| `daily_summary_edited` | (none) | Measure how often AI output needs correction |
| `daily_summary_generation_failed` | `error_type: string` | Generation reliability |

### 2.9 Sharing & Collaboration

| Event | Properties | Purpose |
|-------|------------|---------|
| `project_shared` | `share_type: "view_only_link" \| "team_invite"` | Sharing behavior |
| `shared_link_viewed` | `viewer_has_account: boolean` | Viral loop measurement |
| `team_member_invited` | `role: string` | Team growth patterns |

### 2.10 Subscription

| Event | Properties | Purpose |
|-------|------------|---------|
| `subscription_screen_viewed` | `source: "trial_banner" \| "upgrade_prompt" \| "settings"` | What drives upgrade consideration |
| `plan_selected` | `tier: "starter" \| "pro" \| "business"` | Tier preference |
| `checkout_started` | `tier: string` | Checkout funnel entry |
| `subscription_activated` | `tier: string`, `was_trial: boolean` | Revenue event |
| `subscription_cancelled` | `tier: string`, `days_active: number` | Churn analysis |
| `trial_expired` | `converted: boolean` | Trial-to-paid conversion |
| `payment_failed` | `error_type: string` | Payment reliability |

### 2.11 Offline & Sync

| Event | Properties | Purpose |
|-------|------------|---------|
| `offline_mode_entered` | (none) | Offline frequency |
| `offline_mode_exited` | `offline_duration_seconds: number` | Offline session length |
| `sync_completed` | `events_synced: number`, `photos_synced: number`, `duration_seconds: number` | Sync performance |
| `sync_failed` | `error_type: string` | Sync reliability |
| `offline_download_started` | `project_id: string`, `sheet_count: number` | Proactive offline usage |
| `offline_download_completed` | `size_mb: number`, `duration_seconds: number` | Download performance |

### 2.12 Errors & Performance

| Event | Properties | Purpose |
|-------|------------|---------|
| `error_occurred` | `error_type: string`, `screen: string`, `is_fatal: boolean` | Error monitoring |
| `screen_load_time` | `screen_name: string`, `duration_ms: number` | Performance monitoring |

---

## 3. User Properties

Set these properties on `posthog.identify()` and update them as they change. These enable segmentation across all events without embedding redundant properties in each event payload.

| Property | Type | Description |
|----------|------|-------------|
| `subscription_tier` | `string` | Current tier: `"free"`, `"trial"`, `"starter"`, `"pro"`, `"business"` |
| `team_size` | `number` | Number of team members across all projects |
| `project_count` | `number` | Total projects created by this user |
| `days_since_signup` | `number` | Days elapsed since account creation |
| `is_trial` | `boolean` | Whether user is currently in trial period |
| `total_photos` | `number` | Lifetime photo count |
| `total_voice_notes` | `number` | Lifetime voice note count |
| `device_platform` | `string` | `"ios"` or `"android"` |
| `app_version` | `string` | Semantic version of the installed app |

---

## 4. PII & Privacy

These rules apply to all analytics events and user properties.

| Rule | Detail |
|------|--------|
| No PII in event properties | Names, emails, phone numbers, and physical addresses must never appear in event properties. Use opaque identifiers only. |
| Opaque user ID | User identification uses `nanoid`-generated IDs. PostHog `distinct_id` is set to this opaque ID, never to an email or phone number. |
| No photo content | Photo binary data and image URLs are never sent to PostHog. Only metadata (count, linked status, issue flag) is tracked. |
| No voice note content | Audio data and transcription text are never sent to PostHog. Only metadata (duration, word count, latency) is tracked. |
| GPS coordinate rounding | If GPS coordinates are ever included in an event (not currently planned), they must be rounded to 3 decimal places (~111m precision), sufficient for site-level location without identifying a specific person. |
| Compliance | Follow PostHog's data processing recommendations. Provide opt-out mechanism in app settings per platform guidelines. |

---

## 5. Key Funnels to Track

Configure these as saved funnels in PostHog to monitor continuously.

### 5.1 Onboarding Funnel

Measures the complete path from first touch to core feature engagement.

```
signup_started
  -> signup_completed
    -> trial_started
      -> project_created
        -> plans_uploaded
          -> plans_processing_completed
            -> sheet_viewed
              -> callout_tapped
```

**Target:** >60% of `signup_started` reach `plans_uploaded` within 7 days. >40% reach `callout_tapped` within 7 days.

### 5.2 Activation Funnel

Measures whether users engage with the three features that define an activated user.

```
callout_tapped (first)
  -> photo_captured (first)
    -> callout_navigated (first)
```

**Target:** >30% of users who tap their first callout capture a photo within the same session.

### 5.3 Trial Conversion Funnel

Measures the revenue conversion path.

```
trial_started
  -> subscription_screen_viewed
    -> checkout_started
      -> subscription_activated
```

**Target:** >15% trial-to-paid conversion rate. Measure median days from `trial_started` to `subscription_screen_viewed` to identify optimal nudge timing.

### 5.4 Plan Info Discovery Funnel

Measures engagement with the Plan Info feature (schedule/notes/legend browsing).

```
plan_info_viewed
  -> schedule_detail_viewed
    -> view_on_sheet_tapped
```

**Target:** >50% of `plan_info_viewed` proceed to `schedule_detail_viewed`. >20% complete the full funnel to `view_on_sheet_tapped`.

---

## 6. Implementation Notes

### Move PostHog to Phase 1

The current phasing (`03-product.md`, Section 11.3) places analytics in Phase 3 (Weeks 9-12). This spec recommends adding PostHog setup to Phase 1 (Week 1), alongside LiveStore and Expo integration. The incremental cost is low: install the SDK, initialize in the app entry point, and add events incrementally as each feature ships.

### SDK Setup

Use `posthog-react-native` with the following configuration:

```typescript
import PostHog from "posthog-react-native"

const posthog = new PostHog("<project-api-key>", {
  host: "https://us.i.posthog.com",
  enableSessionReplay: false,
})
```

Wrap the app with `PostHogProvider` at the root level so all screens can access the client.

### Offline Event Batching

PostHog's React Native SDK automatically queues events when the device is offline and flushes them when connectivity returns. No custom batching logic is needed. Verify that `flushAt` and `flushInterval` defaults are acceptable for our usage patterns (default: batch of 20 events or every 30 seconds).

### Event Validation with TypeScript

Define a typed event map so every `posthog.capture()` call is type-checked at build time. This prevents typos in event names and enforces required properties.

```typescript
type AnalyticsEvents = {
  app_opened: { is_offline: boolean; app_version: string }
  session_started: { is_first_session: boolean; subscription_tier: string }
  session_ended: { duration_seconds: number; events_count: number }

  signup_started: { auth_method: "google" | "microsoft" | "email" }
  signup_completed: { auth_method: string }
  trial_started: Record<string, never>
  demo_project_opened: Record<string, never>
  onboarding_completed: { path: "upload" | "demo" }

  project_created: { has_address: boolean }
  plans_uploaded: { page_count: number; file_size_mb: number; file_count: number }
  plans_processing_started: Record<string, never>
  plans_processing_completed: {
    duration_seconds: number
    sheet_count: number
    callout_count: number
  }
  plans_processing_failed: { error_type: string; page_at_failure: number }

  sheet_viewed: {
    sheet_id: string
    discipline: string
    source: "sheet_list" | "callout_navigation" | "search" | "plan_info"
  }
  callout_tapped: {
    callout_type: "detail" | "elevation" | "title"
    confidence: number
  }
  callout_navigated: {
    source_sheet: string
    target_sheet: string
    time_on_target_seconds: number
  }
  sheet_zoomed: { zoom_level: number }
  discipline_filter_applied: { discipline: string }

  plan_info_viewed: Record<string, never>
  schedule_detail_viewed: {
    schedule_type: string
    row_count: number
    confidence: number
  }
  schedule_row_tapped: { mark: string; schedule_type: string }
  notes_detail_viewed: { notes_type: string }
  legend_detail_viewed: Record<string, never>
  view_on_sheet_tapped: { source: "schedule" | "notes" | "legend" }
  region_overlay_tapped: { region_class: string }

  photo_captured: {
    is_linked: boolean
    is_issue: boolean
    has_voice_note: boolean
    is_offline: boolean
  }
  voice_note_recorded: { duration_seconds: number; is_offline: boolean }
  voice_note_transcribed: { latency_seconds: number; word_count: number }
  voice_note_transcription_failed: { error_type: string }
  photo_text_extracted: { text_length: number }

  search_performed: {
    query_length: number
    result_count: number
    is_offline: boolean
  }
  search_result_tapped: { result_position: number; sheet_id: string }

  daily_summary_generated: {
    photo_count: number
    voice_note_count: number
    latency_seconds: number
  }
  daily_summary_shared: {
    share_method: "link" | "email" | "whatsapp" | "pdf"
  }
  daily_summary_edited: Record<string, never>
  daily_summary_generation_failed: { error_type: string }

  project_shared: { share_type: "view_only_link" | "team_invite" }
  shared_link_viewed: { viewer_has_account: boolean }
  team_member_invited: { role: string }

  subscription_screen_viewed: {
    source: "trial_banner" | "upgrade_prompt" | "settings"
  }
  plan_selected: { tier: "starter" | "pro" | "business" }
  checkout_started: { tier: string }
  subscription_activated: { tier: string; was_trial: boolean }
  subscription_cancelled: { tier: string; days_active: number }
  trial_expired: { converted: boolean }
  payment_failed: { error_type: string }

  offline_mode_entered: Record<string, never>
  offline_mode_exited: { offline_duration_seconds: number }
  sync_completed: {
    events_synced: number
    photos_synced: number
    duration_seconds: number
  }
  sync_failed: { error_type: string }
  offline_download_started: { project_id: string; sheet_count: number }
  offline_download_completed: { size_mb: number; duration_seconds: number }

  error_occurred: { error_type: string; screen: string; is_fatal: boolean }
  screen_load_time: { screen_name: string; duration_ms: number }
}

function track<K extends keyof AnalyticsEvents>(
  event: K,
  properties: AnalyticsEvents[K]
) {
  posthog.capture(event, properties)
}
```

### Incremental Rollout

Events do not need to ship all at once. Prioritize instrumentation in this order:

1. **Phase 1 (ship with first build):** `app_opened`, `session_started`, `signup_*`, `trial_started`, `project_created`, `plans_uploaded`, `plans_processing_*`, `error_occurred`, `screen_load_time`
2. **Phase 1 (ship with plan viewer):** `sheet_viewed`, `callout_tapped`, `callout_navigated`, `sheet_zoomed`, `discipline_filter_applied`
3. **Phase 2 (ship with each feature):** Photo, voice, search, daily summary, Plan Info, sharing, and subscription events ship alongside their respective features.
4. **Phase 2 (ship with sync):** `offline_*`, `sync_*` events ship when offline download is implemented.
