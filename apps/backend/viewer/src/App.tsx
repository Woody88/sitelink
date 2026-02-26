import { useCallback, useEffect, useState } from "react";
import MarkerDetail from "./components/MarkerDetail";
import PMTilesViewer from "./components/PMTilesViewer";
import SheetSelector from "./components/SheetSelector";
import type { LiveStoreEvent, Marker, SheetData } from "./types";

interface ProcessedPlan {
	planId: string;
	fileName: string;
	sheets: Map<string, SheetData>;
}

function processEvents(events: LiveStoreEvent[]): ProcessedPlan[] {
	const plans = new Map<string, ProcessedPlan>();

	for (const event of events) {
		const data = event.data as Record<string, any>;

		switch (event.name) {
			case "v1.PlanUploaded": {
				const planId = data.id as string;
				if (!plans.has(planId)) {
					plans.set(planId, {
						planId,
						fileName: data.fileName as string,
						sheets: new Map(),
					});
				}
				break;
			}

			case "v1.SheetImageGenerated": {
				const planId = data.planId as string;
				const sheetId = data.sheetId as string;

				let plan = plans.get(planId);
				if (!plan) {
					plan = { planId, fileName: "Unknown", sheets: new Map() };
					plans.set(planId, plan);
				}

				if (!plan.sheets.has(sheetId)) {
					plan.sheets.set(sheetId, {
						sheetId,
						planId,
						projectId: data.projectId as string,
						organizationId: "",
						sheetNumber: `Sheet ${data.pageNumber}`,
						width: data.width as number,
						height: data.height as number,
						pmtilesPath: "",
						imagePath: data.localImagePath as string,
						markers: [],
					});
				} else {
					const sheet = plan.sheets.get(sheetId)!;
					sheet.width = data.width as number;
					sheet.height = data.height as number;
					sheet.imagePath = data.localImagePath as string;
				}
				break;
			}

			case "v1.SheetMetadataExtracted": {
				const planId = data.planId as string;
				const sheetId = data.sheetId as string;

				const plan = plans.get(planId);
				if (plan) {
					const sheet = plan.sheets.get(sheetId);
					if (sheet) {
						sheet.sheetNumber = data.sheetNumber as string;
						sheet.title = data.sheetTitle as string | undefined;
						sheet.discipline = data.discipline as string | undefined;
					}
				}
				break;
			}

			case "v1.SheetTilesGenerated": {
				const planId = data.planId as string;
				const sheetId = data.sheetId as string;

				const plan = plans.get(planId);
				if (plan) {
					const sheet = plan.sheets.get(sheetId);
					if (sheet) {
						sheet.pmtilesPath = data.localPmtilesPath as string;
					}
				}
				break;
			}

			case "v1.SheetCalloutsDetected": {
				const planId = data.planId as string;
				const sheetId = data.sheetId as string;
				const rawMarkers = data.markers as any[];

				const plan = plans.get(planId);
				if (plan) {
					const sheet = plan.sheets.get(sheetId);
					if (sheet && rawMarkers) {
						sheet.markers = rawMarkers.map((m) => ({
							id: m.id,
							label: m.label,
							targetSheetRef: m.targetSheetRef,
							targetSheetId: m.targetSheetId,
							x: m.x,
							y: m.y,
							confidence: m.confidence,
							needsReview: m.needsReview,
						}));
					}
				}
				break;
			}
		}
	}

	return Array.from(plans.values());
}

