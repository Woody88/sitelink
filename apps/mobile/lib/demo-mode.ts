// lib/demo-mode.ts
// Demo mode orchestrator — seeds LiveStore with realistic construction data
// when EXPO_PUBLIC_DEMO_MODE=true. No new tables, events, or domain changes.
//
// Uses real plan images from RTA Drawings Vol 1 (US Army Corps of Engineers)
// with YOLO-detected callout marker positions at 72 DPI.

import { events } from "@sitelink/domain";
import type { Store } from "@livestore/livestore";

// ─── Constants ────────────────────────────────────────────
export const DEMO_ORG_ID = "demo-org-001";
export const DEMO_USER_ID = "demo-user-001";
export const DEMO_PROJECT_ID = "demo-project-001";
export const DEMO_PLAN_ID = "demo-plan-001";

export const DEMO_SHEETS = {
	S1: "demo-sheet-s1",
	S2: "demo-sheet-s2",
} as const;

export function isDemoMode(): boolean {
	return process.env.EXPO_PUBLIC_DEMO_MODE === "true";
}

export function getDemoSessionContext() {
	return {
		session: {
			token: "demo-session-token",
			id: "demo-session-id",
			activeOrganizationId: DEMO_ORG_ID,
		},
		user: {
			id: DEMO_USER_ID,
			email: "demo@sitelink.dev",
			name: "Demo User",
		},
	};
}

