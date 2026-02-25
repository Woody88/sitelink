// lib/demo-mode.ts
// Demo mode orchestrator — seeds LiveStore with realistic construction data
// when EXPO_PUBLIC_DEMO_MODE=true. No new tables, events, or domain changes.
//
// Uses real plan images from Oakville #3 Public School structural drawings.
// Marker coordinates from YOLO v8n + Gemini Flash pipeline detection at 72 DPI.

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
	S3: "demo-sheet-s3",
	S4: "demo-sheet-s4",
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
			name: "Oakville Construction",
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
			name: "Oakville #3 Public School \u2014 Structural",
			address: "Oakville, ON",
			createdBy: DEMO_USER_ID,
			createdAt: now,
		}),
	);

	// 3. Plan upload
	store.commit(
		events.planUploaded({
			id: DEMO_PLAN_ID,
			projectId: DEMO_PROJECT_ID,
			fileName: "4-Structural-Drawings.pdf",
			fileSize: 14_000_000,
			mimeType: "application/pdf",
			localPath: "/demo/4-Structural-Drawings.pdf",
			uploadedBy: DEMO_USER_ID,
			uploadedAt: now,
		}),
	);

	// 4. Sheets (4 structural sheets — 3456x2592 @ 72 DPI, rotation=90)
	store.commit(
		events.sheetsReceived({
			projectId: DEMO_PROJECT_ID,
			planId: DEMO_PLAN_ID,
			planName: "4-Structural-Drawings",
			sheets: [
				{
					id: DEMO_SHEETS.S1,
					number: "S0.0",
					title: "Cover & Schedules",
					discipline: "Structural",
					localImagePath: "DEMO_PLACEHOLDER",
					localThumbnailPath: "DEMO_PLACEHOLDER",
					imagePath: "DEMO_PLACEHOLDER_S1",
					width: 3456,
					height: 2592,
				},
				{
					id: DEMO_SHEETS.S2,
					number: "S1.0",
					title: "Foundation Plan",
					discipline: "Structural",
					localImagePath: "DEMO_PLACEHOLDER",
					localThumbnailPath: "DEMO_PLACEHOLDER",
					imagePath: "DEMO_PLACEHOLDER_S2",
					width: 3456,
					height: 2592,
				},
				{
					id: DEMO_SHEETS.S3,
					number: "S2.0",
					title: "Foundation Details",
					discipline: "Structural",
					localImagePath: "DEMO_PLACEHOLDER",
					localThumbnailPath: "DEMO_PLACEHOLDER",
					imagePath: "DEMO_PLACEHOLDER_S3",
					width: 3456,
					height: 2592,
				},
				{
					id: DEMO_SHEETS.S4,
					number: "S3.0",
					title: "Second Floor Framing Plan",
					discipline: "Structural",
					localImagePath: "DEMO_PLACEHOLDER",
					localThumbnailPath: "DEMO_PLACEHOLDER",
					imagePath: "DEMO_PLACEHOLDER_S4",
					width: 3456,
					height: 2592,
				},
			],
		}),
	);

	// 5. Plan processing completed
	store.commit(
		events.planProcessingCompleted({
			planId: DEMO_PLAN_ID,
			sheetCount: 4,
			completedAt: now,
		}),
	);

	// ─── Callout Markers (YOLO + Gemini pipeline output) ─────

	// Sheet S0.0 Cover — 1 marker
	store.commit(
		events.sheetCalloutsDetected({
			sheetId: DEMO_SHEETS.S1,
			planId: DEMO_PLAN_ID,
			markers: [
				{ id: "demo-marker-s1-00", label: "", x: 0.4252, y: 0.3744, confidence: 0.522, needsReview: true }
			],
			unmatchedCount: 1,
			detectedAt: now,
		}),
	);

	// Sheet S1.0 Foundation Plan — 91 markers
	store.commit(
		events.sheetCalloutsDetected({
			sheetId: DEMO_SHEETS.S2,
			planId: DEMO_PLAN_ID,
			markers: [
				{ id: "demo-marker-s2-00", label: "10/S2.0", targetSheetId: DEMO_SHEETS.S3, x: 0.4919, y: 0.7919, confidence: 0.985, needsReview: false },
				{ id: "demo-marker-s2-01", label: "10/S2.0", targetSheetId: DEMO_SHEETS.S3, x: 0.3304, y: 0.4018, confidence: 0.983, needsReview: false },
				{ id: "demo-marker-s2-02", label: "11/S2.0", targetSheetId: DEMO_SHEETS.S3, x: 0.2306, y: 0.3837, confidence: 0.983, needsReview: false },
				{ id: "demo-marker-s2-03", label: "18/S2.0", targetSheetId: DEMO_SHEETS.S3, x: 0.5233, y: 0.1983, confidence: 0.982, needsReview: false },
				{ id: "demo-marker-s2-04", label: "12/S2.0", targetSheetId: DEMO_SHEETS.S3, x: 0.2807, y: 0.7822, confidence: 0.982, needsReview: false },
				{ id: "demo-marker-s2-05", label: "5/S2.0", targetSheetId: DEMO_SHEETS.S3, x: 0.1461, y: 0.1182, confidence: 0.982, needsReview: false },
				{ id: "demo-marker-s2-06", label: "8/S2.0", targetSheetId: DEMO_SHEETS.S3, x: 0.7173, y: 0.8744, confidence: 0.982, needsReview: false },
				{ id: "demo-marker-s2-07", label: "1/S2.0", targetSheetId: DEMO_SHEETS.S3, x: 0.1422, y: 0.5768, confidence: 0.981, needsReview: false },
				{ id: "demo-marker-s2-08", label: "10/S2.0", targetSheetId: DEMO_SHEETS.S3, x: 0.3996, y: 0.8140, confidence: 0.981, needsReview: false },
				{ id: "demo-marker-s2-09", label: "11/S2.0", targetSheetId: DEMO_SHEETS.S3, x: 0.6017, y: 0.6636, confidence: 0.980, needsReview: false },
				{ id: "demo-marker-s2-10", label: "15/S2.0", targetSheetId: DEMO_SHEETS.S3, x: 0.2718, y: 0.1665, confidence: 0.980, needsReview: false },
				{ id: "demo-marker-s2-11", label: "11/S2.0", targetSheetId: DEMO_SHEETS.S3, x: 0.2222, y: 0.7313, confidence: 0.980, needsReview: false },
				{ id: "demo-marker-s2-12", label: "11/S2.0", targetSheetId: DEMO_SHEETS.S3, x: 0.3410, y: 0.7664, confidence: 0.980, needsReview: false },
				{ id: "demo-marker-s2-13", label: "10/S2.0", targetSheetId: DEMO_SHEETS.S3, x: 0.2163, y: 0.5326, confidence: 0.980, needsReview: false },
				{ id: "demo-marker-s2-14", label: "11/S2.0", targetSheetId: DEMO_SHEETS.S3, x: 0.6471, y: 0.8270, confidence: 0.980, needsReview: false },
				{ id: "demo-marker-s2-15", label: "8/S2.0", targetSheetId: DEMO_SHEETS.S3, x: 0.4936, y: 0.8231, confidence: 0.980, needsReview: false },
				{ id: "demo-marker-s2-16", label: "5/S2.0", targetSheetId: DEMO_SHEETS.S3, x: 0.1453, y: 0.6086, confidence: 0.980, needsReview: false },
				{ id: "demo-marker-s2-17", label: "8/S2.0", targetSheetId: DEMO_SHEETS.S3, x: 0.5571, y: 0.8752, confidence: 0.980, needsReview: false },
				{ id: "demo-marker-s2-18", label: "3/S2.0", targetSheetId: DEMO_SHEETS.S3, x: 0.1104, y: 0.7324, confidence: 0.979, needsReview: false },
				{ id: "demo-marker-s2-19", label: "15/S2.0", targetSheetId: DEMO_SHEETS.S3, x: 0.2394, y: 0.6366, confidence: 0.979, needsReview: false },
				{ id: "demo-marker-s2-20", label: "10/S2.0", targetSheetId: DEMO_SHEETS.S3, x: 0.1552, y: 0.8202, confidence: 0.979, needsReview: false },
				{ id: "demo-marker-s2-21", label: "11/S2.0", targetSheetId: DEMO_SHEETS.S3, x: 0.5454, y: 0.8264, confidence: 0.979, needsReview: false },
				{ id: "demo-marker-s2-22", label: "9/S2.0", targetSheetId: DEMO_SHEETS.S3, x: 0.4941, y: 0.5955, confidence: 0.979, needsReview: false },
				{ id: "demo-marker-s2-23", label: "3/S2.0", targetSheetId: DEMO_SHEETS.S3, x: 0.6254, y: 0.9616, confidence: 0.978, needsReview: false },
				{ id: "demo-marker-s2-24", label: "16/S2.0", targetSheetId: DEMO_SHEETS.S3, x: 0.6195, y: 0.7598, confidence: 0.978, needsReview: false },
				{ id: "demo-marker-s2-25", label: "8/S2.0", targetSheetId: DEMO_SHEETS.S3, x: 0.6632, y: 0.8736, confidence: 0.978, needsReview: false },
				{ id: "demo-marker-s2-26", label: "11/S2.0", targetSheetId: DEMO_SHEETS.S3, x: 0.6011, y: 0.5693, confidence: 0.978, needsReview: false },
				{ id: "demo-marker-s2-27", label: "11/S2.0", targetSheetId: DEMO_SHEETS.S3, x: 0.4449, y: 0.7647, confidence: 0.978, needsReview: false },
				{ id: "demo-marker-s2-28", label: "18/S2.0", targetSheetId: DEMO_SHEETS.S3, x: 0.5231, y: 0.6354, confidence: 0.978, needsReview: false },
				{ id: "demo-marker-s2-29", label: "11/S2.0", targetSheetId: DEMO_SHEETS.S3, x: 0.2724, y: 0.1300, confidence: 0.978, needsReview: false },
				{ id: "demo-marker-s2-30", label: "10/S2.0", targetSheetId: DEMO_SHEETS.S3, x: 0.7548, y: 0.7926, confidence: 0.977, needsReview: false },
				{ id: "demo-marker-s2-31", label: "4/S2.0", targetSheetId: DEMO_SHEETS.S3, x: 0.1487, y: 0.3455, confidence: 0.977, needsReview: false },
				{ id: "demo-marker-s2-32", label: "4/S2.0", targetSheetId: DEMO_SHEETS.S3, x: 0.3309, y: 0.0444, confidence: 0.977, needsReview: false },
				{ id: "demo-marker-s2-33", label: "9/S2.0", targetSheetId: DEMO_SHEETS.S3, x: 0.4598, y: 0.6748, confidence: 0.976, needsReview: false },
				{ id: "demo-marker-s2-34", label: "3/S2.0", targetSheetId: DEMO_SHEETS.S3, x: 0.1444, y: 0.6480, confidence: 0.976, needsReview: false },
				{ id: "demo-marker-s2-35", label: "4/S2.0", targetSheetId: DEMO_SHEETS.S3, x: 0.4479, y: 0.8843, confidence: 0.976, needsReview: false },
				{ id: "demo-marker-s2-36", label: "15/S2.0", targetSheetId: DEMO_SHEETS.S3, x: 0.2690, y: 0.5100, confidence: 0.976, needsReview: false },
				{ id: "demo-marker-s2-37", label: "19/S2.0", targetSheetId: DEMO_SHEETS.S3, x: 0.5537, y: 0.6053, confidence: 0.976, needsReview: false },
				{ id: "demo-marker-s2-38", label: "10/S2.0", targetSheetId: DEMO_SHEETS.S3, x: 0.2143, y: 0.4250, confidence: 0.976, needsReview: false },
				{ id: "demo-marker-s2-39", label: "10/S2.0", targetSheetId: DEMO_SHEETS.S3, x: 0.2057, y: 0.3090, confidence: 0.975, needsReview: false },
				{ id: "demo-marker-s2-40", label: "1/S2.0", targetSheetId: DEMO_SHEETS.S3, x: 0.2781, y: 0.8700, confidence: 0.975, needsReview: false },
				{ id: "demo-marker-s2-41", label: "4/S2.0", targetSheetId: DEMO_SHEETS.S3, x: 0.6953, y: 0.4921, confidence: 0.975, needsReview: false },
				{ id: "demo-marker-s2-42", label: "3/S2.0", targetSheetId: DEMO_SHEETS.S3, x: 0.1981, y: 0.8642, confidence: 0.975, needsReview: false },
				{ id: "demo-marker-s2-43", label: "11/S2.0", targetSheetId: DEMO_SHEETS.S3, x: 0.7711, y: 0.8299, confidence: 0.975, needsReview: false },
				{ id: "demo-marker-s2-44", label: "1/S2.0", targetSheetId: DEMO_SHEETS.S3, x: 0.6053, y: 0.4821, confidence: 0.975, needsReview: false },
				{ id: "demo-marker-s2-45", label: "5/S2.0", targetSheetId: DEMO_SHEETS.S3, x: 0.3941, y: 0.4402, confidence: 0.975, needsReview: false },
				{ id: "demo-marker-s2-46", label: "13/S2.0", targetSheetId: DEMO_SHEETS.S3, x: 0.4562, y: 0.7922, confidence: 0.974, needsReview: false },
				{ id: "demo-marker-s2-47", label: "15/S2.0", targetSheetId: DEMO_SHEETS.S3, x: 0.2739, y: 0.6912, confidence: 0.974, needsReview: false },
				{ id: "demo-marker-s2-48", label: "11/S2.0", targetSheetId: DEMO_SHEETS.S3, x: 0.1989, y: 0.6902, confidence: 0.974, needsReview: false },
				{ id: "demo-marker-s2-49", label: "8/S2.0", targetSheetId: DEMO_SHEETS.S3, x: 0.5991, y: 0.8756, confidence: 0.974, needsReview: false },
				{ id: "demo-marker-s2-50", label: "4/S2.0", targetSheetId: DEMO_SHEETS.S3, x: 0.5503, y: 0.4944, confidence: 0.973, needsReview: false },
				{ id: "demo-marker-s2-51", label: "10/S2.0", targetSheetId: DEMO_SHEETS.S3, x: 0.3336, y: 0.2375, confidence: 0.973, needsReview: false },
				{ id: "demo-marker-s2-52", label: "17/S2.0", targetSheetId: DEMO_SHEETS.S3, x: 0.4975, y: 0.2496, confidence: 0.973, needsReview: false },
				{ id: "demo-marker-s2-53", label: "17/S2.0", targetSheetId: DEMO_SHEETS.S3, x: 0.4957, y: 0.6869, confidence: 0.972, needsReview: false },
				{ id: "demo-marker-s2-54", label: "8/S2.0", targetSheetId: DEMO_SHEETS.S3, x: 0.3377, y: 0.5897, confidence: 0.972, needsReview: false },
				{ id: "demo-marker-s2-55", label: "10/S2.0", targetSheetId: DEMO_SHEETS.S3, x: 0.3302, y: 0.5152, confidence: 0.972, needsReview: false },
				{ id: "demo-marker-s2-56", label: "5/S2.0", targetSheetId: DEMO_SHEETS.S3, x: 0.3924, y: 0.1441, confidence: 0.972, needsReview: false },
				{ id: "demo-marker-s2-57", label: "1/S2.0", targetSheetId: DEMO_SHEETS.S3, x: 0.3997, y: 0.3684, confidence: 0.972, needsReview: false },
				{ id: "demo-marker-s2-58", label: "1/S2.0", targetSheetId: DEMO_SHEETS.S3, x: 0.8325, y: 0.7841, confidence: 0.971, needsReview: false },
				{ id: "demo-marker-s2-59", label: "6/S2.0", targetSheetId: DEMO_SHEETS.S3, x: 0.4554, y: 0.5667, confidence: 0.971, needsReview: false },
				{ id: "demo-marker-s2-60", label: "10/S2.0", targetSheetId: DEMO_SHEETS.S3, x: 0.2125, y: 0.1958, confidence: 0.971, needsReview: false },
				{ id: "demo-marker-s2-61", label: "10/S2.0", targetSheetId: DEMO_SHEETS.S3, x: 0.5741, y: 0.7930, confidence: 0.971, needsReview: false },
				{ id: "demo-marker-s2-62", label: "2/S2.0", targetSheetId: DEMO_SHEETS.S3, x: 0.4912, y: 0.9240, confidence: 0.971, needsReview: false },
				{ id: "demo-marker-s2-63", label: "11/S2.0", targetSheetId: DEMO_SHEETS.S3, x: 0.3310, y: 0.1337, confidence: 0.970, needsReview: false },
				{ id: "demo-marker-s2-64", label: "14/S2.0", targetSheetId: DEMO_SHEETS.S3, x: 0.3770, y: 0.6833, confidence: 0.970, needsReview: false },
				{ id: "demo-marker-s2-65", label: "7/S2.0", targetSheetId: DEMO_SHEETS.S3, x: 0.8274, y: 0.6345, confidence: 0.970, needsReview: false },
				{ id: "demo-marker-s2-66", label: "6/S2.0", targetSheetId: DEMO_SHEETS.S3, x: 0.4389, y: 0.5918, confidence: 0.969, needsReview: false },
				{ id: "demo-marker-s2-67", label: "4/S2.0", targetSheetId: DEMO_SHEETS.S3, x: 0.1979, y: 0.0405, confidence: 0.969, needsReview: false },
				{ id: "demo-marker-s2-68", label: "1/S2.0", targetSheetId: DEMO_SHEETS.S3, x: 0.4855, y: 0.5041, confidence: 0.968, needsReview: false },
				{ id: "demo-marker-s2-69", label: "16/S2.0", targetSheetId: DEMO_SHEETS.S3, x: 0.7245, y: 0.7193, confidence: 0.968, needsReview: false },
				{ id: "demo-marker-s2-70", label: "1/S2.0", targetSheetId: DEMO_SHEETS.S3, x: 0.2716, y: 0.0797, confidence: 0.967, needsReview: false },
				{ id: "demo-marker-s2-71", label: "15/S2.0", targetSheetId: DEMO_SHEETS.S3, x: 0.2383, y: 0.1470, confidence: 0.967, needsReview: false },
				{ id: "demo-marker-s2-72", label: "19/S2.0", targetSheetId: DEMO_SHEETS.S3, x: 0.5535, y: 0.1686, confidence: 0.967, needsReview: false },
				{ id: "demo-marker-s2-73", label: "5/S2.0", targetSheetId: DEMO_SHEETS.S3, x: 0.3935, y: 0.2921, confidence: 0.967, needsReview: false },
				{ id: "demo-marker-s2-74", label: "1/S2.0", targetSheetId: DEMO_SHEETS.S3, x: 0.3997, y: 0.2459, confidence: 0.967, needsReview: false },
				{ id: "demo-marker-s2-75", label: "10/S2.0", targetSheetId: DEMO_SHEETS.S3, x: 0.1923, y: 0.3611, confidence: 0.966, needsReview: false },
				{ id: "demo-marker-s2-76", label: "10/S2.0", targetSheetId: DEMO_SHEETS.S3, x: 0.3281, y: 0.3549, confidence: 0.966, needsReview: false },
				{ id: "demo-marker-s2-77", label: "10/S2.0", targetSheetId: DEMO_SHEETS.S3, x: 0.5181, y: 0.7282, confidence: 0.965, needsReview: false },
				{ id: "demo-marker-s2-78", label: "18/S2.0", targetSheetId: DEMO_SHEETS.S3, x: 0.5532, y: 0.5710, confidence: 0.964, needsReview: false },
				{ id: "demo-marker-s2-79", label: "20/S2.0", targetSheetId: DEMO_SHEETS.S3, x: 0.8306, y: 0.9632, confidence: 0.963, needsReview: false },
				{ id: "demo-marker-s2-80", label: "2/S2.0", targetSheetId: DEMO_SHEETS.S3, x: 0.8274, y: 0.8910, confidence: 0.962, needsReview: false },
				{ id: "demo-marker-s2-81", label: "1/S2.0", targetSheetId: DEMO_SHEETS.S3, x: 0.4000, y: 0.5095, confidence: 0.962, needsReview: false },
				{ id: "demo-marker-s2-82", label: "7/S2.0", targetSheetId: DEMO_SHEETS.S3, x: 0.8277, y: 0.7133, confidence: 0.961, needsReview: false },
				{ id: "demo-marker-s2-83", label: "4/S2.0", targetSheetId: DEMO_SHEETS.S3, x: 0.3378, y: 0.8868, confidence: 0.957, needsReview: false },
				{ id: "demo-marker-s2-84", label: "1/S2.0", targetSheetId: DEMO_SHEETS.S3, x: 0.3896, y: 0.0760, confidence: 0.955, needsReview: false },
				{ id: "demo-marker-s2-85", label: "10", x: 0.4920, y: 0.7861, confidence: 0.929, needsReview: false },
				{ id: "demo-marker-s2-86", label: "1/S2.0", targetSheetId: DEMO_SHEETS.S3, x: 0.5747, y: 0.7861, confidence: 0.927, needsReview: false },
				{ id: "demo-marker-s2-87", label: "10", x: 0.8313, y: 0.5567, confidence: 0.927, needsReview: false },
				{ id: "demo-marker-s2-88", label: "", x: 0.7555, y: 0.7859, confidence: 0.920, needsReview: true },
				{ id: "demo-marker-s2-89", label: "", x: 0.4563, y: 0.7863, confidence: 0.906, needsReview: true },
				{ id: "demo-marker-s2-90", label: "1/S2.0", targetSheetId: DEMO_SHEETS.S3, x: 0.4925, y: 0.8848, confidence: 0.838, needsReview: true }
			],
			unmatchedCount: 4,
			detectedAt: now,
		}),
	);

	// Sheet S2.0 Foundation Details — 4 markers
	store.commit(
		events.sheetCalloutsDetected({
			sheetId: DEMO_SHEETS.S3,
			planId: DEMO_PLAN_ID,
			markers: [
				{ id: "demo-marker-s3-00", label: "14/S1.0", targetSheetId: DEMO_SHEETS.S2, x: 0.6337, y: 0.7843, confidence: 0.956, needsReview: false },
				{ id: "demo-marker-s3-01", label: "17/S1.0", targetSheetId: DEMO_SHEETS.S2, x: 0.5545, y: 0.9794, confidence: 0.947, needsReview: false },
				{ id: "demo-marker-s3-02", label: "15/S1.0", targetSheetId: DEMO_SHEETS.S2, x: 0.7600, y: 0.7841, confidence: 0.917, needsReview: false },
				{ id: "demo-marker-s3-03", label: "13/S1.0", targetSheetId: DEMO_SHEETS.S2, x: 0.4990, y: 0.7841, confidence: 0.910, needsReview: false }
			],
			unmatchedCount: 0,
			detectedAt: now,
		}),
	);

	// Sheet S3.0 Framing Plan — 26 markers
	store.commit(
		events.sheetCalloutsDetected({
			sheetId: DEMO_SHEETS.S4,
			planId: DEMO_PLAN_ID,
			markers: [
				{ id: "demo-marker-s4-00", label: "5", x: 0.1428, y: 0.3798, confidence: 0.981, needsReview: false },
				{ id: "demo-marker-s4-01", label: "11", x: 0.7969, y: 0.6715, confidence: 0.977, needsReview: false },
				{ id: "demo-marker-s4-02", label: "9", x: 0.3925, y: 0.8486, confidence: 0.975, needsReview: false },
				{ id: "demo-marker-s4-03", label: "1", x: 0.2548, y: 0.8250, confidence: 0.975, needsReview: false },
				{ id: "demo-marker-s4-04", label: "13", x: 0.6056, y: 0.4990, confidence: 0.975, needsReview: false },
				{ id: "demo-marker-s4-05", label: "6", x: 0.1824, y: 0.7724, confidence: 0.975, needsReview: false },
				{ id: "demo-marker-s4-06", label: "2", x: 0.2148, y: 0.7936, confidence: 0.971, needsReview: false },
				{ id: "demo-marker-s4-07", label: "4", x: 0.1039, y: 0.8111, confidence: 0.970, needsReview: false },
				{ id: "demo-marker-s4-08", label: "18", x: 0.7691, y: 0.9581, confidence: 0.968, needsReview: false },
				{ id: "demo-marker-s4-09", label: "14", x: 0.6942, y: 0.7133, confidence: 0.967, needsReview: false },
				{ id: "demo-marker-s4-10", label: "3", x: 0.3142, y: 0.7301, confidence: 0.967, needsReview: false },
				{ id: "demo-marker-s4-11", label: "4", x: 0.3284, y: 0.8490, confidence: 0.964, needsReview: false },
				{ id: "demo-marker-s4-12", label: "15", x: 0.2685, y: 0.0777, confidence: 0.960, needsReview: false },
				{ id: "demo-marker-s4-13", label: "1", x: 0.8316, y: 0.7870, confidence: 0.957, needsReview: false },
				{ id: "demo-marker-s4-14", label: "3", x: 0.4834, y: 0.8370, confidence: 0.956, needsReview: false },
				{ id: "demo-marker-s4-15", label: "10", x: 0.7963, y: 0.5548, confidence: 0.952, needsReview: false },
				{ id: "demo-marker-s4-16", label: "12", x: 0.5764, y: 0.6186, confidence: 0.948, needsReview: false },
				{ id: "demo-marker-s4-17", label: "9", x: 0.2526, y: 0.8432, confidence: 0.892, needsReview: true },
				{ id: "demo-marker-s4-18", label: "2", x: 0.4777, y: 0.9570, confidence: 0.857, needsReview: true },
				{ id: "demo-marker-s4-19", label: "", x: 0.3384, y: 0.4246, confidence: 0.393, needsReview: true },
				{ id: "demo-marker-s4-20", label: "", x: 0.2023, y: 0.7562, confidence: 0.356, needsReview: true },
				{ id: "demo-marker-s4-21", label: "", x: 0.6526, y: 0.8686, confidence: 0.845, needsReview: true },
				{ id: "demo-marker-s4-22", label: "", x: 0.3466, y: 0.0548, confidence: 0.764, needsReview: true },
				{ id: "demo-marker-s4-23", label: "", x: 0.1755, y: 0.4605, confidence: 0.694, needsReview: true },
				{ id: "demo-marker-s4-24", label: "", x: 0.4941, y: 0.7215, confidence: 0.461, needsReview: true },
				{ id: "demo-marker-s4-25", label: "", x: 0.4852, y: 0.6181, confidence: 0.369, needsReview: true }
			],
			unmatchedCount: 26,
			detectedAt: now,
		}),
	);

	// ─── Layout Regions (fabricated positions) ────────────────

	// Sheet S1 regions (cover page has visible schedules + legend)
	store.commit(
		events.sheetLayoutRegionsDetected({
			sheetId: DEMO_SHEETS.S1,
			regions: [
				{ id: "demo-region-footing-sched", regionClass: "schedule", regionTitle: "Footing Schedule", x: 0.70, y: 0.50, width: 0.28, height: 0.12, confidence: 0.95, createdAt: now },
				{ id: "demo-region-pier-sched", regionClass: "schedule", regionTitle: "Pier Schedule", x: 0.70, y: 0.35, width: 0.28, height: 0.12, confidence: 0.92, createdAt: now },
				{ id: "demo-region-struct-notes", regionClass: "notes", regionTitle: "General Notes", x: 0.02, y: 0.45, width: 0.25, height: 0.30, confidence: 0.89, createdAt: now },
				{ id: "demo-region-struct-legend", regionClass: "legend", regionTitle: "Slab & Deck Legend", x: 0.35, y: 0.28, width: 0.20, height: 0.18, confidence: 0.91, createdAt: now },
			],
			detectedAt: now,
		}),
	);

	// Sheet S2 regions (foundation plan has legend + notes)
	store.commit(
		events.sheetLayoutRegionsDetected({
			sheetId: DEMO_SHEETS.S2,
			regions: [
				{ id: "demo-region-fdn-legend", regionClass: "legend", regionTitle: "Foundation Legend", x: 0.78, y: 0.02, width: 0.20, height: 0.15, confidence: 0.93, createdAt: now },
				{ id: "demo-region-fdn-notes", regionClass: "notes", regionTitle: "Foundation Notes", x: 0.78, y: 0.18, width: 0.20, height: 0.15, confidence: 0.90, createdAt: now },
			],
			detectedAt: now,
		}),
	);

	// Sheet S3 (details page — no schedule/notes regions)

	// Sheet S4 regions (framing plan has notes)
	store.commit(
		events.sheetLayoutRegionsDetected({
			sheetId: DEMO_SHEETS.S4,
			regions: [
				{ id: "demo-region-framing-notes", regionClass: "notes", regionTitle: "Framing Notes", x: 0.78, y: 0.02, width: 0.20, height: 0.12, confidence: 0.88, createdAt: now },
			],
			detectedAt: now,
		}),
	);

	// ─── Schedule Entries (fabricated realistic data) ────────

	// Footing Schedule on S1 (6 entries)
	store.commit(
		events.sheetScheduleExtracted({
			sheetId: DEMO_SHEETS.S1,
			regionId: "demo-region-footing-sched",
			scheduleType: "footing",
			entries: [
				{ id: "demo-se-f1", mark: "F1", properties: JSON.stringify({ Size: "1500 \u00d7 1500 \u00d7 300", Reinforcing: "4-N16 E.W.", Concrete: "32 MPa", Cover: "50mm" }), confidence: 0.96, createdAt: now },
				{ id: "demo-se-f2", mark: "F2", properties: JSON.stringify({ Size: "2000 \u00d7 2000 \u00d7 400", Reinforcing: "6-N20 E.W.", Concrete: "32 MPa", Cover: "50mm" }), confidence: 0.93, createdAt: now },
				{ id: "demo-se-f3", mark: "F3", properties: JSON.stringify({ Size: "2500 \u00d7 2500 \u00d7 500", Reinforcing: "8-N20 E.W.", Concrete: "40 MPa", Cover: "75mm", Notes: "Step down 300mm at grid line 4" }), confidence: 0.91, createdAt: now },
				{ id: "demo-se-f4", mark: "F4", properties: JSON.stringify({ Size: "1200 \u00d7 1200 \u00d7 250", Reinforcing: "4-N12 E.W.", Concrete: "32 MPa", Cover: "50mm" }), confidence: 0.88, createdAt: now },
				{ id: "demo-se-f5", mark: "F5", properties: JSON.stringify({ Size: "3000 \u00d7 1500 \u00d7 450", Reinforcing: "6-N20 L.W., 4-N16 S.W.", Concrete: "40 MPa", Cover: "75mm", Notes: "Combined footing at grid A-3" }), confidence: 0.94, createdAt: now },
				{ id: "demo-se-f6", mark: "F6", properties: JSON.stringify({ Size: "1800 \u00d7 1800 \u00d7 350", Reinforcing: "5-N16 E.W.", Concrete: "32 MPa", Cover: "50mm" }), confidence: 0.90, createdAt: now },
			],
			extractedAt: now,
		}),
	);

	// Pier Schedule on S1 (4 entries)
	store.commit(
		events.sheetScheduleExtracted({
			sheetId: DEMO_SHEETS.S1,
			regionId: "demo-region-pier-sched",
			scheduleType: "pier",
			entries: [
				{ id: "demo-se-p1", mark: "P1", properties: JSON.stringify({ Size: "450 \u00d7 450", Verticals: "4-N25", Ties: "N10 @ 200", Concrete: "40 MPa" }), confidence: 0.94, createdAt: now },
				{ id: "demo-se-p2", mark: "P2", properties: JSON.stringify({ Size: "600 \u00d7 600", Verticals: "8-N28", Ties: "N12 @ 150", Concrete: "40 MPa" }), confidence: 0.91, createdAt: now },
				{ id: "demo-se-p3", mark: "P3", properties: JSON.stringify({ Size: "350 \u00d7 350", Verticals: "4-N20", Ties: "N10 @ 250", Concrete: "32 MPa" }), confidence: 0.78, createdAt: now },
				{ id: "demo-se-p4", mark: "P4", properties: JSON.stringify({ Size: "750 \u00d7 750", Verticals: "12-N32", Ties: "N12 @ 100", Concrete: "50 MPa" }), confidence: 0.95, createdAt: now },
			],
			extractedAt: now,
		}),
	);

	// ─── Notes Extraction (fabricated) ──────────────────────

	store.commit(
		events.sheetNotesExtracted({
			sheetId: DEMO_SHEETS.S1,
			regionId: "demo-region-struct-notes",
			content: "GENERAL NOTES:\n1. All concrete to CSA A23.1/A23.2.\n2. All reinforcement to CSA G30.18 Grade 400W.\n3. Minimum cover to reinforcement:\n   - Footings: 75mm\n   - Piers: 40mm\n   - Slabs on grade: 50mm\n4. Lap lengths per CSA A23.3.\n5. Foundation design based on allowable bearing pressure of 150 kPa.\n6. Contractor to verify site conditions prior to excavation.\n7. All dimensions in millimetres unless noted otherwise.",
			noteType: "general_notes",
			extractedAt: now,
		}),
	);

	store.commit(
		events.sheetNotesExtracted({
			sheetId: DEMO_SHEETS.S2,
			regionId: "demo-region-fdn-notes",
			content: "FOUNDATION NOTES:\n1. All footings to bear on undisturbed native soil or engineered fill.\n2. Minimum 150mm granular base under all footings.\n3. Provide 10M dowels @ 600mm O.C. at construction joints.\n4. Step footings where grade changes exceed 600mm.\n5. Refer to Geotechnical Report for soil conditions.",
			noteType: "general_notes",
			extractedAt: now,
		}),
	);

	store.commit(
		events.sheetNotesExtracted({
			sheetId: DEMO_SHEETS.S4,
			regionId: "demo-region-framing-notes",
			content: "FRAMING NOTES:\n1. All steel framing to CSA S16.\n2. Open web steel joists to SJI specifications.\n3. Provide bridging at third points of joist spans.\n4. Coordinate all roof penetrations with mechanical drawings.\n5. All connections to be designed by steel fabricator.",
			noteType: "general_notes",
			extractedAt: now,
		}),
	);

	// ─── Legend Crops (fabricated) ───────────────────────────

	store.commit(
		events.sheetLegendCropped({
			sheetId: DEMO_SHEETS.S1,
			regionId: "demo-region-struct-legend",
			cropImageUrl: "DEMO_PLACEHOLDER_LEGEND",
			croppedAt: now,
		}),
	);

	store.commit(
		events.sheetLegendCropped({
			sheetId: DEMO_SHEETS.S2,
			regionId: "demo-region-fdn-legend",
			cropImageUrl: "DEMO_PLACEHOLDER_LEGEND",
			croppedAt: now,
		}),
	);

	console.log("[DemoMode] Seeded demo data: 1 project, 4 sheets, 122 markers, 7 regions, 10 schedule entries");
}