export default function App() {
	const [plans, setPlans] = useState<ProcessedPlan[]>([]);
	const [selectedSheet, setSelectedSheet] = useState<SheetData | null>(null);
	const [selectedMarker, setSelectedMarker] = useState<Marker | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		async function loadEvents() {
			try {
				setLoading(true);
				const response = await fetch("/api/events");
				if (!response.ok) {
					throw new Error(`Failed to load events: ${response.status}`);
				}
				const events = (await response.json()) as LiveStoreEvent[];
				console.log(`Loaded ${events.length} events`);

				const processedPlans = processEvents(events);
				console.log(`Processed ${processedPlans.length} plans`);

				setPlans(processedPlans);

				if (processedPlans.length > 0) {
					const firstPlan = processedPlans[0];
					const sheets = Array.from(firstPlan.sheets.values());
					if (sheets.length > 0) {
						const sheetWithTiles =
							sheets.find((s) => s.pmtilesPath) || sheets[0];
						setSelectedSheet(sheetWithTiles);
					}
				}

				setLoading(false);
			} catch (err) {
				console.error("Failed to load events:", err);
				setError(err instanceof Error ? err.message : String(err));
				setLoading(false);
			}
		}

		loadEvents();
	}, []);

	const allSheets = plans.flatMap((p) => Array.from(p.sheets.values()));

	const handleSheetSelect = useCallback((sheet: SheetData) => {
		setSelectedSheet(sheet);
		setSelectedMarker(null);
	}, []);

	const handleMarkerClick = useCallback((marker: Marker) => {
		setSelectedMarker(marker);
	}, []);

	const handleGoToSheet = useCallback(
		(sheetId: string) => {
			const sheet = allSheets.find((s) => s.sheetId === sheetId);
			if (sheet) {
				setSelectedSheet(sheet);
				setSelectedMarker(null);
			}
		},
		[allSheets],
	);

	if (loading) {
		return (
			<div className="app">
				<div className="sidebar">
					<div className="sidebar-header">
						<h1>Event Viewer</h1>
						<p>Loading events...</p>
					</div>
				</div>
				<div className="main-content">
					<div className="loading">
						<div className="loading-spinner" />
						<p style={{ marginTop: "1rem" }}>
							Loading events from LiveStore...
						</p>
					</div>
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="app">
				<div className="sidebar">
					<div className="sidebar-header">
						<h1>Event Viewer</h1>
						<p>Error loading events</p>
					</div>
				</div>
				<div className="main-content">
					<div className="error">
						<h2>Error</h2>
						<p>{error}</p>
					</div>
				</div>
			</div>
		);
	}

	const pmtilesUrl = selectedSheet?.pmtilesPath
		? `/api/r2/${selectedSheet.pmtilesPath}`
		: null;

	const imageUrl = selectedSheet?.imagePath
		? `/api/r2/${selectedSheet.imagePath}`
		: undefined;

	// Debug selected sheet and markers
	console.log("Selected sheet:", selectedSheet?.sheetId, {
		markers: selectedSheet?.markers.length,
		pmtilesPath: selectedSheet?.pmtilesPath,
		imagePath: selectedSheet?.imagePath,
	});

	return (
		<div className="app">
			<div className="sidebar">
				<div className="sidebar-header">
					<h1>Event Viewer</h1>
					<p>
						{allSheets.length} sheet{allSheets.length !== 1 ? "s" : ""} •{" "}
						{allSheets.reduce((sum, s) => sum + s.markers.length, 0)} markers
					</p>
				</div>
				<SheetSelector
					sheets={allSheets}
					selectedSheet={selectedSheet}
					onSheetSelect={handleSheetSelect}
				/>
			</div>
			<div className="main-content">
				{selectedSheet && (pmtilesUrl || imageUrl) ? (
					<PMTilesViewer
						pmtilesUrl={pmtilesUrl || ""}
						imageUrl={imageUrl}
						markers={selectedSheet.markers}
						selectedMarker={selectedMarker}
						onMarkerClick={handleMarkerClick}
						sheetWidth={selectedSheet.width}
						sheetHeight={selectedSheet.height}
					/>
				) : selectedSheet && !selectedSheet.pmtilesPath && !selectedSheet.imagePath ? (
					<div className="empty-state">
						<p>PMTiles not generated for this sheet yet</p>
						<p
							style={{ fontSize: "0.8rem", color: "#666", marginTop: "0.5rem" }}
						>
							Path: {selectedSheet.imagePath || "No image path"}
						</p>
					</div>
				) : (
					<div className="empty-state">
						<p>Select a sheet to view</p>
					</div>
				)}

				{selectedMarker && (
					<MarkerDetail
						marker={selectedMarker}
						sheets={allSheets}
						onClose={() => setSelectedMarker(null)}
						onGoToSheet={handleGoToSheet}
					/>
				)}
			</div>
		</div>
	);
}
