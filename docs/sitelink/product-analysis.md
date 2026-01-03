# SiteLink Product Analysis & MVP Definition
## Prepared: January 3, 2026

---

## Executive Summary

**Critical Finding:** SiteLink's automatic callout detection is **NOT a differentiator** - Fieldwire, PlanGrid/Autodesk Build, and Procore all have automatic sheet hyperlinking via OCR. However, SiteLink's implementation may be more accurate/robust due to the two-stage geometric + LLM validation pipeline (91.5% recall vs. competitors' undocumented accuracy).

**Market Position:** SiteLink targets the same "small contractor" segment as Fieldwire's free tier. The realistic opportunity is:
1. **Price advantage** - undercut Fieldwire Pro ($39-54/user/month)
2. **Simplicity advantage** - less complexity than Autodesk Build
3. **AI-native features** - future differentiation through photo intelligence, voice-to-task, etc.

**Technical Foundation:** SiteLink is built on a **local-first architecture using LiveStore**, providing offline-first capabilities with automatic sync, event sourcing for audit trails, and reactive SQLite for instant queries.

---

## Phase 1: Architecture Overview

### Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Mobile App** | Expo (React Native) | Cross-platform mobile |
| **State Management** | LiveStore | Local-first reactive data layer |
| **Local Database** | expo-sqlite (via LiveStore) | Offline storage + queries |
| **Sync Backend** | Cloudflare Workers + Durable Objects | Event synchronization |
| **File Storage** | Cloudflare R2 | Plan images, photos, audio |
| **Auth** | Better-Auth | OAuth + session management |
| **Payments** | Polar | Subscription billing |
| **OCR/Detection** | PaddleOCR + OpenCV | Marker detection pipeline |
| **AI** | Whisper, Gemini 2.0 Flash | Transcription, summaries |

### LiveStore Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      MOBILE APP (Expo)                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                    LiveStore                          │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐  │  │
│  │  │   Events    │  │ Materializers│  │  SQLite DB   │  │  │
│  │  │  (writes)   │─▶│  (reducers)  │─▶│   (state)    │  │  │
│  │  └─────────────┘  └─────────────┘  └──────────────┘  │  │
│  │         │                                    │        │  │
│  │         │         ┌─────────────┐           │        │  │
│  │         │         │  Reactive   │◀──────────┘        │  │
│  │         │         │   Queries   │                    │  │
│  │         │         └─────────────┘                    │  │
│  │         │                │                           │  │
│  │         ▼                ▼                           │  │
│  │  ┌─────────────────────────────────────────────────┐│  │
│  │  │              React Components                   ││  │
│  │  └─────────────────────────────────────────────────┘│  │
│  └──────────────────────────────────────────────────────┘  │
│                            │                                │
│                            │ sync (when online)             │
│                            ▼                                │
└────────────────────────────┼────────────────────────────────┘
                             │
┌────────────────────────────┼────────────────────────────────┐
│                    CLOUDFLARE                               │
├────────────────────────────┼────────────────────────────────┤
│                            ▼                                │
│  ┌──────────────────────────────────────────────────────┐  │
│  │            LiveStore Sync Backend                     │  │
│  │  ┌─────────────────┐    ┌─────────────────┐          │  │
│  │  │ Durable Objects │    │   DO SQLite     │          │  │
│  │  │  (WebSockets)   │◀──▶│   (event log)   │          │  │
│  │  └─────────────────┘    └─────────────────┘          │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────┐    ┌──────────────────┐              │
│  │   Workers API    │    │       R2         │              │
│  │   (Effect-TS)    │    │  (Files/Blobs)   │              │
│  └──────────────────┘    └──────────────────┘              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Why LiveStore?

| Benefit | How It Helps SiteLink |
|---------|----------------------|
| **Offline-first** | Field workers have poor connectivity; works fully offline |
| **Event sourcing** | Built-in audit trail: "who did what when" for construction docs |
| **Reactive queries** | UI updates instantly when data changes |
| **Automatic sync** | Events queue locally, sync when online - no manual sync code |
| **Conflict resolution** | Handles concurrent edits from multiple devices |
| **SQL queries** | Familiar SQL-like query syntax |

---

## Phase 2: Competitive Research

### Fieldwire (Primary Competitor)

**Pricing (2025):**
| Tier | Price | Limits |
|------|-------|--------|
| Basic (Free) | $0 | 5 users, 3 projects, 100 sheets |
| Pro | $39-54/user/mo | Unlimited sheets/projects |
| Business | $49-74/user/mo | Custom forms, BIM viewer |
| Business Plus | $89-104/user/mo | API, SSO |

**User Complaints (G2, Capterra):**
- Forms are not pre-designed to industry standards
- System can be slow/unresponsive
- Learning curve for new users
- Mobile app has fewer features than web

### Competitive Feature Matrix

| Feature | SiteLink | Fieldwire | Autodesk Build | Procore |
|---------|----------|-----------|----------------|---------|
| **Auto Sheet Linking** | ✅ 91.5% recall | ✅ | ✅ | ✅ |
| **Plan Viewing** | ✅ | ✅ | ✅ | ✅ |
| **Offline Support** | ✅ Full (LiveStore) | ✅ Full | ⚠️ Partial | ✅ Full |
| **Photo Capture** | ✅ | ✅ | ✅ | ✅ |
| **Task Management** | ❌ (by design) | ✅ | ✅ | ✅ |
| **Voice Notes** | ✅ + Transcription | ❌ | ❌ | ❌ |
| **AI Summaries** | ✅ | ❌ | ⚠️ Basic | ❌ |
| **Price (5 users)** | $79/mo flat | $195-270/mo | $675/mo | $375+/mo |

---

## Phase 3: Data Model (LiveStore Events)

### Event Definitions

```typescript
// packages/domain/src/events.ts
import { Events, Schema } from '@livestore/livestore'

export const events = {
  // Project events
  projectCreated: Events.synced({
    name: 'v1.ProjectCreated',
    schema: Schema.Struct({
      id: Schema.String,
      name: Schema.String,
      address: Schema.optional(Schema.String),
    }),
  }),
  
  // Photo events
  photoCaptured: Events.synced({
    name: 'v1.PhotoCaptured',
    schema: Schema.Struct({
      id: Schema.String,
      projectId: Schema.String,
      markerId: Schema.optional(Schema.String),
      localPath: Schema.String,
      isIssue: Schema.Boolean,
      capturedAt: Schema.Date,
    }),
  }),
  
  photoMarkedAsIssue: Events.synced({
    name: 'v1.PhotoMarkedAsIssue',
    schema: Schema.Struct({ photoId: Schema.String }),
  }),
  
  photoLinkedToMarker: Events.synced({
    name: 'v1.PhotoLinkedToMarker',
    schema: Schema.Struct({
      photoId: Schema.String,
      markerId: Schema.String,
    }),
  }),
  
  // Voice note events
  voiceNoteRecorded: Events.synced({
    name: 'v1.VoiceNoteRecorded',
    schema: Schema.Struct({
      id: Schema.String,
      photoId: Schema.String,
      localPath: Schema.String,
      durationSeconds: Schema.Number,
    }),
  }),
  
  voiceNoteTranscribed: Events.synced({
    name: 'v1.VoiceNoteTranscribed',
    schema: Schema.Struct({
      voiceNoteId: Schema.String,
      transcription: Schema.String,
    }),
  }),
}
```

### State Tables (Derived from Events)

```typescript
// packages/domain/src/tables.ts
import { State, Schema } from '@livestore/livestore'

export const tables = {
  projects: State.SQLite.table({
    name: 'projects',
    columns: {
      id: State.SQLite.text({ primaryKey: true }),
      name: State.SQLite.text(),
      address: State.SQLite.text({ nullable: true }),
      createdAt: State.SQLite.integer({ schema: Schema.DateFromNumber }),
    },
  }),
  
  photos: State.SQLite.table({
    name: 'photos',
    columns: {
      id: State.SQLite.text({ primaryKey: true }),
      projectId: State.SQLite.text(),
      markerId: State.SQLite.text({ nullable: true }),
      localPath: State.SQLite.text(),
      remotePath: State.SQLite.text({ nullable: true }),
      isIssue: State.SQLite.boolean({ default: false }),
      capturedAt: State.SQLite.integer({ schema: Schema.DateFromNumber }),
    },
  }),
  
  voiceNotes: State.SQLite.table({
    name: 'voice_notes',
    columns: {
      id: State.SQLite.text({ primaryKey: true }),
      photoId: State.SQLite.text(),
      localPath: State.SQLite.text(),
      durationSeconds: State.SQLite.integer({ nullable: true }),
      transcription: State.SQLite.text({ nullable: true }),
    },
  }),
}
```

---

## Phase 4: Pricing & Business Model

### SiteLink Pricing

| Tier | Price | Projects | Users | Features |
|------|-------|----------|-------|----------|
| **Trial** | Free 14 days | 2 | 5 | Full Pro access |
| **Starter** | $29/mo | 1 | 3 | Core (no AI features) |
| **Pro** | $79/mo | 5 | 15 | + Voice, Search, Summaries |
| **Business** | $149/mo | Unlimited | Unlimited | + RFI, API, Priority Support |

---

## Phase 5: MVP Phasing

### Phase 1: Core MVP (Weeks 1-4)
- LiveStore integration with Expo + Cloudflare sync backend
- OAuth sign-in, project creation
- Plan upload + processing pipeline
- Sheet viewer with callout markers
- Camera with callout linking, issue toggle
- Photo timeline per callout
- Voice note recording (audio only)
- Basic project sharing (view-only link)
- Polar payment integration

### Phase 2: AI Features (Weeks 5-8)
- Voice note transcription (Whisper)
- Plan text search (full-text index)
- Photo text extraction (OCR)
- Daily summary generation (LLM)
- Share daily report (hosted page + PDF)

### Phase 3: Polish & Growth (Weeks 9-12)
- Team member invitation
- Notification system (push)
- RFI draft generation
- Performance optimization
- Analytics integration (PostHog)

---

## Honest Assessment

### SiteLink's Real Position

**Strengths:**
1. Modern local-first architecture (LiveStore + Cloudflare)
2. Sophisticated marker detection (91.5% recall)
3. 80% cheaper than competitors
4. Event sourcing = built-in audit trail
5. True offline-first (not just caching)

**Weaknesses:**
1. No task management (by design)
2. Simpler annotations than competitors
3. No proven market traction yet
4. Auto-linking is NOT unique

**What Makes SiteLink Defensible:**
1. **Superior accuracy** - Prove marker detection beats competitors
2. **Speed** - 60-second setup vs 30+ minutes
3. **AI features** - Voice transcription, summaries that competitors lack
4. **Price** - Significantly cheaper
5. **Simplicity** - "It just works" without training
6. **Audit trail** - Event sourcing shows exactly what happened when