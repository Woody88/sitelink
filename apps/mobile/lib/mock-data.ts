export interface MockProject {
  id: string
  name: string
  address: string
  sheetCount: number
  photoCount: number
  memberCount: number
  updatedAt: string
  status: "active" | "completed" | "archived"
}

export interface MockFolder {
  id: string
  name: string
  sheets: MockSheet[]
}

export interface MockSheet {
  id: string
  number: string
  title: string
  markerCount: number
}

export interface MockMarker {
  id: string
  label: string
  type: "detail" | "section" | "elevation" | "note"
  targetSheet?: string
  targetSheetTitle?: string
  detailNumber?: string
  confidence: number
  description?: string
  top: number
  left: number
  width: number
  height: number
}

export interface MockRegion {
  id: string
  label: string
  type: "schedule" | "notes" | "legend"
  content?: string
  top: number
  left: number
  width: number
  height: number
}

export interface MockNotification {
  id: string
  title: string
  body: string
  time: string
  type: "success" | "alert" | "info"
  read: boolean
}

export interface MockTeamMember {
  id: string
  name: string
  email: string
  role: "Owner" | "Admin" | "Member" | "Viewer"
  initials: string
}

export interface MockTimelinePhoto {
  id: string
  timestamp: string
  timeLabel: string
  hasVoiceNote: boolean
  voiceDuration?: string
  voiceTranscript?: string
  isIssue: boolean
  color: string
}

export interface MockDateCluster {
  label: string
  photos: MockTimelinePhoto[]
}

export interface MockScheduleEntry {
  id: string
  mark: string
  scheduleType: string
  confidence: number
  properties: Record<string, string>
}

export interface MockScheduleGroup {
  id: string
  title: string
  sheetNumber: string
  entries: MockScheduleEntry[]
}

export interface MockSearchResult {
  id: string
  type: "sheet" | "schedule" | "notes" | "callout"
  title: string
  subtitle: string
  snippet: string
  matchTerm: string
  sheetNumber?: string
}

// ─── Projects ────────────────────────────────────────────

export const MOCK_PROJECTS: MockProject[] = [
  {
    id: "proj-1",
    name: "Holabird Ave Warehouse",
    address: "4200 Holabird Ave, Baltimore, MD",
    sheetCount: 12,
    photoCount: 48,
    memberCount: 5,
    updatedAt: "2h ago",
    status: "active",
  },
  {
    id: "proj-2",
    name: "Riverside Apartments",
    address: "350 River Rd, Denver, CO",
    sheetCount: 24,
    photoCount: 156,
    memberCount: 8,
    updatedAt: "1d ago",
    status: "active",
  },
  {
    id: "proj-3",
    name: "Harbor Point Retail",
    address: "1800 Thames St, Baltimore, MD",
    sheetCount: 8,
    photoCount: 32,
    memberCount: 3,
    updatedAt: "3d ago",
    status: "completed",
  },
  {
    id: "proj-4",
    name: "Maple Ridge School",
    address: "500 Oak Blvd, Oakville, ON",
    sheetCount: 16,
    photoCount: 89,
    memberCount: 6,
    updatedAt: "1w ago",
    status: "archived",
  },
]

// ─── Folders & Sheets ────────────────────────────────────

