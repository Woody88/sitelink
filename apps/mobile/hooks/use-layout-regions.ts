import { queryDb } from "@livestore/livestore";
import { tables } from "@sitelink/domain";
import { useMemo } from "react";
import { useSessionContext } from "@/lib/session-context";
import { useAppStore } from "@/livestore/store";

export interface LayoutRegion {
	id: string;
	x: number;
	y: number;
	width: number;
	height: number;
	regionClass: "schedule" | "notes" | "legend";
	regionTitle: string;
	confidence: number;
}

export function useLayoutRegions(sheetId: string | null): LayoutRegion[] {
	const { sessionToken, organizationId, sessionId } = useSessionContext();

	const store = useAppStore(organizationId!, sessionToken, sessionId);

	const regions = store.useQuery(
		sheetId
			? queryDb(tables.layoutRegions.where({ sheetId }))
			: queryDb(tables.layoutRegions.where({ sheetId: "" })),
	);

	return useMemo(() => {
		if (!sheetId) return [];
		const regionsArray = Array.isArray(regions) ? regions : [];

		return regionsArray.map((region) => ({
			id: region.id,
			x: region.x,
			y: region.y,
			width: region.width,
			height: region.height,
			regionClass: region.regionClass as LayoutRegion["regionClass"],
			regionTitle: region.regionTitle ?? "",
			confidence: region.confidence,
		}));
	}, [regions, sheetId]);
}
