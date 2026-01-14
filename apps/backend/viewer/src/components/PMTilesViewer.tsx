import OpenSeadragon from "openseadragon";
import { PMTiles } from "pmtiles";
import { useCallback, useEffect, useRef } from "react";
import type { Marker } from "../types";

interface PMTilesViewerProps {
	pmtilesUrl: string;
	imageUrl?: string;
	markers: Marker[];
	selectedMarker: Marker | null;
	onMarkerClick: (marker: Marker) => void;
	sheetWidth?: number; // Original sheet dimensions for legacy coord fallback
	sheetHeight?: number;
}

export default function PMTilesViewer({
	pmtilesUrl,
	imageUrl,
	markers,
	selectedMarker,
	onMarkerClick,
	sheetWidth,
	sheetHeight,
}: PMTilesViewerProps) {
	const viewerRef = useRef<HTMLDivElement>(null);
	const osdViewerRef = useRef<OpenSeadragon.Viewer | null>(null);
	const pmtilesRef = useRef<PMTiles | null>(null);
	const overlayElementsRef = useRef<Map<string, HTMLDivElement>>(new Map());

	const addMarkerOverlays = useCallback(() => {
		const viewer = osdViewerRef.current;
		if (!viewer) {
			console.warn("No viewer available for marker overlays");
			return;
		}

		const tiledImage = viewer.world.getItemAt(0);
		if (!tiledImage) {
			console.warn("No tiled image loaded yet");
			return;
		}

		overlayElementsRef.current.clear();
		viewer.clearOverlays();

		const imageSize = tiledImage.getContentSize();

		console.log(`Adding ${markers.length} marker overlays, imageSize:`, imageSize);

		markers.forEach((marker, index) => {
			const element = document.createElement("div");
			element.className = `marker-overlay${marker.needsReview ? " needs-review" : ""}${
				selectedMarker?.id === marker.id ? " selected" : ""
			}`;
			element.title = `${marker.label} (${Math.round(marker.confidence * 100)}%)`;

			// Check if coordinates are normalized (0-1 range) or legacy pixel values
			const isNormalized = marker.x <= 1 && marker.y <= 1;

			let tilePixelX: number;
			let tilePixelY: number;

			if (isNormalized) {
				// Convert normalized (0-1) to tile pixel coordinates
				tilePixelX = marker.x * imageSize.x;
				tilePixelY = marker.y * imageSize.y;
			} else {
				// Legacy: pixel coords relative to original sheet dimensions
				// Normalize first, then scale to tile image size
				const normalizedX = sheetWidth
					? marker.x / sheetWidth
					: marker.x / imageSize.x;
				const normalizedY = sheetHeight
					? marker.y / sheetHeight
					: marker.y / imageSize.y;
				tilePixelX = normalizedX * imageSize.x;
				tilePixelY = normalizedY * imageSize.y;
			}

			if (index < 3) {
				console.log(`Marker ${marker.id}: (${marker.x}, ${marker.y}) -> pixel (${tilePixelX}, ${tilePixelY}), normalized=${isNormalized}`);
			}

			// Use a Point for the location so the element size is controlled by CSS, not scaled by OSD
			const imagePoint = new OpenSeadragon.Point(tilePixelX, tilePixelY);
			const viewportPoint = viewer.viewport.imageToViewportCoordinates(imagePoint);

			viewer.addOverlay({
				element,
				location: viewportPoint,
				placement: OpenSeadragon.Placement.CENTER,
			});

			new OpenSeadragon.MouseTracker({
				element,
				clickHandler: () => onMarkerClick(marker),
			});

			overlayElementsRef.current.set(marker.id, element);
		});

		console.log(`Added ${markers.length} marker overlays`);
	}, [markers, selectedMarker, onMarkerClick, sheetWidth, sheetHeight]);

	useEffect(() => {
		overlayElementsRef.current.forEach((element, id) => {
			const isSelected = selectedMarker?.id === id;
			const marker = markers.find((m) => m.id === id);
			element.className = `marker-overlay${marker?.needsReview ? " needs-review" : ""}${
				isSelected ? " selected" : ""
			}`;
		});
	}, [selectedMarker, markers]);

	useEffect(() => {
		if (!viewerRef.current) return;

		let viewer: OpenSeadragon.Viewer | null = null;

		const initViewerWithImage = async () => {
			console.log("Initializing viewer with simple image:", imageUrl);

			viewer = OpenSeadragon({
				element: viewerRef.current!,
				tileSources: {
					type: "image",
					url: imageUrl,
				},
				prefixUrl: "//openseadragon.github.io/openseadragon/images/",
				animationTime: 0.5,
				blendTime: 0.1,
				constrainDuringPan: true,
				maxZoomPixelRatio: 4,
				minZoomLevel: 0,
				visibilityRatio: 1,
				zoomPerScroll: 2,
				showNavigator: true,
				navigatorPosition: "TOP_RIGHT",
			});

			osdViewerRef.current = viewer;

			viewer.addHandler("open", () => {
				console.log(
					"OpenSeadragon viewer opened with image, adding marker overlays",
				);
				addMarkerOverlays();
			});
		};

		const initViewerWithPMTiles = async () => {
			try {
				const pmtiles = new PMTiles(pmtilesUrl);
				pmtilesRef.current = pmtiles;

				const header = await pmtiles.getHeader();
				console.log("PMTiles Header:", header);

				const tileSize = header.tileType === 1 ? 256 : 512;
				const maxZoomLevel = header.maxZoom;
				const tilesWide = 2 ** maxZoomLevel;
				const width = tilesWide * tileSize;
				const height = tilesWide * tileSize;

				console.log("Calculated dimensions:", {
					width,
					height,
					maxZoomLevel,
					tileSize,
				});

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
					element: viewerRef.current!,
					tileSources: [customTileSource],
					prefixUrl: "//openseadragon.github.io/openseadragon/images/",
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
					showNavigator: true,
					navigatorPosition: "TOP_RIGHT",
				});

				osdViewerRef.current = viewer;

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
										const blob = new Blob([tileData.data], {
											type: "image/webp",
										});
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
					console.log("OpenSeadragon viewer opened, adding marker overlays");
					addMarkerOverlays();
				});

				console.log("OpenSeadragon viewer initialized with PMTiles");
			} catch (err) {
				console.error("Failed to initialize PMTiles viewer:", err);
				// Fallback to image if PMTiles fails and imageUrl is available
				if (imageUrl) {
					console.log("Falling back to simple image viewer");
					await initViewerWithImage();
				}
			}
		};

		// Prefer image URL if available (more reliable for local dev)
		// PMTiles can be used when properly generated
		if (imageUrl) {
			initViewerWithImage();
		} else if (pmtilesUrl) {
			initViewerWithPMTiles();
		}

		return () => {
			if (viewer) {
				viewer.destroy();
			}
			pmtilesRef.current = null;
			osdViewerRef.current = null;
		};
	}, [pmtilesUrl, imageUrl]);

	useEffect(() => {
		if (osdViewerRef.current && osdViewerRef.current.world.getItemCount() > 0) {
			addMarkerOverlays();
		}
	}, [markers, addMarkerOverlays]);

	return (
		<div className="viewer-container">
			<div ref={viewerRef} className="openseadragon-container" />
		</div>
	);
}