export const MOCK_FOLDERS: MockFolder[] = [
  {
    id: "folder-1",
    name: "Structural",
    sheets: [
      { id: "sh-1", number: "S0.0", title: "Cover & Schedules", markerCount: 1 },
      { id: "sh-2", number: "S1.0", title: "Foundation Plan", markerCount: 91 },
      { id: "sh-3", number: "S2.0", title: "Foundation Details", markerCount: 4 },
      { id: "sh-4", number: "S3.0", title: "Second Floor Framing Plan", markerCount: 26 },
    ],
  },
  {
    id: "folder-2",
    name: "Architectural",
    sheets: [
      { id: "sh-5", number: "A1.0", title: "Ground Floor Plan", markerCount: 14 },
      { id: "sh-6", number: "A1.1", title: "Second Floor Plan", markerCount: 8 },
      { id: "sh-7", number: "A2.0", title: "Building Sections", markerCount: 6 },
      { id: "sh-8", number: "A3.0", title: "Exterior Elevations", markerCount: 12 },
    ],
  },
  {
    id: "folder-3",
    name: "Electrical",
    sheets: [
      { id: "sh-9", number: "E1.0", title: "Electrical Site Plan", markerCount: 3 },
      { id: "sh-10", number: "E2.0", title: "Lighting Plan", markerCount: 7 },
      { id: "sh-11", number: "E3.0", title: "Power Plan", markerCount: 5 },
      { id: "sh-12", number: "E4.0", title: "Panel Schedules", markerCount: 0 },
    ],
  },
]

// ─── Markers ──────────────────────────────────────────────

export const MOCK_MARKERS: MockMarker[] = [
  {
    id: "mk-1",
    label: "10/S2.0",
    type: "detail",
    targetSheet: "S2.0",
    targetSheetTitle: "Foundation Details",
    detailNumber: "10",
    confidence: 0.98,
    top: 35,
    left: 42,
    width: 3,
    height: 3,
  },
  {
    id: "mk-2",
    label: "5/S2.0",
    type: "detail",
    targetSheet: "S2.0",
    targetSheetTitle: "Foundation Details",
    detailNumber: "5",
    confidence: 0.97,
    top: 12,
    left: 15,
    width: 3,
    height: 3,
  },
  {
    id: "mk-3",
    label: "A",
    type: "section",
    confidence: 0.95,
    description: "Building Section A-A",
    top: 50,
    left: 5,
    width: 90,
    height: 2,
  },
  {
    id: "mk-4",
    label: "1",
    type: "elevation",
    confidence: 0.92,
    description: "North Elevation",
    top: 8,
    left: 60,
    width: 3,
    height: 3,
  },
  {
    id: "mk-5",
    label: "GN-3",
    type: "note",
    confidence: 0.72,
    description: "See general note 3",
    top: 65,
    left: 78,
    width: 3,
    height: 3,
  },
]

// ─── Regions ──────────────────────────────────────────────

export const MOCK_REGIONS: MockRegion[] = [
  {
    id: "rg-1",
    label: "Footing Schedule",
    type: "schedule",
    top: 50,
    left: 70,
    width: 28,
    height: 12,
  },
  {
    id: "rg-2",
    label: "Pier Schedule",
    type: "schedule",
    top: 35,
    left: 70,
    width: 28,
    height: 12,
  },
  {
    id: "rg-3",
    label: "General Notes",
    type: "notes",
    content:
      "GENERAL NOTES:\n1. All concrete to CSA A23.1/A23.2.\n2. All reinforcement to CSA G30.18 Grade 400W.\n3. Minimum cover to reinforcement:\n   - Footings: 75mm\n   - Piers: 40mm\n4. Foundation design based on allowable bearing pressure of 150 kPa.",
    top: 45,
    left: 2,
    width: 25,
    height: 30,
  },
  {
    id: "rg-4",
    label: "Slab & Deck Legend",
    type: "legend",
    top: 28,
    left: 35,
    width: 20,
    height: 18,
  },
]

// ─── Notifications ────────────────────────────────────────

