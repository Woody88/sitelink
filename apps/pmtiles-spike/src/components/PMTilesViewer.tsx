import { useEffect, useRef, useState } from "react";
import OpenSeadragon from "openseadragon";
import { PMTiles } from "pmtiles";

interface PMTilesViewerProps {
  pmtilesUrl: string;
}

interface PMTilesMetadata {
  minZoom: number;
  maxZoom: number;
  bounds: [number, number, number, number];
  center: [number, number];
  tileSize: number;
}

export default function PMTilesViewer({ pmtilesUrl }: PMTilesViewerProps) {
  const viewerRef = useRef<HTMLDivElement>(null);
  const osdViewerRef = useRef<OpenSeadragon.Viewer | null>(null);
  const pmtilesRef = useRef<PMTiles | null>(null);
  const [metadata, setMetadata] = useState<PMTilesMetadata | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!viewerRef.current) return;

    let viewer: OpenSeadragon.Viewer | null = null;

    const initViewer = async () => {
      try {
        // Initialize PMTiles
        const pmtiles = new PMTiles(pmtilesUrl);
        pmtilesRef.current = pmtiles;

        // Get metadata from PMTiles header
        const header = await pmtiles.getHeader();

        console.log("PMTiles Header:", header);

        // Calculate metadata
        const tileSize = header.tileType === 1 ? 256 : 512; // 1=PNG, 2=JPG, 3=WebP
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

        setMetadata(meta);

        // For image tiles (not map tiles), we need to calculate the pixel dimensions
        // Assuming the tiles form a standard DZI-like pyramid
        const maxZoomLevel = header.maxZoom;
        const tilesWide = Math.pow(2, maxZoomLevel);
        const width = tilesWide * tileSize;
        const height = tilesWide * tileSize;

        console.log("Calculated dimensions:", { width, height, maxZoomLevel, tileSize });

        // Create custom tile source
        const customTileSource: OpenSeadragon.TileSource = new OpenSeadragon.TileSource({
          width,
          height,
          tileSize,
          tileOverlap: 0,
          minLevel: header.minZoom,
          maxLevel: header.maxZoom,
          getTileUrl: (level: number, x: number, y: number) => {
            // Use custom protocol for PMTiles tiles
            return `pmtiles://${level}/${x}/${y}`;
          },
        });

        // Initialize OpenSeadragon viewer
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

        // Override imageLoader.addJob to intercept tile loading
        const originalAddJob = (viewer as any).imageLoader.addJob;
        (viewer as any).imageLoader.addJob = function (options: any) {
          const src = options.src;

          // Check if this is a PMTiles tile
          if (src && src.startsWith("pmtiles://")) {
            const match = src.match(/pmtiles:\/\/(\d+)\/(\d+)\/(\d+)/);
            if (match) {
              const [, zStr, xStr, yStr] = match;
              const z = parseInt(zStr, 10);
              const x = parseInt(xStr, 10);
              const y = parseInt(yStr, 10);

              console.log(`Loading tile: z=${z}, x=${x}, y=${y}`);

              // Create job object
              const job = {
                src,
                callback: options.callback,
                abort: options.abort,
                image: null as HTMLImageElement | null,
                errorMsg: null as string | null,
              };

              // Fetch tile from PMTiles
              pmtiles
                .getZxy(z, x, y)
                .then((tileData) => {
                  if (tileData?.data) {
                    console.log(`Tile loaded: z=${z}, x=${x}, y=${y}, size=${tileData.data.byteLength}`);

                    // Convert ArrayBuffer to Blob
                    const blob = new Blob([tileData.data], {
                      type: "image/webp", // Adjust based on your tile format
                    });
                    const url = URL.createObjectURL(blob);

                    // Create image element
                    const img = new Image();
                    img.onload = () => {
                      job.image = img;
                      // CRITICAL: Callback signature is (image, errorMsg, src)
                      if (job.callback) {
                        job.callback(img, null, src);
                      }
                      // Clean up blob URL
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

          // Fallback to original for non-PMTiles tiles
          return originalAddJob.call(this, options);
        };

        console.log("OpenSeadragon viewer initialized");
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error("Failed to initialize viewer:", err);
        setError(errorMessage);
      }
    };

    initViewer();

    // Cleanup
    return () => {
      if (viewer) {
        viewer.destroy();
      }
      pmtilesRef.current = null;
    };
  }, [pmtilesUrl]);

  return (
    <div className="openseadragon-container">
      <div ref={viewerRef} style={{ width: "100%", height: "100%" }} />
      {error && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            background: "rgba(255, 0, 0, 0.9)",
            color: "white",
            padding: "1rem 2rem",
            borderRadius: "4px",
            maxWidth: "80%",
          }}
        >
          <h3>Error</h3>
          <p>{error}</p>
        </div>
      )}
      {metadata && (
        <div
          style={{
            position: "absolute",
            bottom: "1rem",
            left: "1rem",
            background: "rgba(0, 0, 0, 0.7)",
            color: "white",
            padding: "0.5rem 1rem",
            borderRadius: "4px",
            fontSize: "0.75rem",
            fontFamily: "monospace",
          }}
        >
          <div>Zoom: {metadata.minZoom} - {metadata.maxZoom}</div>
          <div>Tile Size: {metadata.tileSize}px</div>
          <div>Bounds: [{metadata.bounds.join(", ")}]</div>
        </div>
      )}
    </div>
  );
}