export function seedDemoData(store: Store): void {
	const now = Date.now();

	// 1. Organization + User
	store.commit(
		events.organizationCreated({
			id: DEMO_ORG_ID,
			name: "RTA Building Renovation",
			ownerId: DEMO_USER_ID,
			ownerEmail: "demo@sitelink.dev",
			ownerName: "Demo User",
			createdAt: now,
		}),
	);

	// 2. Project
	store.commit(
		events.projectCreated({
			id: DEMO_PROJECT_ID,
			organizationId: DEMO_ORG_ID,
			name: "ARTC B440 Renovation \u2014 Structural",
			address: "Fort McClellan, Anniston, AL",
			createdBy: DEMO_USER_ID,
			createdAt: now,
		}),
	);

	// 3. Plan upload
	store.commit(
		events.planUploaded({
			id: DEMO_PLAN_ID,
			projectId: DEMO_PROJECT_ID,
			fileName: "RTA-Structural-Drawings.pdf",
			fileSize: 42_000_000,
			mimeType: "application/pdf",
			localPath: "/demo/RTA-Structural-Drawings.pdf",
			uploadedBy: DEMO_USER_ID,
			uploadedAt: now,
		}),
	);

	// 4. Sheets (2 real structural sheets from RTA Drawings Vol 1)
	// S1 = page 10 (S-131, Overall Roof Plan) — 2448x1584 @ 72 DPI
	// S2 = page 2 (S-003, Typical Details) — 2448x1584 @ 72 DPI
	store.commit(
		events.sheetsReceived({
			projectId: DEMO_PROJECT_ID,
			planId: DEMO_PLAN_ID,
			planName: "RTA-Structural-Drawings",
			sheets: [
				{
					id: DEMO_SHEETS.S1,
					number: "S-131",
					title: "Overall Roof Plan",
					discipline: "Structural",
					localImagePath: "DEMO_PLACEHOLDER",
					localThumbnailPath: "DEMO_PLACEHOLDER",
					imagePath: "DEMO_PLACEHOLDER_S1",
					width: 2448,
					height: 1584,
				},
				{
					id: DEMO_SHEETS.S2,
					number: "S-003",
					title: "Typical Details",
					discipline: "Structural",
					localImagePath: "DEMO_PLACEHOLDER",
					localThumbnailPath: "DEMO_PLACEHOLDER",
					imagePath: "DEMO_PLACEHOLDER_S2",
					width: 2448,
					height: 1584,
				},
			],
		}),
	);

	// 5. Plan processing completed
	store.commit(
		events.planProcessingCompleted({
			planId: DEMO_PLAN_ID,
			sheetCount: 2,
			completedAt: now,
		}),
	);

	// ─── Callout Markers (YOLO-detected at 72 DPI) ───────────

	// Sheet S1: 28 elevation markers detected on Overall Roof Plan
	// Coordinates are normalized 0-1, from real YOLO v8n inference
	store.commit(
		events.sheetCalloutsDetected({
			sheetId: DEMO_SHEETS.S1,
			planId: DEMO_PLAN_ID,
			markers: [
				// Top row — section markers referencing detail sheets
				{ id: "demo-marker-s1-00", label: "A2/S-501", x: 0.2723, y: 0.1132, confidence: 0.962, needsReview: false },
				{ id: "demo-marker-s1-01", label: "A3/S-503", x: 0.4014, y: 0.1134, confidence: 0.954, needsReview: false },
				{ id: "demo-marker-s1-02", label: "A2/S-501", x: 0.2126, y: 0.1130, confidence: 0.942, needsReview: false },
				{ id: "demo-marker-s1-03", label: "A3/S-503", x: 0.4554, y: 0.1134, confidence: 0.941, needsReview: false },
				{ id: "demo-marker-s1-04", label: "A3/S-503", x: 0.1429, y: 0.1134, confidence: 0.914, needsReview: false },
				{ id: "demo-marker-s1-05", label: "A3/S-503", x: 0.3478, y: 0.1133, confidence: 0.886, needsReview: false },
				// Bottom row — matching section cuts
				{ id: "demo-marker-s1-06", label: "A3/S-503", x: 0.4625, y: 0.7477, confidence: 0.880, needsReview: false },
				{ id: "demo-marker-s1-07", label: "A3/S-503", x: 0.3523, y: 0.7479, confidence: 0.876, needsReview: false },
				{ id: "demo-marker-s1-08", label: "A3/S-503", x: 0.4014, y: 0.7476, confidence: 0.870, needsReview: false },
				{ id: "demo-marker-s1-09", label: "A3/S-503", x: 0.2838, y: 0.7479, confidence: 0.868, needsReview: false },
				{ id: "demo-marker-s1-10", label: "A3/S-503", x: 0.1483, y: 0.7477, confidence: 0.860, needsReview: false },
				{ id: "demo-marker-s1-11", label: "A3/S-503", x: 0.4988, y: 0.1168, confidence: 0.848, needsReview: false },
				// Right-side markers
				{ id: "demo-marker-s1-12", label: "A6/S-505", x: 0.6694, y: 0.7434, confidence: 0.819, needsReview: false },
				{ id: "demo-marker-s1-13", label: "A3/S-503", x: 0.7185, y: 0.1077, confidence: 0.811, needsReview: false },
				// Left column — elevation markers
				{ id: "demo-marker-s1-14", label: "D1/S-503", x: 0.0941, y: 0.1827, confidence: 0.810, needsReview: false },
				{ id: "demo-marker-s1-15", label: "A6/S-505", x: 0.5019, y: 0.7431, confidence: 0.800, needsReview: false },
				{ id: "demo-marker-s1-16", label: "G4/S-503", x: 0.0951, y: 0.6864, confidence: 0.789, needsReview: false },
				{ id: "demo-marker-s1-17", label: "A6/S-504", x: 0.5009, y: 0.4942, confidence: 0.783, needsReview: false },
				{ id: "demo-marker-s1-18", label: "A3/S-503", x: 0.2112, y: 0.7477, confidence: 0.772, needsReview: false },
				{ id: "demo-marker-s1-19", label: "D3/S-503", x: 0.0936, y: 0.3098, confidence: 0.755, needsReview: false },
				// Lower confidence detections
				{ id: "demo-marker-s1-20", label: "A3/S-503", x: 0.7625, y: 0.1078, confidence: 0.702, needsReview: false },
				{ id: "demo-marker-s1-21", label: "G4/S-503", x: 0.0936, y: 0.4716, confidence: 0.697, needsReview: true },
				{ id: "demo-marker-s1-22", label: "A3/S-503", x: 0.7125, y: 0.7479, confidence: 0.685, needsReview: true },
				{ id: "demo-marker-s1-23", label: "A6/S-503", x: 0.6680, y: 0.1172, confidence: 0.682, needsReview: true },
				{ id: "demo-marker-s1-24", label: "", x: 0.5695, y: 0.1173, confidence: 0.524, needsReview: true },
				{ id: "demo-marker-s1-25", label: "", x: 0.5666, y: 0.7459, confidence: 0.519, needsReview: true },
				{ id: "demo-marker-s1-26", label: "", x: 0.6674, y: 0.4885, confidence: 0.420, needsReview: true },
				// Title block detection
				{ id: "demo-marker-s1-27", label: "S-131", targetSheetRef: "S-131", x: 0.7884, y: 0.9291, confidence: 0.640, needsReview: false },
			],
			unmatchedCount: 3,
			detectedAt: now,
		}),
	);

	// Sheet S2: No callout markers (details/schedule page — typical for this sheet type)
	store.commit(
		events.sheetCalloutsDetected({
			sheetId: DEMO_SHEETS.S2,
			planId: DEMO_PLAN_ID,
			markers: [],
			unmatchedCount: 0,
			detectedAt: now,
		}),
	);

	// ─── Layout Regions (manually identified from plan images) ─

	// Sheet S1: Notes at bottom of plan
	store.commit(
		events.sheetLayoutRegionsDetected({
			sheetId: DEMO_SHEETS.S1,
			regions: [
				{ id: "demo-region-roof-notes", regionClass: "notes", regionTitle: "Roof Plan Notes", x: 0.01, y: 0.89, width: 0.55, height: 0.07, confidence: 0.91, createdAt: now },
			],
			detectedAt: now,
		}),
	);

	// Sheet S2: 3 schedules + 1 notes region (visible on Typical Details page)
	store.commit(
		events.sheetLayoutRegionsDetected({
			sheetId: DEMO_SHEETS.S2,
			regions: [
				{ id: "demo-region-fastener-sched", regionClass: "schedule", regionTitle: "Roof Deck Fastener Schedule", x: 0.17, y: 0.02, width: 0.34, height: 0.12, confidence: 0.94, createdAt: now },
				{ id: "demo-region-rebar-sched", regionClass: "schedule", regionTitle: "Rebar Lap Splice Schedule", x: 0.22, y: 0.20, width: 0.30, height: 0.26, confidence: 0.92, createdAt: now },
				{ id: "demo-region-cover-sched", regionClass: "schedule", regionTitle: "Concrete Cover Schedule", x: 0.02, y: 0.60, width: 0.28, height: 0.20, confidence: 0.90, createdAt: now },
				{ id: "demo-region-detail-notes", regionClass: "notes", regionTitle: "Structural Detail Notes", x: 0.30, y: 0.62, width: 0.35, height: 0.18, confidence: 0.88, createdAt: now },
			],
			detectedAt: now,
		}),
	);

	// ─── Schedule Entries ─────────────────────────────────────

	// Roof Deck Fastener Schedule (6 entries — matches real table on S-003)
	store.commit(
		events.sheetScheduleExtracted({
			sheetId: DEMO_SHEETS.S2,
			regionId: "demo-region-fastener-sched",
			scheduleType: "fastener",
			entries: [
				{ id: "demo-se-rd1", mark: "End Support/End Lap", properties: JSON.stringify({ Location: "End Support/End Lap", Connection: "#12 TEK SCREW @ 12\" O.C." }), confidence: 0.95, createdAt: now },
				{ id: "demo-se-rd2", mark: "Intermediate Support", properties: JSON.stringify({ Location: "Intermediate Support", Connection: "#12 TEK SCREW @ 12\" O.C." }), confidence: 0.94, createdAt: now },
				{ id: "demo-se-rd3", mark: "Side Lap", properties: JSON.stringify({ Location: "Side Lap", Connection: "3 #10 TEKS/SPAN, 4 SPACES" }), confidence: 0.93, createdAt: now },
				{ id: "demo-se-rd4", mark: "Side Edge Support", properties: JSON.stringify({ Location: "Side Edge Support", Connection: "#12 TEK SCREW @ 12\" O.C." }), confidence: 0.92, createdAt: now },
				{ id: "demo-se-rd5", mark: "Corner Lap", properties: JSON.stringify({ Location: "Corner Lap", Connection: "#12 TEK SCREW TO ENGAGE ALL 4 SHEETS" }), confidence: 0.91, createdAt: now },
			],
			extractedAt: now,
		}),
	);

	// Rebar Lap Splice Schedule (7 entries — matches real table on S-003)
	store.commit(
		events.sheetScheduleExtracted({
			sheetId: DEMO_SHEETS.S2,
			regionId: "demo-region-rebar-sched",
			scheduleType: "rebar",
			entries: [
				{ id: "demo-se-rb3", mark: "#3", properties: JSON.stringify({ "Bar Size": "#3", "Embedment (Top)": "22\"", "Embedment (Other)": "17\"", "Tension Lap (Top)": "29\"", "Tension Lap (Other)": "23\"" }), confidence: 0.96, createdAt: now },
				{ id: "demo-se-rb4", mark: "#4", properties: JSON.stringify({ "Bar Size": "#4", "Embedment (Top)": "29\"", "Embedment (Other)": "22\"", "Tension Lap (Top)": "38\"", "Tension Lap (Other)": "29\"" }), confidence: 0.95, createdAt: now },
				{ id: "demo-se-rb5", mark: "#5", properties: JSON.stringify({ "Bar Size": "#5", "Embedment (Top)": "36\"", "Embedment (Other)": "28\"", "Tension Lap (Top)": "47\"", "Tension Lap (Other)": "37\"" }), confidence: 0.94, createdAt: now },
				{ id: "demo-se-rb6", mark: "#6", properties: JSON.stringify({ "Bar Size": "#6", "Embedment (Top)": "43\"", "Embedment (Other)": "33\"", "Tension Lap (Top)": "56\"", "Tension Lap (Other)": "43\"" }), confidence: 0.93, createdAt: now },
				{ id: "demo-se-rb7", mark: "#7", properties: JSON.stringify({ "Bar Size": "#7", "Embedment (Top)": "63\"", "Embedment (Other)": "48\"", "Tension Lap (Top)": "81\"", "Tension Lap (Other)": "63\"" }), confidence: 0.91, createdAt: now },
				{ id: "demo-se-rb8", mark: "#8", properties: JSON.stringify({ "Bar Size": "#8", "Embedment (Top)": "72\"", "Embedment (Other)": "55\"", "Tension Lap (Top)": "94\"", "Tension Lap (Other)": "72\"" }), confidence: 0.88, createdAt: now },
			],
			extractedAt: now,
		}),
	);

	// Concrete Cover Schedule (5 entries — matches real table on S-003)
	store.commit(
		events.sheetScheduleExtracted({
			sheetId: DEMO_SHEETS.S2,
			regionId: "demo-region-cover-sched",
			scheduleType: "cover",
			entries: [
				{ id: "demo-se-cc1", mark: "Cast Against Earth", properties: JSON.stringify({ "Structural Element": "Concrete Cast Against and Permanently Exposed to Earth", Cover: "3\"" }), confidence: 0.95, createdAt: now },
				{ id: "demo-se-cc2", mark: "Exposed #6+", properties: JSON.stringify({ "Structural Element": "Concrete Exposed to Earth, #6 or Larger", Cover: "2\"" }), confidence: 0.93, createdAt: now },
				{ id: "demo-se-cc3", mark: "Exposed #5-", properties: JSON.stringify({ "Structural Element": "Concrete Exposed to Earth, #5 Bars or Smaller", Cover: "1 1/2\"" }), confidence: 0.91, createdAt: now },
				{ id: "demo-se-cc4", mark: "Weather #6+", properties: JSON.stringify({ "Structural Element": "Concrete Exposed to Weather, #6 or Larger", Cover: "1 1/2\"" }), confidence: 0.90, createdAt: now },
				{ id: "demo-se-cc5", mark: "Not Exposed", properties: JSON.stringify({ "Structural Element": "Concrete Not Exposed to Weather or Contact with Ground", Cover: "1 1/2\"" }), confidence: 0.94, createdAt: now },
			],
			extractedAt: now,
		}),
	);

	// ─── Notes Extraction ─────────────────────────────────────

	// S1: Roof plan notes (visible at bottom of S-131)
	store.commit(
		events.sheetNotesExtracted({
			sheetId: DEMO_SHEETS.S1,
			regionId: "demo-region-roof-notes",
			content: "NOTES:\n1. COORDINATE LOCATIONS AND DIMENSIONS OF ROOF OPENINGS WITH MECHANICAL AND ARCHITECTURAL DRAWINGS. REFER TO F2/S-003 AND F4/S-003 FOR FRAMING AT EXISTING AND NEW ROOF CONDITIONS.\n2. ALL ABANDONED EXISTING ROOF OPENINGS MUST BE REINFORCED AS FOLLOWS AND NESTED WITH THE EXISTING ADJACENT ROOF DECK. REINFORCE EXISTING HOLES AND OPENINGS WITH A 22 GAUGE STEEL DECK AT LEAST 12\" WIDER AND LONGER THAN THE EXISTING OPENING. FASTEN THE STEEL DECK TO THE EXISTING ROOF DECK AT EACH CORNER AT A MAXIMUM OF 6\" ON CENTER.\n3. ATTACH MISCELLANEOUS SUSPENDED CONSTRUCTION TO THE UNDERSIDES OF THE EXISTING JOISTS. DO NOT WELD TO OR DRILL THROUGH EXISTING OPEN WEB STEEL JOISTS CHORDS OR WEBS FOR ATTACHMENT OF SUPPORTED ASSEMBLIES.",
			noteType: "general_notes",
			extractedAt: now,
		}),
	);

	// S2: Structural detail notes (visible on S-003)
	store.commit(
		events.sheetNotesExtracted({
			sheetId: DEMO_SHEETS.S2,
			regionId: "demo-region-detail-notes",
			content: "NOTES:\n1. REMOVE EXISTING CONCRETE FOR INSTALLATION OF UTILITIES SHOWN ON MECHANICAL, ELECTRICAL, AND PLUMBING CONTRACT DRAWINGS OR SHOP DRAWINGS. SAW CUT EXISTING SLAB ON GROUND FULL DEPTH EACH SIDE WHERE UTILITY LINE IS TO BE REMOVED AND/OR REPLACED. UNDERCUT EXISTING SLAB.\n2. REMOVE AND REPLACE EXCAVATED MATERIAL WITH IMPORTED STRUCTURAL FILL OR FLOWABLE CONCRETE FILL (SEE CIVIL FOR REQUIREMENTS).\n3. ADD 4\" CAPILLARY WATER BARRIER. COVER WITH VAPOR BARRIER.\n4. COAT EXISTING SLAB EDGES WITH BONDING AGENT.\n5. DOWELS INTO EXISTING SLAB SHALL BE #4 @ 30\" MAX. O.C. SET 4\" IN EPOXY ADHESIVE.\n6. PLACE NEW CONCRETE, FILLING UNDERCUT.",
			noteType: "general_notes",
			extractedAt: now,
		}),
	);

	console.log("[DemoMode] Seeded demo data: 1 project, 2 sheets, 28 markers, 5 regions, 16 schedule entries");
}
