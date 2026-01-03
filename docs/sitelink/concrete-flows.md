# SiteLink: Concrete Flows

This document provides specific UI/UX flows with LiveStore implementation details.

---

## 1. Camera UI: Issue Toggle (Final Design)

### Single Shutter with Issue Toggle

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                                                         ││
│  │              [Camera Viewfinder]                        ││
│  │                                                         ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  📍 Linked to: 5/A7 - Electrical Junction    [Change]   ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│                    ┌─────────┐                              │
│                    │    ⚪    │  ← Single shutter (72pt)    │
│                    └─────────┘                              │
│                                                             │
│              ┌──────────────────┐                           │
│              │   ⚠️  Issue      │  ← Toggle button below    │
│              └──────────────────┘     (not selected)        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Interaction Flow

```
USER ACTION                          SYSTEM RESPONSE
─────────────────────────────────────────────────────────────────
1. Opens camera (from Plans tab      Camera opens
   by tapping callout)               "Linked to: 5/A7" shown
                                     Normal mode (white shutter)

2. Taps shutter                      Photo captured as NORMAL
                                     Brief "✓ Saved" toast
                                     Camera stays open for more

3. Taps "Issue" toggle               Toggle highlights RED
                                     Shutter turns RED  
                                     Red banner appears in viewfinder

4. Taps RED shutter                  Photo captured as ISSUE
                                     "⚠️ Issue Photo Saved" toast
                                     Toggle RESETS to off

5. Taps shutter again                Photo captured as NORMAL
                                     (Issue mode auto-reset)
```

### LiveStore Implementation

```typescript
// When user taps shutter
async function capturePhoto(options: {
  projectId: string
  markerId?: string
  isIssue: boolean
  uri: string
}) {
  const id = crypto.randomUUID()
  const localPath = `${FileSystem.documentDirectory}photos/${id}.jpg`
  
  // Save file locally first
  await FileSystem.copyAsync({ from: options.uri, to: localPath })
  
  // Commit event - LiveStore handles:
  // 1. Persist to local SQLite
  // 2. Update reactive queries (UI updates)
  // 3. Queue for sync
  store.commit(events.photoCaptured({
    id,
    projectId: options.projectId,
    markerId: options.markerId,
    localPath,
    isIssue: options.isIssue,
    capturedAt: new Date(),
  }))
  
  return id
}

// When user toggles issue on existing photo
function markAsIssue(photoId: string) {
  store.commit(events.photoMarkedAsIssue({ photoId }))
}

// When user links photo to callout after capture
function linkToMarker(photoId: string, markerId: string) {
  store.commit(events.photoLinkedToMarker({ photoId, markerId }))
}
```

---

## 2. Photo State: How "In Progress" and "Complete" Are Determined

### The Honest Answer: They're NOT Auto-Determined

| State | Can AI Detect? | How It's Actually Captured |
|-------|----------------|---------------------------|
| **Issue** | No | User explicitly toggles Issue mode |
| **Start** | No | Inferred: First photo at this callout |
| **In Progress** | No | Inferred: Middle photos (not first, not last) |
| **Complete** | No | **Cannot be inferred** - user must signal |

### Recommendation: Binary States Only (Normal + Issue)

Everything else is derived from the timeline:
- First photo = implicitly "started"
- Issue photo = explicit problem
- No "complete" - the timeline shows history

**Why no "Complete" button?**
- Workers often return to areas multiple times
- "Complete" today might need rework tomorrow
- If someone needs to know if work is done, they look at the latest photo

### Timeline View (Reactive Query)

```typescript
// src/hooks/usePhotosForMarker.ts
import { useQuery } from '@livestore/react'
import { tables } from '@sitelink/domain'

export function usePhotosForMarker(markerId: string) {
  return useQuery(
    tables.photos
      .where({ markerId })
      .orderBy('capturedAt', 'desc')
  )
}

// In component
function PhotoTimeline({ markerId }: { markerId: string }) {
  const { data: photos } = usePhotosForMarker(markerId)
  
  // Groups photos by date automatically
  const groupedByDate = groupBy(photos, p => 
    format(p.capturedAt, 'yyyy-MM-dd')
  )
  
  return (
    <ScrollView>
      {Object.entries(groupedByDate).map(([date, photos]) => (
        <View key={date}>
          <Text>{format(date, 'MMM d, yyyy')}</Text>
          {photos.map(photo => (
            <PhotoThumbnail 
              key={photo.id} 
              photo={photo}
              showIssueBadge={photo.isIssue}
            />
          ))}
        </View>
      ))}
    </ScrollView>
  )
}
```

---

## 3. AI Features: Concrete UI/UX Flows

### AI Feature 1: Voice Notes with Transcription

**UI Flow:**

