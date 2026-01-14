import { useCallback, useRef, useState } from "react";
import type { CalloutMarker } from "./use-markers";

export type { CalloutMarker };

// Types for viewer state
export interface ViewerState {
	zoom: number;
	minZoom: number;
	maxZoom: number;
	center: { x: number; y: number };
	isReady: boolean;
}

export interface UsePlanViewerOptions {
	initialZoom?: number;
	minZoom?: number;
	maxZoom?: number;
	onMarkerPress?: (marker: CalloutMarker) => void;
	onNavigateToSheet?: (sheetRef: string) => void;
}

export interface UsePlanViewerReturn {
	// Viewer state
	viewerState: ViewerState;
	setViewerState: React.Dispatch<React.SetStateAction<ViewerState>>;

	// Zoom controls
	zoomIn: () => void;
	zoomOut: () => void;
	zoomToFit: () => void;
	setZoom: (zoom: number) => void;

	// Pan controls
	panTo: (x: number, y: number) => void;

	// Marker state
	markers: CalloutMarker[];
	setMarkers: React.Dispatch<React.SetStateAction<CalloutMarker[]>>;
	selectedMarkerId: string | null;
	setSelectedMarkerId: (id: string | null) => void;

	// Sheet navigation
	currentSheetId: string | null;
	setCurrentSheetId: (id: string | null) => void;

	// Viewer reference (for calling methods)
	viewerRef: React.MutableRefObject<ViewerCommands | null>;

	// Loading state
	isLoading: boolean;
	setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
	error: string | null;
	setError: React.Dispatch<React.SetStateAction<string | null>>;
}

// Commands that can be sent to the DOM component
export interface ViewerCommands {
	zoomIn: () => void;
	zoomOut: () => void;
	zoomToFit: () => void;
	setZoom: (zoom: number) => void;
	panTo: (x: number, y: number) => void;
	goToMarker: (markerId: string) => void;
}

export function usePlanViewer(
	options: UsePlanViewerOptions = {},
): UsePlanViewerReturn {
	const {
		initialZoom = 1,
		minZoom = 0.5,
		maxZoom = 10,
		onMarkerPress,
		onNavigateToSheet,
	} = options;

	// Viewer state
	const [viewerState, setViewerState] = useState<ViewerState>({
		zoom: initialZoom,
		minZoom,
		maxZoom,
		center: { x: 0.5, y: 0.5 },
		isReady: false,
	});

	// Marker state
	const [markers, setMarkers] = useState<CalloutMarker[]>([]);
	const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null);

	// Sheet navigation
	const [currentSheetId, setCurrentSheetId] = useState<string | null>(null);

	// Loading state
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	// Ref for viewer commands
	const viewerRef = useRef<ViewerCommands | null>(null);

	// Zoom controls
	const zoomIn = useCallback(() => {
		viewerRef.current?.zoomIn();
	}, []);

	const zoomOut = useCallback(() => {
		viewerRef.current?.zoomOut();
	}, []);

	const zoomToFit = useCallback(() => {
		viewerRef.current?.zoomToFit();
	}, []);

	const setZoom = useCallback((zoom: number) => {
		viewerRef.current?.setZoom(zoom);
	}, []);

	// Pan controls
	const panTo = useCallback((x: number, y: number) => {
		viewerRef.current?.panTo(x, y);
	}, []);

	// Handle marker press
	const handleMarkerPress = useCallback(
		(marker: CalloutMarker) => {
			setSelectedMarkerId(marker.id);
			onMarkerPress?.(marker);

			if (marker.targetSheetRef) {
				onNavigateToSheet?.(marker.targetSheetRef);
			}
		},
		[onMarkerPress, onNavigateToSheet],
	);

	return {
		viewerState,
		setViewerState,
		zoomIn,
		zoomOut,
		zoomToFit,
		setZoom,
		panTo,
		markers,
		setMarkers,
		selectedMarkerId,
		setSelectedMarkerId,
		currentSheetId,
		setCurrentSheetId,
		viewerRef,
		isLoading,
		setIsLoading,
		error,
		setError,
	};
}
