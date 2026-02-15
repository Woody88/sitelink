import { useMemo } from "react";
import {
	type LayoutRegion,
	type ScheduleEntry,
	usePlanInfo,
} from "./use-plan-info";
import { type Sheet, useSheets } from "./use-sheets";

export type SearchResultType = "sheet" | "schedule" | "notes";

export interface PlanSearchResult {
	id: string;
	type: SearchResultType;
	title: string;
	subtitle: string;
	matchText: string;
	sheetId?: string;
	region?: LayoutRegion;
	entries?: ScheduleEntry[];
	sheetNumber: string;
	sheet?: Sheet;
}

const MAX_RESULTS = 20;
const MIN_QUERY_LENGTH = 2;

function searchProperties(json: string, query: string): string | null {
	try {
		const props = JSON.parse(json);
		if (props && typeof props === "object" && !Array.isArray(props)) {
			for (const value of Object.values(props)) {
				if (
					value != null &&
					String(value).toLowerCase().includes(query)
				) {
					return String(value);
				}
			}
		}
	} catch {
		// ignore parse errors
	}
	return null;
}

function extractSnippet(
	content: string,
	query: string,
	radius = 30,
): string | null {
	const lower = content.toLowerCase();
	const idx = lower.indexOf(query);
	if (idx === -1) return null;
	const start = Math.max(0, idx - radius);
	const end = Math.min(content.length, idx + query.length + radius);
	return (
		(start > 0 ? "..." : "") +
		content.slice(start, end).replace(/\n/g, " ") +
		(end < content.length ? "..." : "")
	);
}

export function usePlanSearch(
	projectId: string,
	query: string,
): PlanSearchResult[] {
	const folders = useSheets(projectId);
	const { schedules, notes, scheduleEntriesByRegion, sheetNumberMap } =
		usePlanInfo(projectId);

	return useMemo(() => {
		const trimmed = query.trim().toLowerCase();
		if (trimmed.length < MIN_QUERY_LENGTH) return [];

		const results: PlanSearchResult[] = [];
		const allSheets = folders.flatMap((f) => f.sheets);

		for (const sheet of allSheets) {
			const numberMatch = sheet.number.toLowerCase().includes(trimmed);
			const titleMatch = sheet.title.toLowerCase().includes(trimmed);
			if (numberMatch || titleMatch) {
				results.push({
					id: `sheet-${sheet.id}`,
					type: "sheet",
					title: sheet.number,
					subtitle: sheet.title,
					matchText: numberMatch ? sheet.number : sheet.title,
					sheetId: sheet.id,
					sheetNumber: sheet.number,
					sheet,
				});
			}
		}

		for (const [regionId, entries] of scheduleEntriesByRegion) {
			const region = schedules.find((r) => r.id === regionId);
			if (!region) continue;
			const sheetNumber = sheetNumberMap.get(region.sheetId) ?? "?";

			for (const entry of entries) {
				let matchText = "";

				if (entry.mark.toLowerCase().includes(trimmed)) {
					matchText = entry.mark;
				} else {
					const propMatch = searchProperties(
						entry.properties,
						trimmed,
					);
					if (propMatch) {
						matchText = propMatch;
					}
				}

				if (matchText) {
					const typeLabel =
						entry.scheduleType.charAt(0).toUpperCase() +
						entry.scheduleType.slice(1);
					results.push({
						id: `schedule-${entry.id}`,
						type: "schedule",
						title: `${entry.mark} \u2014 ${typeLabel} Schedule`,
						subtitle: `Sheet ${sheetNumber}`,
						matchText,
						region,
						entries,
						sheetNumber,
					});
				}
			}
		}

		for (const region of notes) {
			const sheetNumber = sheetNumberMap.get(region.sheetId) ?? "?";
			let matchText = "";

			if (region.regionTitle?.toLowerCase().includes(trimmed)) {
				matchText = region.regionTitle;
			} else if (region.extractedContent) {
				const snippet = extractSnippet(
					region.extractedContent,
					trimmed,
				);
				if (snippet) {
					matchText = snippet;
				}
			}

			if (matchText) {
				const title = region.regionTitle ?? "Notes";
				const subtitleParts = [`Sheet ${sheetNumber}`];
				if (matchText !== title) {
					subtitleParts.push(matchText);
				}
				results.push({
					id: `notes-${region.id}`,
					type: "notes",
					title,
					subtitle: subtitleParts.join(" \u00b7 "),
					matchText,
					region,
					sheetNumber,
				});
			}
		}

		const typePriority: Record<SearchResultType, number> = {
			schedule: 0,
			notes: 1,
			sheet: 2,
		};

		results.sort((a, b) => {
			const aExact = a.matchText.toLowerCase() === trimmed ? 0 : 1;
			const bExact = b.matchText.toLowerCase() === trimmed ? 0 : 1;
			if (aExact !== bExact) return aExact - bExact;
			return typePriority[a.type] - typePriority[b.type];
		});

		return results.slice(0, MAX_RESULTS);
	}, [query, folders, schedules, notes, scheduleEntriesByRegion, sheetNumberMap]);
}
