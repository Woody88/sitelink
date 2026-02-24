import { usePlanInfo, type LayoutRegion, type ScheduleEntry } from "./use-plan-info";

export interface ScheduleDrawerGroup {
	region: LayoutRegion;
	entries: ScheduleEntry[];
	sheetNumber: string;
}

// TODO: Remove mock data once DocLayout pipeline (sitelink-bav) populates real data
const MOCK_GROUPS: ScheduleDrawerGroup[] = [
	{
		region: {
			id: "mock-footing",
			sheetId: "mock-sheet",
			regionClass: "schedule",
			regionTitle: "Footing Schedule",
			x: 0.7, y: 0.05, width: 0.25, height: 0.15,
			extractedContent: null,
			cropImageUrl: null,
			confidence: 0.95,
			createdAt: Date.now(),
		},
		entries: [
			{ id: "f1", regionId: "mock-footing", sheetId: "mock-sheet", scheduleType: "footing", mark: "F1", properties: JSON.stringify({ Size: "1500 × 1500 × 300", Reinforcing: "4-N16 E.W.", Concrete: "32 MPa", Cover: "50mm" }), confidence: 0.96, createdAt: Date.now() },
			{ id: "f2", regionId: "mock-footing", sheetId: "mock-sheet", scheduleType: "footing", mark: "F2", properties: JSON.stringify({ Size: "2000 × 2000 × 400", Reinforcing: "6-N20 E.W.", Concrete: "32 MPa", Cover: "50mm" }), confidence: 0.93, createdAt: Date.now() },
			{ id: "f3", regionId: "mock-footing", sheetId: "mock-sheet", scheduleType: "footing", mark: "F3", properties: JSON.stringify({ Size: "2500 × 2500 × 500", Reinforcing: "8-N20 E.W.", Concrete: "40 MPa", Cover: "75mm", Notes: "Step down 300mm at grid line 4" }), confidence: 0.91, createdAt: Date.now() },
			{ id: "f4", regionId: "mock-footing", sheetId: "mock-sheet", scheduleType: "footing", mark: "F4", properties: JSON.stringify({ Size: "1200 × 1200 × 250", Reinforcing: "4-N12 E.W.", Concrete: "32 MPa", Cover: "50mm" }), confidence: 0.88, createdAt: Date.now() },
		],
		sheetNumber: "S1.0",
	},
	{
		region: {
			id: "mock-pier",
			sheetId: "mock-sheet",
			regionClass: "schedule",
			regionTitle: "Pier Schedule",
			x: 0.7, y: 0.25, width: 0.25, height: 0.1,
			extractedContent: null,
			cropImageUrl: null,
			confidence: 0.92,
			createdAt: Date.now(),
		},
		entries: [
			{ id: "p1", regionId: "mock-pier", sheetId: "mock-sheet", scheduleType: "pier", mark: "P1", properties: JSON.stringify({ Size: "450 × 450", Verticals: "4-N25", Ties: "N10 @ 200", Concrete: "40 MPa" }), confidence: 0.94, createdAt: Date.now() },
			{ id: "p2", regionId: "mock-pier", sheetId: "mock-sheet", scheduleType: "pier", mark: "P2", properties: JSON.stringify({ Size: "600 × 600", Verticals: "8-N28", Ties: "N12 @ 150", Concrete: "40 MPa" }), confidence: 0.91, createdAt: Date.now() },
			{ id: "p3", regionId: "mock-pier", sheetId: "mock-sheet", scheduleType: "pier", mark: "P3", properties: JSON.stringify({ Size: "350 × 350", Verticals: "4-N20", Ties: "N10 @ 250", Concrete: "32 MPa" }), confidence: 0.78, createdAt: Date.now() },
		],
		sheetNumber: "S1.0",
	},
	{
		region: {
			id: "mock-beam",
			sheetId: "mock-sheet",
			regionClass: "schedule",
			regionTitle: "Beam Schedule",
			x: 0.7, y: 0.4, width: 0.25, height: 0.08,
			extractedContent: null,
			cropImageUrl: null,
			confidence: 0.89,
			createdAt: Date.now(),
		},
		entries: [
			{ id: "b1", regionId: "mock-beam", sheetId: "mock-sheet", scheduleType: "beam", mark: "B1", properties: JSON.stringify({ Size: "300 × 600", "Top Steel": "3-N20", "Bottom Steel": "4-N24", Stirrups: "N10 @ 200" }), confidence: 0.92, createdAt: Date.now() },
			{ id: "b2", regionId: "mock-beam", sheetId: "mock-sheet", scheduleType: "beam", mark: "B2", properties: JSON.stringify({ Size: "250 × 500", "Top Steel": "2-N16", "Bottom Steel": "3-N20", Stirrups: "N10 @ 250" }), confidence: 0.90, createdAt: Date.now() },
		],
		sheetNumber: "S1.0",
	},
];

export function useScheduleDrawerData(projectId: string): ScheduleDrawerGroup[] {
	const { schedules, scheduleEntriesByRegion, sheetNumberMap } = usePlanInfo(projectId);

	const realGroups = schedules.map((region) => ({
		region,
		entries: scheduleEntriesByRegion.get(region.id) ?? [],
		sheetNumber: sheetNumberMap.get(region.sheetId) ?? "\u2014",
	}));

	// TODO: Remove fallback to mock data once real data flows
	return realGroups.length > 0 ? realGroups : MOCK_GROUPS;
}