```
STEP 1: User takes photo
┌─────────────────────────────────────────────────────────────┐
│  [Photo Preview]                                            │
│                                                             │
│  ✓ Saved to 5/A7                                           │
│                                                             │
│  ┌───────────────┐  ┌───────────────┐                       │
│  │ 🎤 Add Voice  │  │    Done       │                       │
│  └───────────────┘  └───────────────┘                       │
└─────────────────────────────────────────────────────────────┘

STEP 2: User taps "Add Voice"
┌─────────────────────────────────────────────────────────────┐
│  [Photo Preview - dimmed]                                   │
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │            🔴 Recording... 0:03                         ││
│  │         [Tap anywhere to stop]                          ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘

STEP 3: Transcription complete (async)
┌─────────────────────────────────────────────────────────────┐
│  [Photo Preview]                                            │
│                                                             │
│  🎤 Voice note (0:05)  ▶️                                   │
│  📝 "Junction box needs to move about six inches to        │
│      the left to clear the conduit run"                    │
│                                                             │
│  ┌───────────────┐                                         │
│  │    Done       │                                         │
│  └───────────────┘                                         │
└─────────────────────────────────────────────────────────────┘
```

**LiveStore Implementation:**

```typescript
// Record voice note
async function recordVoiceNote(photoId: string, uri: string, duration: number) {
  const id = crypto.randomUUID()
  const localPath = `${FileSystem.documentDirectory}audio/${id}.m4a`
  
  await FileSystem.copyAsync({ from: uri, to: localPath })
  
  // Commit event - queued for sync
  store.commit(events.voiceNoteRecorded({
    id,
    photoId,
    localPath,
    durationSeconds: duration,
  }))
  
  return id
}

// When transcription comes back from server (via sync)
// The voiceNoteTranscribed event is committed by sync backend
// and automatically updates local state

// Reactive query for voice notes
function useVoiceNote(photoId: string) {
  return useQuery(
    tables.voiceNotes.where({ photoId }).first()
  )
}
```

---

### AI Feature 2: Daily Summary Generation

**UI Flow:**

```
PROJECT VIEW - End of Day
┌─────────────────────────────────────────────────────────────┐
│  Riverside Apartments                                       │
│  ═══════════════════════════════════════════════════════════│
│                                                             │
│  Today's Activity                        [Generate Summary] │
│  • 12 photos captured                                      │
│  • 3 voice notes                                           │
│  • 1 issue flagged                                         │
│                                                             │
└─────────────────────────────────────────────────────────────┘

USER TAPS "Generate Summary"
┌─────────────────────────────────────────────────────────────┐
│  Generating Daily Summary...                                │
│  ████████████░░░░░░░░                                      │
│  Analyzing 12 photos and 3 voice notes...                  │
└─────────────────────────────────────────────────────────────┘

SUMMARY GENERATED
┌─────────────────────────────────────────────────────────────┐
│  Daily Summary - Jan 2, 2026                               │
│  ═══════════════════════════════════════════════════════════│
│                                                             │
│  Work Completed:                                           │
│  • Electrical junction (5/A7): 7 photos documenting        │
│    conduit installation. Note: Junction box requires       │
│    repositioning ~6" left to clear conduit run.            │
│  • Panel rough-in (3/A2): 3 photos, work in progress.      │
│                                                             │
│  Issues Flagged:                                           │
│  ⚠️ 5/A7 - Junction box placement conflict                 │
│                                                             │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │  📋 Copy Text   │  │  📤 Share       │                  │
│  └─────────────────┘  └─────────────────┘                  │
└─────────────────────────────────────────────────────────────┘
```

**Implementation:**

```typescript
// API call to generate summary (server-side LLM)
async function generateDailySummary(projectId: string, date: Date) {
  // Get all photos from today with their voice notes
  const photos = store.query(
    tables.photos
      .where({ projectId })
      .where('capturedAt', '>=', startOfDay(date))
      .where('capturedAt', '<', endOfDay(date))
  )
  
  const voiceNotes = store.query(
    tables.voiceNotes.whereIn('photoId', photos.map(p => p.id))
  )
  
  // Call server API
  const response = await api.generateSummary({
    projectId,
    date: date.toISOString(),
    // Server fetches full context from its database
  })
  
  return response.summary
}
```

---

## 4. Payment Flow: Trial to Paid (Polar Integration)

### Trial Expiration Warning (Day 12)

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  ⏰ Your trial ends in 2 days                              │
│                                                             │
│  Keep all your projects and features:                      │
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  Pro Plan                                   $29/month   ││
│  │  • 3 projects, 10 users                                 ││
│  │  • Voice transcription                                  ││
│  │  • Daily summaries                                      ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │           Continue to Payment                           ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  Or choose Team ($79/month) for unlimited everything       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Technical Implementation with Polar + Better-Auth

```typescript
// Already using Better-Auth, add Polar plugin
import { polar, checkout, portal } from "@polar-sh/better-auth";

const auth = betterAuth({
  plugins: [
    polar({
      client: polarClient,
      createCustomerOnSignUp: true,
      use: [
        checkout({
          products: [
            { productId: "pro_plan_id", slug: "pro" },
            { productId: "team_plan_id", slug: "team" }
          ],
          successUrl: "/upgrade/success?checkout_id={CHECKOUT_ID}",
        }),
        portal(),
      ],
    }),
  ],
});

// In mobile app, trigger checkout:
const handleUpgrade = async (plan: 'pro' | 'team') => {
  await authClient.checkout({
    slug: plan,
    referenceId: organizationId,
  });
};

// Check subscription status:
const { data: customerState } = await authClient.customer.state();
const hasPro = customerState?.subscriptions?.some(
  sub => sub.productId === "pro_plan_id" && sub.status === "active"
);
```