export const MOCK_NOTIFICATIONS: MockNotification[] = [
  {
    id: "n-1",
    title: "Plan Processing Complete",
    body: "Holabird Ave plans are ready to view.",
    time: "2h ago",
    type: "success",
    read: false,
  },
  {
    id: "n-2",
    title: "New Issue Flagged",
    body: "Mike flagged an issue at detail 5/A7 — missing rebar.",
    time: "5h ago",
    type: "alert",
    read: false,
  },
  {
    id: "n-3",
    title: "Photo Uploaded",
    body: "Sarah uploaded 6 new photos to Riverside Apartments.",
    time: "8h ago",
    type: "info",
    read: false,
  },
  {
    id: "n-4",
    title: "Trial Ending Soon",
    body: "Your Pro trial ends in 3 days. Upgrade to keep all features.",
    time: "1d ago",
    type: "info",
    read: true,
  },
  {
    id: "n-5",
    title: "Sheet Updated",
    body: "Floor 2 Electrical (E2.0) has been revised.",
    time: "2d ago",
    type: "info",
    read: true,
  },
  {
    id: "n-6",
    title: "Daily Summary Ready",
    body: "Your AI-generated daily report for Holabird Ave is ready.",
    time: "2d ago",
    type: "success",
    read: true,
  },
  {
    id: "n-7",
    title: "New Team Member",
    body: "David Lee joined Riverside Apartments as Member.",
    time: "3d ago",
    type: "info",
    read: true,
  },
  {
    id: "n-8",
    title: "RFI Sent",
    body: "RFI-001 for missing foundation detail sent to architect.",
    time: "4d ago",
    type: "success",
    read: true,
  },
  {
    id: "n-9",
    title: "Low Confidence Markers",
    body: "3 markers on S3.0 need review (confidence < 80%).",
    time: "5d ago",
    type: "alert",
    read: true,
  },
  {
    id: "n-10",
    title: "Sync Complete",
    body: "All offline changes synced successfully.",
    time: "1w ago",
    type: "success",
    read: true,
  },
]

// ─── Team Members ─────────────────────────────────────────

export const MOCK_TEAM_MEMBERS: MockTeamMember[] = [
  {
    id: "tm-1",
    name: "John Smith",
    email: "john@smithelectrical.com",
    role: "Owner",
    initials: "JS",
  },
  { id: "tm-2", name: "Mike Chen", email: "mike@construction.co", role: "Admin", initials: "MC" },
  { id: "tm-3", name: "Sarah Johnson", email: "sarah@design.co", role: "Member", initials: "SJ" },
  { id: "tm-4", name: "David Lee", email: "david@plumbing.co", role: "Member", initials: "DL" },
  { id: "tm-5", name: "Emily Brown", email: "emily@electrical.co", role: "Viewer", initials: "EB" },
]

// ─── Timeline Photos ─────────────────────────────────────

const PHOTO_COLORS = [
  "#6366f1",
  "#8b5cf6",
  "#a855f7",
  "#d946ef",
  "#ec4899",
  "#f43f5e",
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#14b8a6",
  "#06b6d4",
  "#3b82f6",
]

function photoColor(index: number) {
  return PHOTO_COLORS[index % PHOTO_COLORS.length]
}

