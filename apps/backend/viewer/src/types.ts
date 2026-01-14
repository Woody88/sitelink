export interface Marker {
	id: string;
	label: string;
	targetSheetRef?: string;
	targetSheetId?: string;
	x: number;
	y: number;
	confidence: number;
	needsReview: boolean;
}

export interface SheetData {
	sheetId: string;
	planId: string;
	projectId: string;
	organizationId: string;
	sheetNumber: string;
	title?: string;
	discipline?: string;
	width: number;
	height: number;
	pmtilesPath: string;
	imagePath: string;
	markers: Marker[];
}

export interface PlanData {
	planId: string;
	projectId: string;
	organizationId: string;
	fileName: string;
	sheets: SheetData[];
}

export interface LiveStoreEvent {
	type: string;
	name: string;
	seqNum: number;
	parentSeqNum: number;
	timestamp: number;
	data: Record<string, unknown>;
}
