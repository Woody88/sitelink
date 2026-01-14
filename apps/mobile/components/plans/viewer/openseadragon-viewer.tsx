"use dom";

import OpenSeadragon from "openseadragon";
import * as React from "react";

interface OpenSeadragonViewerProps {
	imageUrl: string;
	// Markers and other props kept in interface but ignored for simple test
	markers?: any[];
	selectedMarkerId?: string | null;
	onMarkerPress?: (marker: any) => Promise<void>;
	onViewerStateChange?: (state: any) => Promise<void>;
	onReady?: () => Promise<void>;
	onError?: (error: string) => Promise<void>;
}

/**
 * STRIPPED BACK VIEWER FOR TESTING
 * Following: https://openseadragon.github.io/examples/tilesource-image/
 */
export default function OpenSeadragonViewer({
	imageUrl,
	onReady,
	onError,
}: OpenSeadragonViewerProps) {
	const containerRef = React.useRef<HTMLDivElement>(null);
	const viewerRef = React.useRef<OpenSeadragon.Viewer | null>(null);

	React.useEffect(() => {
		if (!containerRef.current) return;

		console.log("[OpenSeadragon] Initializing test viewer for:", imageUrl);

		try {
			const viewer = OpenSeadragon({
				element: containerRef.current,
				// Using online prefix for icons
				prefixUrl: "https://openseadragon.github.io/openseadragon/images/",
				tileSources: {
					type: "image",
					url: imageUrl,
					buildPyramid: false, // Standard images don't need pyramids
					crossOriginPolicy: "Anonymous", // CRITICAL for Picsum/CORS
				} as any,
				// Basic configuration
				showNavigationControl: false,
				drawer: "canvas", // Fix deprecation warning
				autoResize: true,
				// Centering and Zoom constraints
				panHorizontal: true,
				panVertical: true,
				visibilityRatio: 1.0, // Image can't leave the viewer
				constrainDuringPan: true,
			} as any);

			viewerRef.current = viewer;

			viewer.addHandler("open", () => {
				console.log("[OpenSeadragon] SUCCESS: Image opened successfully");
				if (onReady) onReady();
			});

			viewer.addHandler("open-failed", (event) => {
				console.error("[OpenSeadragon] Image failed to open:", event);
				onError?.("Failed to open image");
			});

			return () => {
				if (viewerRef.current) {
					viewerRef.current.destroy();
					viewerRef.current = null;
				}
			};
		} catch (err) {
			console.error("[OpenSeadragon] Init error:", err);
			onError?.("Initialization error");
		}
	}, [imageUrl, onReady, onError]);

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