export const MOCK_TIMELINE_PHOTOS: MockDateCluster[] = [
  {
    label: "Today",
    photos: [
      {
        id: "ph-1",
        timestamp: "2024-03-13T14:30:00",
        timeLabel: "2:30 PM",
        hasVoiceNote: true,
        voiceDuration: "0:12",
        voiceTranscript: "Foundation pour complete on grid line 4. Rebar inspection passed.",
        isIssue: false,
        color: photoColor(0),
      },
      {
        id: "ph-2",
        timestamp: "2024-03-13T14:15:00",
        timeLabel: "2:15 PM",
        hasVoiceNote: false,
        isIssue: true,
        color: photoColor(1),
      },
      {
        id: "ph-3",
        timestamp: "2024-03-13T11:45:00",
        timeLabel: "11:45 AM",
        hasVoiceNote: false,
        isIssue: false,
        color: photoColor(2),
      },
      {
        id: "ph-4",
        timestamp: "2024-03-13T10:20:00",
        timeLabel: "10:20 AM",
        hasVoiceNote: true,
        voiceDuration: "0:08",
        voiceTranscript: "Concrete truck arrived. Starting west wing pour.",
        isIssue: false,
        color: photoColor(3),
      },
      {
        id: "ph-5",
        timestamp: "2024-03-13T09:00:00",
        timeLabel: "9:00 AM",
        hasVoiceNote: false,
        isIssue: false,
        color: photoColor(4),
      },
      {
        id: "ph-6",
        timestamp: "2024-03-13T08:30:00",
        timeLabel: "8:30 AM",
        hasVoiceNote: false,
        isIssue: false,
        color: photoColor(5),
      },
    ],
  },
  {
    label: "Yesterday",
    photos: [
      {
        id: "ph-7",
        timestamp: "2024-03-12T16:00:00",
        timeLabel: "4:00 PM",
        hasVoiceNote: false,
        isIssue: false,
        color: photoColor(6),
      },
      {
        id: "ph-8",
        timestamp: "2024-03-12T14:30:00",
        timeLabel: "2:30 PM",
        hasVoiceNote: true,
        voiceDuration: "0:15",
        voiceTranscript: "Conduit run from panel 2A to junction box B7 complete.",
        isIssue: false,
        color: photoColor(7),
      },
      {
        id: "ph-9",
        timestamp: "2024-03-12T11:00:00",
        timeLabel: "11:00 AM",
        hasVoiceNote: false,
        isIssue: true,
        color: photoColor(8),
      },
      {
        id: "ph-10",
        timestamp: "2024-03-12T09:15:00",
        timeLabel: "9:15 AM",
        hasVoiceNote: false,
        isIssue: false,
        color: photoColor(9),
      },
    ],
  },
  {
    label: "Mar 11",
    photos: [
      {
        id: "ph-11",
        timestamp: "2024-03-11T15:30:00",
        timeLabel: "3:30 PM",
        hasVoiceNote: false,
        isIssue: false,
        color: photoColor(10),
      },
      {
        id: "ph-12",
        timestamp: "2024-03-11T10:00:00",
        timeLabel: "10:00 AM",
        hasVoiceNote: false,
        isIssue: false,
        color: photoColor(11),
      },
    ],
  },
]

// ─── Schedule Groups ──────────────────────────────────────

export const MOCK_SCHEDULE_GROUPS: MockScheduleGroup[] = [
  {
    id: "sg-1",
    title: "Footing Schedule",
    sheetNumber: "S0.0",
    entries: [
      {
        id: "se-1",
        mark: "F1",
        scheduleType: "footing",
        confidence: 0.96,
        properties: {
          Size: "1500 \u00d7 1500 \u00d7 300",
          Reinforcing: "4-N16 E.W.",
          Concrete: "32 MPa",
          Cover: "50mm",
        },
      },
      {
        id: "se-2",
        mark: "F2",
        scheduleType: "footing",
        confidence: 0.93,
        properties: {
          Size: "2000 \u00d7 2000 \u00d7 400",
          Reinforcing: "6-N20 E.W.",
          Concrete: "32 MPa",
          Cover: "50mm",
        },
      },
      {
        id: "se-3",
        mark: "F3",
        scheduleType: "footing",
        confidence: 0.91,
        properties: {
          Size: "2500 \u00d7 2500 \u00d7 500",
          Reinforcing: "8-N20 E.W.",
          Concrete: "40 MPa",
          Cover: "75mm",
          Notes: "Step down 300mm at grid line 4",
        },
      },
      {
        id: "se-4",
        mark: "F4",
        scheduleType: "footing",
        confidence: 0.88,
        properties: {
          Size: "1200 \u00d7 1200 \u00d7 250",
          Reinforcing: "4-N12 E.W.",
          Concrete: "32 MPa",
          Cover: "50mm",
        },
      },
      {
        id: "se-5",
        mark: "F5",
        scheduleType: "footing",
        confidence: 0.94,
        properties: {
          Size: "3000 \u00d7 1500 \u00d7 450",
          Reinforcing: "6-N20 L.W., 4-N16 S.W.",
          Concrete: "40 MPa",
          Cover: "75mm",
          Notes: "Combined footing at grid A-3",
        },
      },
      {
        id: "se-6",
        mark: "F6",
        scheduleType: "footing",
        confidence: 0.9,
        properties: {
          Size: "1800 \u00d7 1800 \u00d7 350",
          Reinforcing: "5-N16 E.W.",
          Concrete: "32 MPa",
          Cover: "50mm",
        },
      },
    ],
  },
  {
    id: "sg-2",
    title: "Pier Schedule",
    sheetNumber: "S0.0",
    entries: [
      {
        id: "se-7",
        mark: "P1",
        scheduleType: "pier",
        confidence: 0.94,
        properties: {
          Size: "450 \u00d7 450",
          Verticals: "4-N25",
          Ties: "N10 @ 200",
          Concrete: "40 MPa",
        },
      },
      {
        id: "se-8",
        mark: "P2",
        scheduleType: "pier",
        confidence: 0.91,
        properties: {
          Size: "600 \u00d7 600",
          Verticals: "8-N28",
          Ties: "N12 @ 150",
          Concrete: "40 MPa",
        },
      },
      {
        id: "se-9",
        mark: "P3",
        scheduleType: "pier",
        confidence: 0.78,
        properties: {
          Size: "350 \u00d7 350",
          Verticals: "4-N20",
          Ties: "N10 @ 250",
          Concrete: "32 MPa",
        },
      },
      {
        id: "se-10",
        mark: "P4",
        scheduleType: "pier",
        confidence: 0.95,
        properties: {
          Size: "750 \u00d7 750",
          Verticals: "12-N32",
          Ties: "N12 @ 100",
          Concrete: "50 MPa",
        },
      },
    ],
  },
]

