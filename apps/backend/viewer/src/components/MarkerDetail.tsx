import type { Marker, SheetData } from "../types";

interface MarkerDetailProps {
	marker: Marker;
	sheets: SheetData[];
	onClose: () => void;
	onGoToSheet: (sheetId: string) => void;
}

export default function MarkerDetail({
	marker,
	sheets,
	onClose,
	onGoToSheet,
}: MarkerDetailProps) {
	const targetSheet = marker.targetSheetId
		? sheets.find((s) => s.sheetId === marker.targetSheetId)
		: marker.targetSheetRef
			? sheets.find((s) => s.sheetNumber === marker.targetSheetRef)
			: null;

	return (
		<div className="marker-detail">
			<div className="marker-detail-header">
				<h3>Marker: {marker.label}</h3>
				<button className="close-btn" onClick={onClose}>
					&times;
				</button>
			</div>

			<div className="marker-detail-row">
				<span className="marker-detail-label">ID</span>
				<span className="marker-detail-value">{marker.id.slice(0, 8)}...</span>
			</div>

			<div className="marker-detail-row">
				<span className="marker-detail-label">Position</span>
				<span className="marker-detail-value">
					({Math.round(marker.x)}, {Math.round(marker.y)})
				</span>
			</div>

			<div className="marker-detail-row">
				<span className="marker-detail-label">Confidence</span>
				<span className="marker-detail-value">
					{Math.round(marker.confidence * 100)}%
				</span>
			</div>

			<div className="marker-detail-row">
				<span className="marker-detail-label">Target Sheet</span>
				<span className="marker-detail-value">
					{marker.targetSheetRef || "None"}
				</span>
			</div>

			<div className="marker-detail-row">
				<span className="marker-detail-label">Needs Review</span>
				<span
					className={`marker-detail-value ${marker.needsReview ? "needs-review" : ""}`}
				>
					{marker.needsReview ? "Yes" : "No"}
				</span>
			</div>

			{targetSheet && (
				<button
					className="go-to-sheet-btn"
					onClick={() => onGoToSheet(targetSheet.sheetId)}
				>
					Go to Sheet {targetSheet.sheetNumber}
				</button>
			)}

			{marker.targetSheetRef && !targetSheet && (
				<button className="go-to-sheet-btn" disabled>
					Sheet {marker.targetSheetRef} not found
				</button>
			)}
		</div>
	);
}
