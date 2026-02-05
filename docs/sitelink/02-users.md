# SiteLink User Research & Personas

**Version:** 1.0
**Date:** January 2026
**Document Type:** User Research Synthesis

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Research Methodology](#2-research-methodology)
3. [User Personas](#3-user-personas)
4. [Current Workflow Analysis](#4-current-workflow-analysis)
5. [Future Workflow with SiteLink](#5-future-workflow-with-sitelink)
6. [Jobs to Be Done Framework](#6-jobs-to-be-done-framework)
7. [Retention Analysis](#7-retention-analysis)
8. [Appendix: Field Research Notes](#8-appendix-field-research-notes)

---

## 1. Executive Summary

This document synthesizes user research for SiteLink, a mobile-first construction plan viewer targeting structural construction professionals. Our research reveals that field workers spend 5-15 minutes per element lookup, with that time multiplied across waiting crew members. The core opportunity is reducing information retrieval friction while maintaining the trust and verification habits that keep construction work safe.

### Key Findings

| Finding | Impact |
|---------|--------|
| Sheet navigation is the #1 pain point | 5-15 min wasted per lookup |
| Workers don't adopt complex software | <20% usage of enterprise tools among small contractors |
| Photo documentation happens regardless | Workers already photograph work; they need organization |
| Offline capability is non-negotiable | 40%+ of job sites have poor/no connectivity |
| Trust requires verification | Workers won't act without seeing the source drawing |

### Target Market

- **Primary:** 1-20 person construction companies
- **Verticals:** Structural, concrete, rebar, electrical, plumbing
- **Geography:** Initially North America (Canadian metric + US imperial)
- **Current tools:** Paper plans, basic PDF viewers, phone photos (unorganized)

---

## 2. Research Methodology

### Data Sources

1. **Field Observations** - 12 site visits across residential and commercial projects
2. **User Interviews** - 24 interviews with foremen, workers, and project managers
3. **Competitive Analysis** - Analysis of Fieldwire, PlanGrid, and Procore usage patterns
4. **Industry Reports** - Construction technology adoption studies (2024-2025)

### Key Research Questions

- How do workers currently find information on construction plans?
- What prevents adoption of existing construction software?
- What would make a field worker use an app daily?
- How do workers verify information before acting?

---

## 3. User Personas

### 3.1 Primary Persona: Carlos - Rebar Foreman

```
PERSONA: CARLOS MENDEZ
Role: Rebar Foreman (Ironworker)
Company: Mendez Rebar, 6-person crew
Experience: 15 years in structural concrete
Age: 42
Location: Denver, CO
```

**Background**

Carlos runs a small rebar installation crew that subcontracts for general contractors on commercial and multi-family residential projects. He reads plans fluently and takes pride in getting the rebar right the first time. His crew trusts him to interpret the drawings correctly.

**Goals**

- Get accurate specs fast so the crew isn't standing around
- Avoid rework from misread plans or wrong bar sizes
- Document installed rebar for inspection
- Keep the job moving without callbacks

**Pain Points**

| Pain Point | Frequency | Impact |
|------------|-----------|--------|
| Flipping between sheets to find schedule info | 10-15x/day | 5-10 min wasted each time |
| Small, rotated text hard to read on phone | Every lookup | Eyestrain, errors |
| No cell service in parking structures | 30% of jobs | Can't access cloud plans |
| Different GCs use different software | Every job | Learning curve, fatigue |
| Finding tagged rebar bundles on site | 5-10x/day | Walking, searching |

**Technology Profile**

- Device: iPhone 14 (company-provided)
- Apps used: WhatsApp, Camera, basic PDF viewer
- Comfort level: Medium - uses smartphone daily, avoids complex apps
- Barrier to adoption: "I don't have time to learn another app"

**A Day in Carlos's Life**

```
5:30 AM - Arrives at site, reviews day's work areas
6:00 AM - Crew arrives, assigns areas, answers questions about specs
6:30 AM - First footing - worker asks "What size bars for F3?"
         Carlos opens PDF, scrolls to S0.0, finds schedule,
         scrolls back to S1.0 to confirm location, 8 minutes lost
7:00 AM - Photos of first tie for documentation
9:00 AM - Inspector arrives, asks for rebar photos at specific location
         Carlos scrolls through 200+ camera roll photos to find them
10:30 AM - Revision question - is this Rev 2 or Rev 3 of the plans?
          Carlos calls PM to verify, 15 minute delay
```

**Quote**

> "I've been doing this 15 years. I can read plans in my sleep. But I shouldn't have to flip through 50 sheets just to find what size rebar goes in a footing. Just tell me what goes here."

**What Carlos Needs from SiteLink**

1. One-tap from footing location to schedule info
2. Works in the parking garage (offline)
3. Photos organized by where they were taken, not when
4. Voice notes when hands are dirty
5. Simple enough his crew can use it without training

---

### 3.2 Primary Persona: Mike - Electrical Journeyman

```
PERSONA: MIKE CHEN
Role: Journeyman Electrician
Company: Works for a 15-person electrical contractor
Experience: 8 years
Age: 34
Location: Seattle, WA
```

**Background**

Mike is a skilled electrician who works independently on most tasks. He needs to reference plans constantly to verify circuit routes, panel locations, and detail specifications. Unlike a foreman, he doesn't direct a crew - he needs to find information for himself, quickly.

**Goals**

- Find detail callouts without searching multiple sheets
- Document panel installations and wire runs
- Verify circuit specs before pulling wire
- Take photos for the company's documentation requirements

**Pain Points**

| Pain Point | Frequency | Impact |
|------------|-----------|--------|
| Finding section details from callouts | 15-20x/day | 3-5 min each |
| Photographing panel schedules for reference | 5x/day | Quality issues, organization |
| Typing on phone with work gloves | Every use | Frustration, errors |
| Remembering which circuit goes where | Constant | Mental load |
| Boss wants more photo documentation | Daily | Time overhead |

**Technology Profile**

- Device: Samsung Galaxy S23
- Apps used: Photos, company chat app, music streaming
- Comfort level: High - comfortable with technology
- Barrier to adoption: "Apps never work the way they show in the demo"

**Quote**

> "I spend half my day just finding the right sheet. The callout says 5/E-402, so I have to find E-402, then find detail 5. By the time I find it, I forgot what I was looking for."

**What Mike Needs from SiteLink**

1. Tap a callout, go directly to that detail
2. Large buttons for gloved hands
3. Camera that auto-organizes photos by location
4. Voice notes instead of typing
5. Search for text on plans (e.g., "Panel E-4")

---

### 3.3 Primary Persona: Rosa - Building Inspector

```
PERSONA: ROSA MARTINEZ
Role: Building Inspector (City)
Company: City of Phoenix Building Department
Experience: 12 years in construction, 5 as inspector
Age: 48
Location: Phoenix, AZ
```

**Background**

Rosa inspects 6-8 sites per day across multiple contractors. She needs to quickly verify that installed work matches approved plans. She's seen every trick in the book and every honest mistake. Her job is verification, not construction.

**Goals**

- Verify installed work matches approved plans
- Document non-compliant work with clear photo evidence
- Reference specific plan details during disputes
- Process inspections efficiently to hit daily quota

**Pain Points**

| Pain Point | Frequency | Impact |
|------------|-----------|--------|
| Contractor shows outdated revision | 2-3x/week | Failed inspections, rework |
| Finding specific detail to verify against | Every inspection | Time, frustration |
| Taking photos that clearly show the issue | 10x/day | Re-visits, unclear documentation |
| No system to organize inspection photos | Every job | End-of-day report creation |
| Different plan viewers at every site | Every site | Learning curve |

**Technology Profile**

- Device: City-issued iPad
- Apps used: City inspection software, Photos, email
- Comfort level: Medium - uses required tools, not enthusiastic
- Barrier to adoption: "I use what the city gives me"

**Quote**

> "I'm not here to argue with the foreman. I just need to see that the rebar matches what's on the approved drawing. If it doesn't match, I have to be able to show them exactly what the drawing says."

**What Rosa Needs from SiteLink**

1. Quick verification: tap location, see specs, compare to installed
2. Clear photo documentation with automatic plan reference
3. View source on any extracted information
4. Confidence that she's looking at the current approved revision

---

### 3.4 Secondary Persona: Sarah - Small GC Owner

```
PERSONA: SARAH JOHNSON
Role: Owner/Project Manager
Company: Johnson Construction LLC, 8 employees
Experience: 18 years in construction, 7 as owner
Age: 45
Location: Austin, TX
```

**Background**

Sarah runs a small general contracting company focused on custom residential and light commercial. She wears many hats: estimating, project management, client communication, and occasional field work. She's tried multiple construction software platforms and found them either too expensive or too complex for her team.

**Goals**

- Keep projects on schedule without micromanaging
- Know what work was completed each day
- Share professional reports with clients
- Control costs on software subscriptions

**Pain Points**

| Pain Point | Frequency | Impact |
|------------|-----------|--------|
| Field workers won't update task systems | Daily | Blind to progress |
| Spending evenings writing daily reports | Daily | 45-60 min/day |
| Per-user software costs add up fast | Monthly | $200-400/mo wasted |
| Subs don't want to learn another app | Every project | Friction, non-adoption |
| Can't justify enterprise software cost | Constant | Using inferior tools |

**Technology Profile**

- Device: MacBook Pro, iPhone 15 Pro
- Apps used: QuickBooks, email, Excel, various PDF viewers
- Comfort level: High - technology is essential to her business
- Barrier to adoption: "My guys just won't use complicated apps"

**Quote**

> "I've tried Fieldwire, I've tried Procore. My guys open them once and never again. Too many features. They just want to see the plans and take pictures. That's it."

**What Sarah Needs from SiteLink**

1. Photo timeline that shows what was done each day
2. AI-generated daily reports from photos/voice notes
3. Flat pricing that doesn't punish her for adding crew
4. Share plans with subs without making them create accounts
5. Professional reports for client communication

---

### 3.5 Tertiary Persona: Danny - Plumbing Subcontractor

```
PERSONA: DANNY KOWALSKI
Role: Plumbing Contractor (Owner/Operator)
Company: Danny's Plumbing, 2-person crew
Experience: 22 years
Age: 55
Location: Chicago, IL
```

**Background**

Danny is a master plumber who runs a small plumbing business with one apprentice. He subcontracts for GCs on residential and small commercial projects. He's not interested in technology beyond what's necessary - he just wants to see the plans and do the work.

**Goals**

- See the plans the GC is working from
- Not pay for software on every job
- Take photos for his own records
- Stay independent from GC's systems

**Pain Points**

| Pain Point | Frequency | Impact |
|------------|-----------|--------|
| GC uses different software on every job | Every job | Learning fatigue |
| Having to create accounts everywhere | Every job | Time, password fatigue |
| Paying for software he barely uses | Monthly consideration | Cost resentment |
| Getting outdated plans from GC | 1-2x/month | Rework |
| No organized way to keep job photos | Every job | Lost documentation |

**Technology Profile**

- Device: iPhone 12
- Apps used: Phone, text, basic camera
- Comfort level: Low - technology tolerant, not enthusiastic
- Barrier to adoption: "I'm not creating another account"

**Quote**

> "Every GC wants me to use their app. I'm on 5 different jobs with 5 different GCs. I'm not learning 5 different systems. Just send me the plans."

**What Danny Needs from SiteLink**

1. View plans via link without creating an account
2. Free access as a viewer (sub doesn't pay)
3. Simple interface - no learning curve
4. Take photos that go to his own phone too
5. Works on his older phone

---

## 4. Current Workflow Analysis

### 4.1 Scenario: Finding Footing Specifications

**Context:** Carlos's crew is about to form and pour footing at grid F/5. Worker asks: "What goes here?"

#### Current Workflow (Without SiteLink)

```
Step 1: Find the foundation plan
├── Open PDF on phone (10 sec)
├── Scroll/zoom through sheet list (15 sec)
├── Find S1.0 Foundation Plan (20 sec)
└── Subtotal: 45 seconds

Step 2: Locate grid F/5
├── Pinch to zoom on plan (10 sec)
├── Pan to find grid lines (20 sec)
├── Locate intersection F/5 (15 sec)
├── Read label: "FOOTING TYPE F1, PIER TYPE P1, ELEV -1500" (20 sec)
│   └── Label often rotated 45°, small text, hard to read
└── Subtotal: 65 seconds (1 min 5 sec)

Step 3: Find the footing schedule
├── Note: need to find F1 specs (5 sec)
├── Navigate back to sheet list (10 sec)
├── Find S0.0 (cover sheet with schedules) (15 sec)
├── Scroll to find Footing Schedule (20 sec)
├── Find row F1 (15 sec)
├── Read: "1500x1500x300, 4-15M E.W." (15 sec)
└── Subtotal: 80 seconds (1 min 20 sec)

Step 4: Find the pier schedule
├── Scroll on same sheet to Pier Schedule (15 sec)
├── Find row P1 (15 sec)
├── Read: "450x450, 4-25M verts, 10M@300 ties" (15 sec)
└── Subtotal: 45 seconds

Step 5: Find section detail (optional)
├── Note callout "10/S2.0" from plan (remembered or go back)
├── Navigate to S2.0 (30 sec)
├── Find section 10 on sheet (30 sec)
├── Study detail (60 sec)
└── Subtotal: 120 seconds (2 min)

Step 6: Communicate to crew
├── Walk to crew location (variable)
├── Verbally communicate specs (30 sec)
├── Answer follow-up questions, may repeat steps (variable)
└── Subtotal: 30+ seconds

─────────────────────────────────────────────
TOTAL: 5-8 minutes (simple case)
       10-15 minutes (with details and questions)

MULTIPLIER: 4 crew members waiting = 20-60 person-minutes lost
```

#### Pain Points Identified

| Pain Point | Stage | User Quote |
|------------|-------|------------|
| Small, rotated text | Step 2 | "I need reading glasses for this" |
| Information scattered across sheets | Steps 3-5 | "Why can't they put it all in one place?" |
| Losing context when switching sheets | Steps 3-5 | "What was I looking for again?" |
| Verification difficulty | Step 6 | "Are you sure it's F1? Check again" |
| No aggregated view | All | "I have to remember all this in my head" |
| Revision uncertainty | All | "Is this the latest set?" |
| Connectivity issues | All | "Drawings won't load, no signal" |

### 4.2 Scenario: Photo Documentation

**Context:** Mike finishes installing a junction box and needs to document it.

#### Current Workflow (Without SiteLink)

```
Step 1: Take photo
├── Open camera app (5 sec)
├── Frame and capture (10 sec)
├── Maybe take 2-3 angles (20 sec)
└── Subtotal: 35 seconds

Step 2: Photo goes to camera roll
├── Mixed with personal photos
├── No metadata about location on plans
├── No link to which detail/callout
└── Organization problem: CREATED

Step 3: Later - finding that photo
├── Scroll through camera roll (60+ sec)
├── Try to remember date/time (30 sec)
├── Often can't find the right photo (variable)
└── Subtotal: 90+ seconds per search

Step 4: End of day - creating report
├── Scroll through all day's photos (300+ sec)
├── Try to remember what each photo shows (variable)
├── Manually write descriptions (600+ sec)
├── Compile into report format (300+ sec)
└── Subtotal: 20-45 minutes

─────────────────────────────────────────────
PROBLEM: Photos are captured but not organized
         Report creation becomes a major time sink
         Photos often can't be found when needed
```

### 4.3 Scenario: Inspector Verification

**Context:** Rosa arrives to inspect rebar installation at a footing.

#### Current Workflow (Without SiteLink)

```
Step 1: Contractor presents plans
├── View their PDF on their tablet (10 sec)
├── Ask to see footing schedule (20 sec)
├── Ask which revision this is (10 sec)
│   └── Trust issue: is this the approved set?
└── Subtotal: 40 seconds

Step 2: Verify schedule against installation
├── Read specs from screen (20 sec)
├── Compare to installed rebar (60 sec)
├── Count bars, check sizes (120 sec)
└── Subtotal: 200 seconds (3 min 20 sec)

Step 3: Document inspection
├── Take photo with own device (10 sec)
├── Write notes in inspection app (60 sec)
├── Can't easily link photo to plan location
└── Subtotal: 70 seconds

─────────────────────────────────────────────
TOTAL: 5+ minutes per inspection point
PROBLEM: No verification that plans shown are approved set
         No easy way to link photos to plan locations
```

---

## 5. Future Workflow with SiteLink

### 5.1 Scenario: Finding Footing Specifications

**Context:** Same scenario - Carlos's crew at grid F/5.

#### Future Workflow (With SiteLink)

```
Step 1: Open SiteLink to current project
├── App opens to last-viewed sheet (2 sec)
├── Already on S1.0 Foundation Plan
└── Subtotal: 2 seconds

Step 2: Tap grid F/5 OR ask Plan Assistant
├── Option A: Tap the footing at F/5 (5 sec)
│   └── Callout action sheet appears with all info
├── Option B: Tap mic, say "What's at F/5?" (5 sec)
│   └── AI returns aggregated response
└── Subtotal: 5 seconds

Step 3: View aggregated information
├── Card shows:
│   ├── FOOTING F1
│   │   Size: 1500x1500x300
│   │   Rebar: 4-15M E.W.
│   │   [Source: S0.0 Footing Schedule] [View]
│   ├── PIER P1
│   │   Size: 450x450
│   │   Rebar: 4-25M verts, 10M@300 ties
│   │   [Source: S0.0 Pier Schedule] [View]
│   ├── ELEVATION: -1500
│   │   [Source: S1.0, label at F/5] [View]
│   └── Section Detail: 10/S2.0 [View]
└── Subtotal: 10 seconds to scan

Step 4: Verify if needed (optional)
├── Tap [View] on any item
├── Jumps to source, highlights extraction point
├── Tap "Back to answer" to return
└── Subtotal: 15 seconds if needed

Step 5: Communicate to crew
├── Hand phone to worker: "Here's everything" (5 sec)
├── Worker can tap [View] to verify themselves
└── Subtotal: 5 seconds

─────────────────────────────────────────────
TOTAL: 20-30 seconds

TIME SAVED: 5-15 minutes → 30 seconds = 90%+ reduction
CONFIDENCE: Provenance links allow instant verification
MULTIPLIER: Crew can self-serve instead of waiting
```

### 5.2 Scenario: Photo Documentation

**Context:** Mike finishes junction box installation.

#### Future Workflow (With SiteLink)

```
Step 1: From callout action sheet, tap "Photo"
├── Came here by tapping callout 5/A7 on plan
├── Camera opens, already linked to 5/A7
└── Subtotal: 2 seconds

Step 2: Take photo
├── Frame and capture (10 sec)
├── Photo auto-saves with metadata:
│   ├── Project: Riverside Apartments
│   ├── Location: 5/A7 - Electrical Junction Detail
│   ├── Sheet: E-401
│   ├── Timestamp: Jan 2, 2026 2:47 PM
│   └── GPS: (if available)
└── Subtotal: 10 seconds

Step 3: Add voice note (optional)
├── Tap "Add Voice" (2 sec)
├── Speak: "Junction box installed, need to verify clearance" (5 sec)
├── Tap to stop (2 sec)
├── Transcription happens in background
└── Subtotal: 9 seconds if used

Step 4: Continue working
├── Done - photos organized automatically
└── Subtotal: 0 seconds

Step 5: Finding photo later
├── Go to Plans tab, find sheet E-401 or callout 5/A7
├── Tap callout → see all photos at this location
├── Or search "junction" → find via voice transcription
└── Subtotal: 10-15 seconds to find any photo

Step 6: Daily report
├── Tap "Generate Daily Summary"
├── AI creates report from photos + voice notes
├── Edit if needed, share
└── Subtotal: 2-3 minutes vs 20-45 minutes

─────────────────────────────────────────────
TIME SAVED: Photo organization = automatic (90% reduction in search time)
            Daily report = 80% reduction in creation time
```

### 5.3 Scenario: Inspector Verification

**Context:** Rosa inspects rebar installation.

#### Future Workflow (With SiteLink)

```
Step 1: Open SiteLink, navigate to location
├── "What's at F/5?" or tap on plan
├── See aggregated specs with sources
└── Subtotal: 10 seconds

Step 2: Verify with provenance
├── Tap [View] on footing schedule entry
├── See source sheet, highlighted row
├── Confirm this matches approved revision
└── Subtotal: 15 seconds

Step 3: Compare to installed
├── Read specs from SiteLink
├── Count bars, check sizes
├── Specs visible on same screen as she looks
└── Subtotal: 120 seconds (same as before)

Step 4: Document
├── Tap "Photo" from same callout screen
├── Photo auto-linked to F/5 location
├── Add voice note: "Approved, rebar matches schedule"
└── Subtotal: 20 seconds

─────────────────────────────────────────────
TOTAL: 2.5 minutes vs 5+ minutes = 50% reduction
CONFIDENCE: Can verify approved revision via provenance
```

### 5.4 Time Savings Summary

| Scenario | Current | With SiteLink | Savings |
|----------|---------|---------------|---------|
| Element spec lookup | 5-15 min | 30 sec | 90%+ |
| Photo organization | 90+ sec to find | 10-15 sec | 85% |
| Daily report creation | 20-45 min | 2-3 min | 90% |
| Inspector verification | 5+ min | 2.5 min | 50% |
| Team waiting time | 20-60 person-min/lookup | ~0 (self-serve) | 95%+ |

---

## 6. Jobs to Be Done Framework

### 6.1 Core Jobs

#### Job 1: Find specific information on plans quickly

**Job Statement:**
> When I'm standing at a location on the job site, I want to quickly get all the specs for that location, so that I can do the work correctly without wasting time.

**Functional Requirements:**
- One-tap from location to aggregated information
- Works offline (no connectivity required)
- Large touch targets (usable with gloves)
- Voice input for hands-free operation

**Emotional Requirements:**
- Feel confident I have the right information
- Feel competent (not fighting with technology)
- Feel in control (can verify the source)

**Current Solutions:**
- Paper plans (slow, bulky, can't search)
- PDF viewer (slow navigation, no aggregation)
- Ask the foreman (delays, single point of dependency)

#### Job 2: Document work with location context

**Job Statement:**
> When I complete a piece of work, I want to capture a photo that's automatically organized by location, so that I can find it later without searching through hundreds of photos.

**Functional Requirements:**
- Camera linked to plan location
- Automatic metadata tagging
- Voice notes with transcription
- Searchable by location, date, or transcription

**Emotional Requirements:**
- Feel efficient (not doing extra work)
- Feel organized (everything in its place)
- Feel professional (proper documentation)

**Current Solutions:**
- Phone camera (no organization, mixed with personal)
- Manual photo logging (time-consuming, often skipped)
- Memory (unreliable, especially days later)

#### Job 3: Share plans without friction

**Job Statement:**
> When I need to share plans with a subcontractor or inspector, I want them to view without creating an account, so that I don't have to fight adoption battles.

**Functional Requirements:**
- Shareable link with no sign-up required
- View-only access for recipients
- Works on any device with a browser
- Recipients can take photos that go to their own device

**Emotional Requirements:**
- Feel respected (not forcing tools on others)
- Feel professional (clean sharing experience)
- Feel in control (manage access, see who viewed)

**Current Solutions:**
- Email PDF attachments (large files, version confusion)
- Require account creation (adoption friction)
- Give full app access (over-sharing, complexity)

#### Job 4: Know what happened each day

**Job Statement:**
> When I review the day's work, I want to see a timeline of photos and activities by location, so that I understand progress without asking everyone.

**Functional Requirements:**
- Photo timeline grouped by location and time
- AI-generated daily summary from photos/voice
- Easy export for client/stakeholder reports
- Activity feed showing team actions

**Emotional Requirements:**
- Feel informed (know what happened)
- Feel efficient (don't have to ask around)
- Feel professional (can report to clients)

**Current Solutions:**
- Walk the site end of day (time-consuming)
- Ask each crew member (depends on their memory)
- Manual report writing (time-consuming, often skipped)

### 6.2 Job Map: Finding Element Specifications

```
┌─────────────────────────────────────────────────────────────────────┐
│                          JOB: Find Element Specs                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  DEFINE ───────────────────────────────────────────────────────────  │
│  │                                                                   │
│  ├── Determine what location I'm at (grid reference)                │
│  │   Pain: Often hard to identify which grid intersection           │
│  │                                                                   │
│  └── Identify what type of element is at this location             │
│      Pain: Label text small, rotated, hard to read                  │
│                                                                      │
│  LOCATE ───────────────────────────────────────────────────────────  │
│  │                                                                   │
│  ├── Find the right plan sheet                                      │
│  │   Pain: Many sheets to scroll through                            │
│  │                                                                   │
│  └── Find the specific location on the sheet                        │
│      Pain: Zooming, panning, searching                              │
│                                                                      │
│  PREPARE ──────────────────────────────────────────────────────────  │
│  │                                                                   │
│  ├── Find schedule with specifications                              │
│  │   Pain: On different sheet, must flip back and forth             │
│  │                                                                   │
│  ├── Find section detail if needed                                  │
│  │   Pain: Another sheet to find                                    │
│  │                                                                   │
│  └── Aggregate all information mentally                             │
│      Pain: Must remember multiple specs, easy to forget             │
│                                                                      │
│  CONFIRM ──────────────────────────────────────────────────────────  │
│  │                                                                   │
│  ├── Verify information is from current revision                    │
│  │   Pain: Uncertain if plans are up to date                        │
│  │                                                                   │
│  └── Double-check specs before communicating                        │
│      Pain: Going back through sheets again                          │
│                                                                      │
│  EXECUTE ──────────────────────────────────────────────────────────  │
│  │                                                                   │
│  └── Communicate specs to crew member                               │
│      Pain: Single point of information (foreman bottleneck)         │
│                                                                      │
│  MONITOR ──────────────────────────────────────────────────────────  │
│  │                                                                   │
│  └── Answer follow-up questions                                     │
│      Pain: Must repeat lookup process                               │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 6.3 Job Priorities by Persona

| Job | Carlos (Foreman) | Mike (Worker) | Sarah (PM) | Danny (Sub) |
|-----|------------------|---------------|------------|-------------|
| Find specs quickly | Critical | Critical | Medium | Medium |
| Document with context | High | High | Critical | Medium |
| Share without friction | Low | Low | Critical | Critical |
| Know what happened | Medium | Low | Critical | Low |
| Generate reports | Low | Low | Critical | Medium |

---

## 7. Retention Analysis

### 7.1 Daily Usage Drivers

What makes users open the app every day?

| Feature | Usage Frequency | Stickiness Factor | Notes |
|---------|-----------------|-------------------|-------|
| **Plan viewing** | 20-40x/day | High | Core utility, replaces PDF viewer |
| **Callout navigation** | 10-20x/day | Very High | Unique value, time saver |
| **Photo capture** | 5-15x/day | High | Habit formation through convenience |
| **Plan Assistant queries** | 5-10x/day | Very High | AI aggregation is differentiated |
| **Photo timeline review** | 1-2x/day | Medium | End-of-day habit |
| **Daily summary** | 1x/day | High | Replaces manual reporting |
| **Text search** | 3-5x/day | Medium | Utility feature |
| **Voice notes** | 2-5x/day | Medium | Convenience feature |

### 7.2 Retention Mechanics

**Week 1 (Activation)**
- Critical: First callout tap → "wow, it jumped right to the detail"
- Critical: First photo → see it organized by location
- Important: First Plan Assistant query → aggregated answer

**Week 2-4 (Habit Formation)**
- Replace PDF viewer entirely (convenience beats old habit)
- Photo documentation becomes natural (camera linked to location)
- Daily summary generation saves time (clear value)

**Month 2+ (Retention)**
- Historical photo lookup ("When did we do this?")
- Sharing with subs/inspectors (network effects)
- Can't imagine going back to old workflow

### 7.3 What Makes Construction Apps "Sticky"

| Factor | Description | SiteLink Approach |
|--------|-------------|-------------------|
| **Replaces painful task** | Must solve real daily pain | Callout navigation (5-15 min → 30 sec) |
| **Minimal learning curve** | No training required | 3 taps to value, familiar patterns |
| **Works in the field** | Offline, gloves, sunlight | True offline, large targets, high contrast |
| **Doesn't create new work** | Fits existing workflow | Photo capture is already happening |
| **Visible time savings** | User feels the difference | Immediate comparison to old way |
| **Data accumulates value** | Gets better over time | Photo history, project knowledge base |
| **Network effects** | Others using it helps you | Shared projects, sub access |

### 7.4 Churn Risk Analysis

| Churn Risk | Trigger | Mitigation |
|------------|---------|------------|
| **Doesn't work offline** | First time in basement/garage | True offline with LiveStore |
| **Too complex** | Confused in first session | Guided first experience, demo project |
| **Callouts don't link** | Detection fails on their plans | 91.5% recall, clear feedback on undetected |
| **Photos not organized** | Can't find photo when needed | Timeline view, search, location grouping |
| **Team won't use it** | Others reject the tool | Free sub access, no account required |
| **Too expensive** | Budget review | $79/month flat, cheaper than alternatives |

### 7.5 Feature Prioritization for Retention

**Tier 1: Must Have (drives daily usage)**
1. One-tap callout navigation
2. Photo capture with auto-organization
3. Offline plan viewing
4. Plan Assistant (aggregated answers)

**Tier 2: Should Have (increases stickiness)**
1. Voice notes with transcription
2. Plan text search
3. Daily summary generation
4. Share via link (no account)

**Tier 3: Nice to Have (differentiators)**
1. Revision comparison
2. Quantity takeoffs
3. RFI generation
4. Photo verification vs. specs

### 7.6 Engagement Metrics to Track

| Metric | Target | Indicates |
|--------|--------|-----------|
| DAU/MAU | >60% | Strong daily habit |
| Callout taps per session | >5 | Using core feature |
| Photos per day per user | >3 | Documentation habit forming |
| Plan Assistant queries per day | >3 | AI value being realized |
| Time to first callout tap | <60 sec | Quick activation |
| Session length | 2-5 min | Right-sized for field use |
| Return within 24 hours | >80% | Habit formed |

---

## 8. Appendix: Field Research Notes

### 8.1 Site Visit Observations

**Visit 1: Multi-family residential, Denver**
- Foreman kept paper plans in truck, walked back and forth
- Crew had phones but said "PDF too hard to read"
- Observed 3 instances of wrong rebar pulled (4x15M vs 6x15M)

**Visit 2: Commercial office, Seattle**
- Electrical contractor using iPad with PlanGrid
- "Auto-linking is nice but I still have to read the whole sheet"
- Voice notes would help: "Can't type with gloves"

**Visit 3: Parking structure, Phoenix**
- Zero cell signal in lower levels
- Foreman printed key sheets, carried paper
- Inspector couldn't verify plans on site

### 8.2 Interview Highlights

**Carlos (Rebar Foreman):**
> "The architect thinks they're being helpful putting all these details on the drawing. But when I'm standing at one footing, I don't care about the other 50. Just tell me what goes here."

**Mike (Electrician):**
> "I know it says 10/S2.0. But finding S2.0, then finding detail 10... by then I forgot why I was looking."

**Sarah (GC Owner):**
> "I bought Fieldwire licenses for all 8 guys. Know how many actually use it? Two. Me and my superintendent."

**Danny (Plumber):**
> "I don't need another app. I've got 4 different GCs right now with 4 different systems. Just let me see the plans."

**Rosa (Inspector):**
> "Contractors show me plans, but I never know if it's the approved set. I've failed people for using outdated drawings."

### 8.3 Competitive Tool Feedback

**Fieldwire:**
- "Too many features, screens are cluttered"
- "Auto-linking works, but that's about all I use"
- "Per-seat pricing gets expensive fast"

**PlanGrid:**
- "Slower than it used to be"
- "Autodesk made it worse"
- "Good for big companies, overkill for us"

**Procore:**
- "That's for the enterprise guys"
- "My client uses it, I just look at what they send"
- "Way too complicated"

**Basic PDF viewers:**
- "Good enough if plans aren't complicated"
- "Can't search, can't link between sheets"
- "Free is the right price"

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | Jan 2026 | Product Team | Initial user research synthesis |

---

*End of Document*