// ─── Search Results ───────────────────────────────────────

export const MOCK_SEARCH_RESULTS: MockSearchResult[] = [
  {
    id: "sr-1",
    type: "sheet",
    title: "Foundation Plan",
    subtitle: "S1.0 \u00b7 Structural",
    snippet: "91 callout markers detected",
    matchTerm: "foundation",
    sheetNumber: "S1.0",
  },
  {
    id: "sr-2",
    type: "schedule",
    title: "Footing Schedule \u2014 F3",
    subtitle: "S0.0 \u00b7 Cover & Schedules",
    snippet: "2500 \u00d7 2500 \u00d7 500, 8-N20 E.W., 40 MPa concrete",
    matchTerm: "concrete",
    sheetNumber: "S0.0",
  },
  {
    id: "sr-3",
    type: "notes",
    title: "General Notes",
    subtitle: "S0.0 \u00b7 Cover & Schedules",
    snippet: "All concrete to CSA A23.1/A23.2",
    matchTerm: "concrete",
    sheetNumber: "S0.0",
  },
  {
    id: "sr-4",
    type: "callout",
    title: "Detail 10/S2.0",
    subtitle: "S1.0 \u00b7 Foundation Plan",
    snippet: "Foundation detail at grid intersection",
    matchTerm: "foundation",
    sheetNumber: "S1.0",
  },
  {
    id: "sr-5",
    type: "schedule",
    title: "Pier Schedule \u2014 P4",
    subtitle: "S0.0 \u00b7 Cover & Schedules",
    snippet: "750 \u00d7 750, 12-N32, 50 MPa concrete",
    matchTerm: "concrete",
    sheetNumber: "S0.0",
  },
  {
    id: "sr-6",
    type: "notes",
    title: "Foundation Notes",
    subtitle: "S1.0 \u00b7 Foundation Plan",
    snippet: "All footings to bear on undisturbed native soil",
    matchTerm: "foundation",
    sheetNumber: "S1.0",
  },
]

// ─── Report Text ──────────────────────────────────────────

