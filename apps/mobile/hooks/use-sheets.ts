import { queryDb } from "@livestore/livestore";
import { tables } from "@sitelink/domain";
import { useMemo } from "react";
import { useSessionContext } from "@/lib/session-context";
import { useAppStore } from "@/livestore/store";

export interface Sheet {
	id: string;
	projectId: string;
	planId: string;
	number: string;
	title: string;
	discipline: string;
	imagePath: string;
	width: number;
	height: number;
	sortOrder: number;
	processingStage?: string | null;
	localPmtilesPath?: string | null;
	remotePmtilesPath?: string | null;
	minZoom?: number | null;
	maxZoom?: number | null;
}

export interface SheetFolder {
	id: string;
	name: string;
	sheets: Sheet[];
}

export function useSheets(projectId: string) {
	const { sessionToken, organizationId, sessionId } = useSessionContext();

	const store = useAppStore(organizationId!, sessionToken, sessionId);

	const sheets = store.useQuery(
		queryDb(tables.sheets.where({ projectId }).orderBy("sortOrder", "asc")),
	);

	return useMemo(() => {
		const sheetsArray = Array.isArray(sheets) ? sheets : [];

		const groupedByDiscipline: Record<string, Sheet[]> = {};

		sheetsArray.forEach((sheet) => {
			const discipline = sheet.discipline || "Unfiled sheets";

			if (!groupedByDiscipline[discipline]) {
				groupedByDiscipline[discipline] = [];
			}

			groupedByDiscipline[discipline].push(sheet);
		});

		const folders: SheetFolder[] = Object.entries(groupedByDiscipline).map(
			([discipline, disciplineSheets]) => ({
				id: discipline.toLowerCase().replace(/\s+/g, "-"),
				name: discipline,
				sheets: disciplineSheets,
			}),
		);

		return folders;
	}, [sheets]);
}
