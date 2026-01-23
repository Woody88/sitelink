"use dom";

import OpenSeadragon from "openseadragon";
import { PMTiles } from "pmtiles";
import * as React from "react";

export interface CalloutMarker {
	id: string;
	x: number; // Normalized 0-1 coordinate (relative to image dimensions)
	y: number; // Normalized 0-1 coordinate (relative to image dimensions)
	label: string;
	targetSheetRef?: string;
	type: "detail" | "section" | "elevation" | "note";
	discipline?: "arch" | "struct" | "elec" | "mech" | "plumb";
	needsReview?: boolean;
}

export interface ViewerState {
	zoom: number;
	minZoom: number;
	maxZoom: number;
	center: { x: number; y: number };
	isReady: boolean;
}

interface PMTilesViewerProps {
	pmtilesUrl: string;
	imageWidth: number;
	imageHeight: number;
	markers?: CalloutMarker[];
	selectedMarkerId?: string | null;
	onMarkerPress?: (marker: CalloutMarker) => Promise<void>;
	onViewerStateChange?: (state: ViewerState) => Promise<void>;
	onReady?: () => Promise<void>;
	onError?: (error: string) => Promise<void>;
}

interface PMTilesMetadata {
	minZoom: number;
	maxZoom: number;
	bounds: [number, number, number, number];
	center: [number, number];
	tileSize: number;
}

