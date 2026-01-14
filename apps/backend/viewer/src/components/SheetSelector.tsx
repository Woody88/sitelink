import type { SheetData } from "../types";

interface SheetSelectorProps {
	sheets: SheetData[];
	selectedSheet: SheetData | null;
	onSheetSelect: (sheet: SheetData) => void;
}

export default function SheetSelector({
	sheets,
	selectedSheet,
	onSheetSelect,
}: SheetSelectorProps) {
	if (sheets.length === 0) {
		return (
			<div className="sheet-list">
				<div className="empty-state">
					<p>No sheets found</p>
				</div>
			</div>
		);
	}

	return (
		<div className="sheet-list">
			{sheets.map((sheet) => (
				<div
					key={sheet.sheetId}
					className={`sheet-item ${selectedSheet?.sheetId === sheet.sheetId ? "selected" : ""}`}
					onClick={() => onSheetSelect(sheet)}
				>
					<div className="sheet-item-header">
						<span className="sheet-number">{sheet.sheetNumber}</span>
						<span
							className={`marker-count ${sheet.markers.length === 0 ? "zero" : ""}`}
						>
							{sheet.markers.length} marker
							{sheet.markers.length !== 1 ? "s" : ""}
						</span>
					</div>
					{sheet.title && <div className="sheet-title">{sheet.title}</div>}
					{sheet.discipline && (
						<div className="sheet-title" style={{ color: "#666" }}>
							{sheet.discipline}
						</div>
					)}
				</div>
			))}
		</div>
	);
}
