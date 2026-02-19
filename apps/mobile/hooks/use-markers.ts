import { queryDb } from "@livestore/livestore";
import { tables } from "@sitelink/domain";
import { useMemo } from "react";
import { useSessionContext } from "@/lib/session-context";
import { useAppStore } from "@/livestore/store";

export interface CalloutMarker {
	id: string;
	x: number;
	y: number;
	width?: number;
	height?: number;
	label: string;
	targetSheetRef?: string;
	type: "detail" | "section" | "elevation" | "note";
	discipline?: "arch" | "struct" | "elec" | "mech" | "plumb";
}

function inferMarkerType(label: string): CalloutMarker["type"] {
	const upperLabel = label.toUpperCase();
	if (upperLabel.includes("ELEV") || upperLabel.startsWith("E"))
		return "elevation";
	if (upperLabel.includes("SECT") || upperLabel.includes("/")) return "section";
	if (upperLabel.includes("NOTE")) return "note";
	return "detail";
}

function inferDiscipline(
	label: string,
): CalloutMarker["discipline"] | undefined {
	const upperLabel = label.toUpperCase();
	if (upperLabel.includes("A") || upperLabel.includes("ARCH")) return "arch";
	if (upperLabel.includes("S") || upperLabel.includes("STRUCT"))
		return "struct";
	if (upperLabel.includes("E") || upperLabel.includes("ELEC")) return "elec";
	if (upperLabel.includes("M") || upperLabel.includes("MECH")) return "mech";
	if (upperLabel.includes("P") || upperLabel.includes("PLUMB")) return "plumb";
	return undefined;
}

export function useMarkers(sheetId: string | null) {
	const { sessionToken, organizationId, sessionId } = useSessionContext();

	console.log(`[useMarkers] Called with sheetId=${sheetId}, orgId=${organizationId}`);

	const store = useAppStore(organizationId!, sessionToken, sessionId);

	const markers = store.useQuery(
		sheetId
			? queryDb(tables.markers.where({ sheetId }))
			: queryDb(tables.markers.where({ sheetId: "" })),
	);

	console.log(`[useMarkers] Raw query result for sheetId=${sheetId}:`, markers?.length ?? 0, "markers");

	return useMemo(() => {
		if (!sheetId) return [];
		const markersArray = Array.isArray(markers) ? markers : [];
		console.log(`[useMarkers] Processing ${markersArray.length} markers for sheet ${sheetId}`);

		return markersArray.map((marker) => ({
			id: marker.id,
			x: marker.x,
			y: marker.y,
			width: marker.width ?? undefined,
			height: marker.height ?? undefined,
			label: marker.label,
			targetSheetRef: marker.targetSheetId ?? undefined,
			type: inferMarkerType(marker.label),
			discipline: inferDiscipline(marker.label),
		}));
	}, [markers, sheetId]);
}
