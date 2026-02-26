import { usePlanInfo, type LayoutRegion, type ScheduleEntry } from "./use-plan-info";

export interface ScheduleDrawerGroup {
	region: LayoutRegion;
	entries: ScheduleEntry[];
	sheetNumber: string;
}

export function useScheduleDrawerData(projectId: string): ScheduleDrawerGroup[] {
	const { schedules, scheduleEntriesByRegion, sheetNumberMap } = usePlanInfo(projectId);

	return schedules.map((region) => ({
		region,
		entries: scheduleEntriesByRegion.get(region.id) ?? [],
		sheetNumber: sheetNumberMap.get(region.sheetId) ?? "\u2014",
	}));
}
