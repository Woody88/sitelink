"use dom";

import OpenSeadragon from "openseadragon";
import * as React from "react";

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

interface OpenSeadragonViewerProps {
	imageUrl: string;
	imageWidth: number;
	imageHeight: number;
	markers?: CalloutMarker[];
	selectedMarkerId?: string | null;
	onMarkerPress?: (marker: CalloutMarker) => Promise<void>;
	onViewerStateChange?: (state: any) => Promise<void>;
	onReady?: () => Promise<void>;
	onError?: (error: string) => Promise<void>;
}

export default function OpenSeadragonViewer({
	imageUrl,
	imageWidth,
	imageHeight,
	markers = [],
	selectedMarkerId,
	onMarkerPress,
	onViewerStateChange,
	onReady,
	onError,
}: OpenSeadragonViewerProps) {
	const containerRef = React.useRef<HTMLDivElement>(null);
	const viewerRef = React.useRef<OpenSeadragon.Viewer | null>(null);
	const markerOverlaysRef = React.useRef<Map<string, HTMLElement>>(new Map());
	const [isViewerReady, setIsViewerReady] = React.useState(false);

	// OpenSeadragon simple image: viewport x=[0,1], y=[0, aspectRatio]
	const aspectRatio = imageHeight / imageWidth;

	React.useEffect(() => {
		if (!containerRef.current) return;

		try {
			const viewer = OpenSeadragon({
				element: containerRef.current,
				prefixUrl: "https://openseadragon.github.io/openseadragon/images/",
				tileSources: {
					type: "image",
					url: imageUrl,
					buildPyramid: false,
					crossOriginPolicy: "Anonymous",
				} as any,
				showNavigationControl: false,
				drawer: "canvas",
				autoResize: true,
				panHorizontal: true,
				panVertical: true,
				visibilityRatio: 1.0,
				constrainDuringPan: true,
				animationTime: 0.5,
				blendTime: 0.1,
				maxZoomPixelRatio: 2,
				zoomPerScroll: 2,
			} as any);

			viewerRef.current = viewer;

			viewer.addHandler("open", () => {
				setIsViewerReady(true);
				if (onReady) onReady();
			});

			viewer.addHandler("open-failed", (event) => {
				console.error("[OpenSeadragon] Image failed to open:", event);
				onError?.("Failed to open image");
			});

			viewer.addHandler("zoom", () => {
				if (viewer && onViewerStateChange) {
					const viewport = viewer.viewport;
					onViewerStateChange({
						zoom: viewport.getZoom(true),
						minZoom: viewport.getMinZoom(),
						maxZoom: viewport.getMaxZoom(),
						center: viewport.getCenter(),
						isReady: true,
					});
				}
			});

			viewer.addHandler("pan", () => {
				if (viewer && onViewerStateChange) {
					const viewport = viewer.viewport;
					onViewerStateChange({
						zoom: viewport.getZoom(true),
						minZoom: viewport.getMinZoom(),
						maxZoom: viewport.getMaxZoom(),
						center: viewport.getCenter(),
						isReady: true,
					});
				}
			});

			return () => {
				viewer.destroy();
				viewerRef.current = null;
				markerOverlaysRef.current.clear();
				setIsViewerReady(false);
			};
		} catch (err) {
			console.error("[OpenSeadragon] Init error:", err);
			onError?.("Initialization error");
		}
	}, [imageUrl, onReady, onError, onViewerStateChange]);

	// Marker overlays
	React.useEffect(() => {
		const viewer = viewerRef.current;
		if (!viewer || !isViewerReady) return;

		const currentOverlays = markerOverlaysRef.current;
		currentOverlays.forEach((overlay) => {
			viewer.removeOverlay(overlay);
		});
		currentOverlays.clear();

		const TYPE_COLORS: Record<string, string> = {
			detail: "#22c55e",
			section: "#3b82f6",
			elevation: "#3b82f6",
			note: "#a855f7",
		};
		const DEFAULT_BBOX = 0.025;

		markers.forEach((marker) => {
			const isSelected = marker.id === selectedMarkerId;
			const color = TYPE_COLORS[marker.type] || "#22c55e";
			const bboxW = marker.width && marker.width > 0 ? marker.width : DEFAULT_BBOX;
			const bboxH = marker.height && marker.height > 0 ? marker.height : DEFAULT_BBOX;

			const el = document.createElement("div");
			el.className = "marker-overlay";
			const selectedBg = "rgba(250, 204, 21, 0.25)";
			el.style.cssText = `
				position: relative;
				width: 100%;
				height: 100%;
				border: 2px solid ${isSelected ? "#facc15" : color};
				background-color: ${isSelected ? selectedBg : "transparent"};
				cursor: pointer;
				box-sizing: border-box;
			`;

			el.addEventListener("mouseenter", () => {
				if (!isSelected) el.style.backgroundColor = `${color}22`;
			});
			el.addEventListener("mouseleave", () => {
				el.style.backgroundColor = isSelected ? selectedBg : "transparent";
			});

			const labelEl = document.createElement("div");
			labelEl.style.cssText = `
				position: absolute;
				top: -18px;
				left: 0;
				background-color: ${isSelected ? "#facc15" : color};
				color: ${isSelected ? "#000" : "#fff"};
				padding: 1px 5px;
				border-radius: 2px;
				font-size: 9px;
				font-weight: bold;
				white-space: nowrap;
				pointer-events: none;
				opacity: ${isSelected ? "1" : "0"};
				transition: opacity 0.15s;
			`;
			labelEl.textContent = marker.label;
			el.appendChild(labelEl);

			el.addEventListener("mouseenter", () => { labelEl.style.opacity = "1"; });
			el.addEventListener("mouseleave", () => { if (!isSelected) labelEl.style.opacity = "0"; });

			el.addEventListener("click", (e) => {
				e.stopPropagation();
				if (onMarkerPress) onMarkerPress(marker);
			});

			// Normalized image coords (0-1) → viewport coords
			// OpenSeadragon viewport: x=[0,1], y=[0, imageHeight/imageWidth]
			const vpX = marker.x - bboxW / 2;
			const vpY = (marker.y - bboxH / 2) * aspectRatio;
			const vpW = bboxW;
			const vpH = bboxH * aspectRatio;

			viewer.addOverlay({
				element: el,
				location: new OpenSeadragon.Rect(vpX, vpY, vpW, vpH),
			});

			currentOverlays.set(marker.id, el);
		});
	}, [markers, selectedMarkerId, onMarkerPress, isViewerReady, aspectRatio]);

	return (
		<>
			<style>
				{`
          html, body {
            margin: 0;
            padding: 0;
            width: 100%;
            height: 100%;
            overflow: hidden;
            background-color: #121212;
            touch-action: none;
          }
          *:focus {
            outline: none !important;
          }
          * {
            -webkit-tap-highlight-color: transparent !important;
            -webkit-user-select: none !important;
            -ms-user-select: none !important;
            user-select: none !important;
            -webkit-touch-callout: none !important;
          }
          .marker-overlay {
            touch-action: manipulation;
          }
        `}
			</style>
			<div
				ref={containerRef}
				style={{
					width: "100vw",
					height: "100vh",
					backgroundColor: "#121212",
					outline: "none",
					WebkitTapHighlightColor: "transparent",
					WebkitUserSelect: "none",
					userSelect: "none",
					WebkitTouchCallout: "none",
					touchAction: "none",
				}}
			/>
		</>
	);
}
