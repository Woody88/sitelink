import { queryDb } from "@livestore/livestore";
import { tables } from "@sitelink/domain";
import { useMemo } from "react";
import { useSessionContext } from "@/lib/session-context";
import { useAppStore } from "@/livestore/store";

export interface LayoutRegion {
	id: string;
	sheetId: string;
	regionClass: string;
	regionTitle: string | null;
	x: number;
	y: number;
	width: number;
	height: number;
	extractedContent: string | null;
	cropImageUrl: string | null;
	confidence: number;
	createdAt: number;
}

export interface ScheduleEntry {
	id: string;
	regionId: string;
	sheetId: string;
	scheduleType: string;
	mark: string;
	properties: string;
	confidence: number;
	createdAt: number;
}

export interface PlanInfoData {
	schedules: LayoutRegion[];
	notes: LayoutRegion[];
	legends: LayoutRegion[];
	scheduleEntriesByRegion: Map<string, ScheduleEntry[]>;
	sheetNumberMap: Map<string, string>;
}

export function usePlanInfo(projectId: string): PlanInfoData {
	const { sessionToken, organizationId, sessionId } = useSessionContext();
	const store = useAppStore(organizationId!, sessionToken, sessionId);

	const sheets = store.useQuery(
		queryDb(tables.sheets.where({ projectId })),
	);

	const allRegions = store.useQuery(queryDb(tables.layoutRegions));
	const allEntries = store.useQuery(queryDb(tables.scheduleEntries));

	return useMemo(() => {
		const sheetsArray = Array.isArray(sheets) ? sheets : [];
		const regionsArray = Array.isArray(allRegions) ? allRegions : [];
		const entriesArray = Array.isArray(allEntries) ? allEntries : [];

		const projectSheetIds = new Set(sheetsArray.map((s) => s.id));

		const sheetNumberMap = new Map<string, string>();
		for (const sheet of sheetsArray) {
			sheetNumberMap.set(sheet.id, sheet.number);
		}

		const projectRegions = regionsArray.filter((r) =>
			projectSheetIds.has(r.sheetId),
		);

		const schedules: LayoutRegion[] = [];
		const notes: LayoutRegion[] = [];
		const legends: LayoutRegion[] = [];

		for (const region of projectRegions) {
			switch (region.regionClass) {
				case "schedule":
					schedules.push(region);
					break;
				case "notes":
					notes.push(region);
					break;
				case "legend":
					legends.push(region);
					break;
			}
		}

		const scheduleEntriesByRegion = new Map<string, ScheduleEntry[]>();
		for (const entry of entriesArray) {
			if (!projectSheetIds.has(entry.sheetId)) continue;
			const existing = scheduleEntriesByRegion.get(entry.regionId) ?? [];
			existing.push(entry);
			scheduleEntriesByRegion.set(entry.regionId, existing);
		}

		return { schedules, notes, legends, scheduleEntriesByRegion, sheetNumberMap };
	}, [sheets, allRegions, allEntries]);
}