---

## 5. Offline Auth: Biometric Unlock

### First Login (Online Required)

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                    🔒 Sign In                               │
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  Continue with Google                                   ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  Continue with Microsoft                                ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
└─────────────────────────────────────────────────────────────┘

AFTER OAUTH SUCCESS:
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│              🔐 Enable Quick Unlock?                        │
│                                                             │
│  Use Face ID / fingerprint to unlock SiteLink              │
│  when you're offline or for faster access.                 │
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │           Enable Face ID                                ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│              Skip for now                                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Implementation

```typescript
import * as LocalAuthentication from 'expo-local-authentication'
import * as SecureStore from 'expo-secure-store'

// After successful OAuth
async function enableOfflineAccess(session: Session) {
  await SecureStore.setItemAsync('session', JSON.stringify(session), {
    requireAuthentication: true, // Requires biometric to read
  })
}

// On app open
async function attemptOfflineAuth(): Promise<Session | null> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync()
  if (!hasHardware) return null
  
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Unlock SiteLink',
    fallbackLabel: 'Use passcode'
  })
  
  if (result.success) {
    const session = await SecureStore.getItemAsync('session')
    return session ? JSON.parse(session) : null
  }
  return null
}
```

---

## 6. Share Flow: Project Sharing

### Share Project (View-Only Link)

```
PROJECT DETAIL
┌─────────────────────────────────────────────────────────────┐
│  Riverside Apartments                           [Share] 📤  │
│  ═══════════════════════════════════════════════════════════│
│                                                             │
│  ...                                                       │
└─────────────────────────────────────────────────────────────┘

USER TAPS SHARE
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│              Share "Riverside Apartments"                   │
│                                                             │
│  Anyone with this link can view plans and photos:          │
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  sitelink.app/p/ABC123                    [Copy] 📋    ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  Share via:                                                │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐       │
│  │ Message │  │ WhatsApp│  │  Email  │  │  More   │       │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘       │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│  ⚙️ Link settings                                          │
│  • Expires: Never                                          │
│  • Can view: Plans and photos only                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Shared View (Web - No Auth Required)

```
┌─────────────────────────────────────────────────────────────┐
│  SiteLink                              [Sign Up Free] 🔵    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Riverside Apartments                                       │
│  Shared by John Smith                                      │
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                                                         ││
│  │              [Plan Viewer - Read Only]                  ││
│  │                                                         ││
│  │  ○ ○ ○  Callout markers (clickable)                    ││
│  │                                                         ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  Sheets: A-101 | A-102 | E-401 | E-402 | ...              │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  📷 Recent Photos (12)                     [View Timeline]  │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐                          │
│  │     │ │     │ │     │ │     │                          │
│  └─────┘ └─────┘ └─────┘ └─────┘                          │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  Powered by SiteLink   |   Try Free for 14 Days           │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. Summary: What's Actually Worth Building

### Must Build (Phase 1: Weeks 1-4)

| Feature | Effort | Why |
|---------|--------|-----|
| LiveStore + Expo integration | 3 days | Foundation |
| LiveStore + CF sync backend | 2 days | Sync |
| Camera with Issue toggle | 2 days | Core UX |
| Photo timeline by callout | 2 days | Core value |
| Voice note recording (audio only) | 1 day | Gloved hands |
| View-only share links | 2 days | Subcontractor access |
| Biometric offline auth | 1 day | Field reliability |
| Polar payment integration | 2 days | Revenue |

### High Value AI (Phase 2: Weeks 5-8)

| Feature | Effort | Validated Value |
|---------|--------|-----------------|
| Voice transcription (Whisper) | 2 days | Searchable notes |
| Plan text search | 3 days | "Where is X?" |
| Photo text extraction | 1 day | Capture labels |
| Daily summary generation | 3 days | Saves 15-30 min |

### Skip For Now

| Feature | Why Skip |
|---------|----------|
| Work state AI detection | Can't reliably detect, Issue flag is enough |
| Progress estimation | Wrong product (needs 360° + BIM) |
| CLIP photo grouping | Callout + time grouping is sufficient |
| Complex annotations | Keep it simple |

---

## 8. The Honest AI Value Assessment

**Yes, but it's "AI as utility" not "AI as magic"**

| AI Feature | What It Actually Is | Differentiation |
|------------|---------------------|-----------------|
| Marker detection | OCR + CV + LLM validation | ✅ Core (already built) |
| Voice transcription | Whisper API | ✅ Useful |
| Plan search | Full-text on OCR | ✅ Useful |
| Daily summary | LLM summarization | ⚠️ Nice to have |

**The honest pitch:**
- Auto-linking that actually works (91.5% recall)
- Voice notes that become searchable text
- Search across all your plans
- Daily summaries generated from your photos

**Not magic AI, but genuinely useful AI applied to real problems.**

The biggest differentiation remains: **Simplicity + Price + Auto-linking + Offline-first.**