export const MOCK_REPORT_TEXT = {
  project: "Holabird Ave Warehouse",
  date: "March 13, 2024",
  weather: "Partly Cloudy, 52\u00b0F",
  workPerformed: [
    "Foundation pour completed for west wing grid lines 3-7",
    "Rebar inspection passed for pier P2 and P4",
    "Conduit installation from panel 2A to junction boxes B5-B7",
    "Formwork stripped from east wing footings F1-F3",
    "Gravel backfill placed around completed foundations",
  ],
  issues: [
    {
      text: "Missing rebar at detail 5/A7 \u2014 structural engineer notified",
      voiceNote: true,
      location: "Grid A7, Foundation Plan S1.0",
    },
    {
      text: "Concrete delivery delayed 45 min due to batch plant issue",
      voiceNote: false,
      location: "West wing",
    },
  ],
  photos: [
    { time: "2:30 PM", location: "Grid line 4", isIssue: false },
    { time: "2:15 PM", location: "Grid A7", isIssue: true },
    { time: "11:45 AM", location: "East wing", isIssue: false },
    { time: "10:20 AM", location: "West wing", isIssue: false },
  ],
}

// ─── RFI Content ──────────────────────────────────────────

export const MOCK_RFI_CONTENT = {
  number: "RFI-001",
  date: "March 13, 2024",
  project: "Holabird Ave Warehouse",
  to: "Johnson & Associates, Structural Engineers",
  from: "Smith Electrical LLC",
  subject: "Missing Reinforcement Detail at Grid A7",
  description: [
    "During foundation work on March 13, 2024, our field team identified that the rebar layout at grid intersection A7 does not match the detail shown on sheet S2.0, Detail 5.",
    "Specifically, the drawing calls for 6-N20 E.W. reinforcement, but the as-built condition shows only 4-N16 bars in the east-west direction. Photos and a voice note documenting the discrepancy are attached.",
    "Please advise on the correct reinforcement requirement and any remediation steps needed before the concrete pour scheduled for March 15.",
  ],
  references: [
    "Sheet S1.0 \u2014 Foundation Plan, Grid A7",
    "Sheet S2.0 \u2014 Detail 5/S2.0",
    "Field Photo (March 13, 2:15 PM)",
  ],
}

// ─── Recent Searches ──────────────────────────────────────

export const MOCK_RECENT_SEARCHES = ["concrete", "foundation", "rebar", "grid A7"]

// ─── Share Options ────────────────────────────────────────

export const MOCK_SHARE_OPTIONS = [
  { id: "so-1", label: "Copy Link", icon: "Link" as const },
  { id: "so-2", label: "Email", icon: "Mail" as const },
  { id: "so-3", label: "Messages", icon: "MessageSquare" as const },
  { id: "so-4", label: "Export PDF", icon: "FileText" as const },
]

// ─── Subscription Plans ───────────────────────────────────

export const MOCK_SUBSCRIPTION_PLANS = [
  {
    id: "plan-1",
    name: "Starter",
    price: "Free",
    desc: "1 project, 2 plans, basic capture",
    recommended: false,
  },
  {
    id: "plan-2",
    name: "Pro",
    price: "$29/mo",
    desc: "Unlimited projects, AI features, team",
    recommended: true,
  },
  {
    id: "plan-3",
    name: "Business",
    price: "$79/mo",
    desc: "Everything in Pro + priority support, SSO",
    recommended: false,
  },
]

// ─── Help Topics ──────────────────────────────────────────

export const MOCK_HELP_TOPICS = [
  { id: "ht-1", title: "Getting Started", description: "Learn the basics of SiteLink" },
  { id: "ht-2", title: "Uploading Plans", description: "PDF and image upload guides" },
  { id: "ht-3", title: "Photo Capture", description: "Taking and organizing field photos" },
  { id: "ht-4", title: "AI Features", description: "Daily reports, RFIs, and plan intelligence" },
  { id: "ht-5", title: "Offline Mode", description: "Working without internet connection" },
  { id: "ht-6", title: "Team Management", description: "Adding members and managing roles" },
]