export default function PMTilesViewer({
	pmtilesUrl,
	imageWidth,
	imageHeight,
	markers = [],
	selectedMarkerId,
	onMarkerPress,
	onViewerStateChange,
	onReady,
	onError,
}: PMTilesViewerProps) {
	const containerRef = React.useRef<HTMLDivElement>(null);
	const viewerRef = React.useRef<OpenSeadragon.Viewer | null>(null);
	const pmtilesRef = React.useRef<PMTiles | null>(null);
	const markerOverlaysRef = React.useRef<Map<string, HTMLElement>>(new Map());
	const imageDimensionsRef = React.useRef<{
		width: number;
		height: number;
	} | null>(null);
	const [isViewerReady, setIsViewerReady] = React.useState(false);

	React.useEffect(() => {
		if (!containerRef.current) return;

		let viewer: OpenSeadragon.Viewer | null = null;

		const initViewer = async () => {
			try {
				console.log("[PMTilesViewer] Initializing for:", pmtilesUrl);

				const pmtiles = new PMTiles(pmtilesUrl);
				pmtilesRef.current = pmtiles;

				const header = await pmtiles.getHeader();
				console.log("[PMTilesViewer] PMTiles Header:", header);

				// PMTiles tileType: 1=MVT, 2=PNG, 3=JPEG, 4=WebP
				// Our tiles are always 256px (set in dzsave)
				const tileSize = 256;
				const meta: PMTilesMetadata = {
					minZoom: header.minZoom,
					maxZoom: header.maxZoom,
					bounds: [header.minLon, header.minLat, header.maxLon, header.maxLat],
					center: [
						(header.minLon + header.maxLon) / 2,
						(header.minLat + header.maxLat) / 2,
					],
					tileSize,
				};

				// Calculate dimensions based on actual tile coverage
				// Round up to tile boundaries to ensure all edge tiles are requested
				const tilesX = Math.ceil(imageWidth / tileSize);
				const tilesY = Math.ceil(imageHeight / tileSize);
				const width = tilesX * tileSize;
				const height = tilesY * tileSize;

				console.log("[PMTilesViewer] Dimensions:", {
					imageWidth,
					imageHeight,
					tilesX,
					tilesY,
					effectiveWidth: width,
					effectiveHeight: height,
					maxZoom: header.maxZoom,
					tileSize,
				});

				// Store ACTUAL dimensions for marker coordinate scaling
				imageDimensionsRef.current = { width: imageWidth, height: imageHeight };

				const customTileSource: OpenSeadragon.TileSource =
					new OpenSeadragon.TileSource({
						width,
						height,
						tileSize,
						tileOverlap: 0,
						minLevel: header.minZoom,
						maxLevel: header.maxZoom,
						getTileUrl: (level: number, x: number, y: number) => {
							return `pmtiles://${level}/${x}/${y}`;
						},
					});

				viewer = OpenSeadragon({
					element: containerRef.current!,
					tileSources: [customTileSource],
					prefixUrl: "https://openseadragon.github.io/openseadragon/images/",
					animationTime: 0.5,
					blendTime: 0.1,
					constrainDuringPan: true,
					maxZoomPixelRatio: 2,
					minZoomLevel: 0,
					visibilityRatio: 1,
					zoomPerScroll: 2,
					timeout: 120000,
					imageLoaderLimit: 4,
					immediateRender: false,
					showNavigationControl: false,
				});

				viewerRef.current = viewer;

				const originalAddJob = (viewer as any).imageLoader.addJob;
				(viewer as any).imageLoader.addJob = function (options: any) {
					const src = options.src;

					if (src && src.startsWith("pmtiles://")) {
						const match = src.match(/pmtiles:\/\/(\d+)\/(\d+)\/(\d+)/);
						if (match) {
							const [, zStr, xStr, yStr] = match;
							const z = parseInt(zStr, 10);
							const x = parseInt(xStr, 10);
							const y = parseInt(yStr, 10);

							const job = {
								src,
								callback: options.callback,
								abort: options.abort,
								image: null as HTMLImageElement | null,
								errorMsg: null as string | null,
							};

							pmtiles
								.getZxy(z, x, y)
								.then((tileData) => {
									if (tileData?.data) {
										const mimeType =
											header.tileType === 1
												? "image/png"
												: header.tileType === 2
													? "image/jpeg"
													: "image/webp";

										const blob = new Blob([tileData.data], { type: mimeType });
										const url = URL.createObjectURL(blob);

										const img = new Image();
										img.onload = () => {
											job.image = img;
											if (job.callback) {
												job.callback(img, null, src);
											}
											URL.revokeObjectURL(url);
										};
										img.onerror = () => {
											const errorMsg = `Failed to load image from blob: ${src}`;
											console.error(errorMsg);
											job.errorMsg = errorMsg;
											if (job.callback) {
												job.callback(null, job.errorMsg, src);
											}
											URL.revokeObjectURL(url);
										};
										img.src = url;
									} else {
										const errorMsg = `No tile data for ${src}`;
										console.warn(errorMsg);
										job.errorMsg = errorMsg;
										if (job.callback) {
											job.callback(null, job.errorMsg, src);
										}
									}
								})
								.catch((err) => {
									const errorMsg = `PMTiles error for ${src}: ${err.message}`;
									console.error(errorMsg, err);
									job.errorMsg = errorMsg;
									if (job.callback) {
										job.callback(null, job.errorMsg, src);
									}
								});

							return job;
						}
					}

					return originalAddJob.call(this, options);
				};

				viewer.addHandler("open", () => {
					console.log("[PMTilesViewer] Viewer opened successfully");
					// Go to home position which fits the full image in viewport
					if (viewer) {
						viewer.viewport.goHome(true);
						console.log("[PMTilesViewer] Viewport after goHome:", JSON.stringify(viewer.viewport.getBounds()));
					}
					setIsViewerReady(true);
					if (onReady) onReady();
				});

				viewer.addHandler("open-failed", (event: any) => {
					console.error("[PMTilesViewer] Failed to open:", event);
					if (onError) onError("Failed to open PMTiles viewer");
				});

				viewer.addHandler("zoom", () => {
					if (viewer && onViewerStateChange) {
						const viewport = viewer.viewport;
						const zoom = viewport.getZoom(true);
						const center = viewport.getCenter();
						const bounds = viewport.getBounds(true);

						onViewerStateChange({
							zoom,
							minZoom: viewport.getMinZoom(),
							maxZoom: viewport.getMaxZoom(),
							center: { x: center.x, y: center.y },
							isReady: true,
						});
					}
				});

				viewer.addHandler("pan", () => {
					if (viewer && onViewerStateChange) {
						const viewport = viewer.viewport;
						const zoom = viewport.getZoom(true);
						const center = viewport.getCenter();

						onViewerStateChange({
							zoom,
							minZoom: viewport.getMinZoom(),
							maxZoom: viewport.getMaxZoom(),
							center: { x: center.x, y: center.y },
							isReady: true,
						});
					}
				});

				console.log("[PMTilesViewer] Initialization complete");
			} catch (err) {
				const errorMessage = err instanceof Error ? err.message : String(err);
				console.error("[PMTilesViewer] Failed to initialize:", err);
				if (onError) onError(errorMessage);
			}
		};

		initViewer();

		return () => {
			if (viewer) {
				viewer.destroy();
			}
			pmtilesRef.current = null;
			markerOverlaysRef.current.clear();
			setIsViewerReady(false);
		};
	}, [pmtilesUrl, imageWidth, imageHeight, onReady, onError, onViewerStateChange]);

	React.useEffect(() => {
		console.log(`[PMTilesViewer] Marker effect triggered with ${markers.length} markers`);
		const viewer = viewerRef.current;
		if (!viewer) {
			console.log("[PMTilesViewer] No viewer ref yet, skipping markers");
			return;
		}

		markerOverlaysRef.current.forEach((overlay) => {
			viewer.removeOverlay(overlay);
		});
		markerOverlaysRef.current.clear();

		const dimensions = imageDimensionsRef.current;
		if (!dimensions) {
			console.warn(
				"[PMTilesViewer] Image dimensions not available yet, skipping markers",
			);
			return;
		}
		console.log(`[PMTilesViewer] Rendering ${markers.length} markers with dimensions:`, dimensions);

		markers.forEach((marker) => {
			const el = document.createElement("div");
			el.className = "marker-overlay";
			el.style.cssText = `
        position: absolute;
        width: 32px;
        height: 32px;
        margin-left: -16px;
        margin-top: -16px;
        background-color: ${marker.id === selectedMarkerId ? "#3b82f6" : "#ef4444"};
        border: 2px solid white;
        border-radius: 50%;
        cursor: pointer;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        transition: transform 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 12px;
        font-weight: bold;
        z-index: 1000;
      `;

			if (marker.needsReview) {
				el.style.borderColor = "#fbbf24";
			}

			const labelEl = document.createElement("div");
			labelEl.className = "marker-label";
			labelEl.style.cssText = `
        position: absolute;
        top: 38px;
        left: 50%;
        transform: translateX(-50%);
        background-color: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 11px;
        white-space: nowrap;
        pointer-events: none;
        opacity: ${marker.id === selectedMarkerId ? "1" : "0"};
        transition: opacity 0.2s;
      `;
			labelEl.textContent = marker.label;
			el.appendChild(labelEl);

			el.addEventListener("mouseenter", () => {
				el.style.transform = "scale(1.2)";
				labelEl.style.opacity = "1";
			});

			el.addEventListener("mouseleave", () => {
				el.style.transform = "scale(1)";
				if (marker.id !== selectedMarkerId) {
					labelEl.style.opacity = "0";
				}
			});

			el.addEventListener("click", (e) => {
				e.stopPropagation();
				if (onMarkerPress) {
					onMarkerPress(marker);
				}
			});

			// OpenSeadragon viewport coordinates:
			// - x: 0 to 1 (full width)
			// - y: 0 to aspectRatio (height/width)
			// Our markers have normalized (0-1) coords relative to image dimensions
			const aspectRatio = dimensions.height / dimensions.width;

			// Check if coordinates are normalized (0-1 range) or legacy pixel values
			const isNormalized = marker.x <= 1 && marker.y <= 1;

			let viewportX: number;
			let viewportY: number;

			if (isNormalized) {
				// Convert normalized (0-1) to viewport coordinates
				viewportX = marker.x;
				viewportY = marker.y * aspectRatio;
			} else {
				// Legacy: convert pixel coords to viewport coords
				viewportX = marker.x / dimensions.width;
				viewportY = (marker.y / dimensions.height) * aspectRatio;
			}

			console.log(`[PMTilesViewer] Adding marker ${marker.label} at viewport (${viewportX.toFixed(3)}, ${viewportY.toFixed(3)})`);

			viewer.addOverlay({
				element: el,
				location: new OpenSeadragon.Point(viewportX, viewportY),
				placement: OpenSeadragon.Placement.CENTER,
			});

			markerOverlaysRef.current.set(marker.id, el);
		});
	}, [markers, selectedMarkerId, onMarkerPress, isViewerReady]);

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
