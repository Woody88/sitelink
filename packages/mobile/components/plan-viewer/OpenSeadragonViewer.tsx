'use dom';

import { useEffect, useRef, useState } from 'react';

/**
 * DZI Metadata - matches the schema from client.ts
 */
interface DziMetadata {
  width: number;
  height: number;
  tileSize: number;
  overlap: number;
  format: string;
}

interface Props {
  /**
   * Pre-fetched DZI metadata from React Native
   */
  metadata: DziMetadata;
  /**
   * Callback to fetch tiles from React Native (handles auth)
   * Returns base64 data URL for the tile
   */
  fetchTile: (level: number, x: number, y: number) => Promise<string>;
  /**
   * DOM props from Expo
   */
  dom?: import('expo/dom').DOMProps;
}

/**
 * OpenSeadragon viewer that displays DZI tiles
 *
 * Architecture:
 * 1. React Native fetches tiles (authenticated)
 * 2. Returns base64 data URLs via fetchTile callback
 * 3. OpenSeadragon uses custom ImageLoader to load from base64
 */
export default function OpenSeadragonViewer({ metadata, fetchTile }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const [status, setStatus] = useState('Initializing...');

  useEffect(() => {
    if (!containerRef.current) {
      setStatus('No container ref');
      return;
    }

    if (viewerRef.current) {
      viewerRef.current.destroy();
      viewerRef.current = null;
    }

    setStatus('Loading OpenSeadragon...');

    import('openseadragon').then(async (OSD) => {
      if (!containerRef.current) {
        setStatus('Container lost');
        return;
      }

      setStatus('Creating viewer...');

      try {
        const OpenSeadragon = OSD.default;

        const maxLevel = Math.ceil(Math.log2(Math.max(metadata.width, metadata.height) / metadata.tileSize));

        // Create a simple tile source with proper DZI structure
        const tileSourceConfig = {
          width: metadata.width,
          height: metadata.height,
          tileSize: metadata.tileSize,
          tileOverlap: metadata.overlap,
          minLevel: 0,
          maxLevel,
          // Use a custom protocol so we can identify our tiles
          getTileUrl: function(level: number, x: number, y: number): string {
            return `native-bridge://${level}/${x}_${y}`;
          },
        };

        // Create viewer
        viewerRef.current = OpenSeadragon({
          element: containerRef.current,
          tileSources: tileSourceConfig,
          // Hide navigation icons (zoom buttons, home, fullscreen)
          showNavigationControl: false,
          showNavigator: false,
          animationTime: 0.5,
          blendTime: 0.1,
          constrainDuringPan: true,
          maxZoomPixelRatio: 2,
          minZoomLevel: 0.5,
          maxZoomLevel: 10,
          visibilityRatio: 1,
          zoomPerScroll: 2,
          // Increase timeout
          timeout: 120000,
          // Limit concurrent requests
          imageLoaderLimit: 2,
          // Disable rotation - only allow zoom and pan
          gestureSettingsTouch: {
            pinchRotate: false,
          } as any,
          gestureSettingsMouse: {
            clickToZoom: true,
            dblClickToZoom: true,
          },
        });

        const viewer = viewerRef.current;

        // Override the addTiledImage to inject our custom loading
        const originalAddJob = (viewer as any).imageLoader.addJob;
        (viewer as any).imageLoader.addJob = function(options: any) {
          const src = options.src;

          // Check if this is our custom protocol
          if (src && src.startsWith('native-bridge://')) {
            // Parse the tile coordinates from URL
            const match = src.match(/native-bridge:\/\/(\d+)\/(\d+)_(\d+)/);
            if (match) {
              const level = parseInt(match[1], 10);
              const x = parseInt(match[2], 10);
              const y = parseInt(match[3], 10);

              console.log(`[ImageLoader] Loading tile ${level}/${x}_${y} via native bridge...`);

              // Create a proper job object that OpenSeadragon expects
              const job = {
                src,
                crossOriginPolicy: options.crossOriginPolicy || false,
                callback: options.callback,
                abort: options.abort,
                timeout: options.timeout,
                image: null as any,
                errorMsg: null,
              };

              // Fetch tile via React Native
              fetchTile(level, x, y)
                .then((base64Data) => {
                  console.log(`[ImageLoader] Tile ${level}/${x}_${y} fetched, creating image...`);

                  // Create image from base64
                  const img = new Image();
                  img.crossOrigin = options.crossOriginPolicy || 'anonymous';

                  img.onload = () => {
                    console.log(`[ImageLoader] Tile ${level}/${x}_${y} image loaded successfully`);

                    // Store image in job object
                    job.image = img;

                    // Call the callback with just the image (OpenSeadragon's expected signature)
                    if (job.callback) {
                      job.callback(img, job.errorMsg, job.src);
                    }
                  };

                  img.onerror = (e) => {
                    console.error(`[ImageLoader] Tile ${level}/${x}_${y} image error:`, e);
                    job.errorMsg = 'Image failed to load';
                    if (job.abort) {
                      job.abort();
                    } else if (job.callback) {
                      job.callback(null, job.errorMsg, job.src);
                    }
                  };

                  img.src = base64Data;
                })
                .catch((err) => {
                  console.error(`[ImageLoader] Failed to fetch tile ${level}/${x}_${y}:`, err);
                  job.errorMsg = err.message || 'Failed to fetch tile';
                  if (job.abort) {
                    job.abort();
                  } else if (job.callback) {
                    job.callback(null, job.errorMsg, job.src);
                  }
                });

              // Return the job object
              return job;
            }
          }

          // Fall back to original implementation for non-native-bridge URLs
          return originalAddJob.call(this, options);
        };

        viewer.addHandler('open', () => {
          console.log('[OpenSeadragon] Viewer opened successfully');
          setStatus('');
        });

        viewer.addHandler('open-failed', (event: any) => {
          const errorMsg = event.message || 'Unknown error';
          console.error('[OpenSeadragon] open-failed:', event);
          setStatus(`Failed to load plan: ${errorMsg}`);
        });

        viewer.addHandler('tile-loaded', (event: any) => {
          console.log('[OpenSeadragon] Tile loaded:', event.tile?.level, event.tile?.x, event.tile?.y);
        });

        viewer.addHandler('tile-load-failed', (event: any) => {
          console.error('[OpenSeadragon] Tile load failed:', event.tile?.level, event.tile?.x, event.tile?.y);
        });

        setStatus('Loading tiles...');

      } catch (err) {
        console.error('[OpenSeadragon] Initialization error:', err);
        setStatus(`Error: ${err instanceof Error ? err.message : 'Unknown'}`);
      }
    }).catch((err) => {
      console.error('[OpenSeadragon] Import error:', err);
      setStatus(`Import error: ${err instanceof Error ? err.message : 'Unknown'}`);
    });

    return () => {
      if (viewerRef.current) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
    };
  }, [metadata, fetchTile]);

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        backgroundColor: '#222',
        position: 'relative',
      }}
    >
      {status && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          color: '#fff',
          fontSize: '14px',
          textAlign: 'center',
          padding: '20px',
          zIndex: 1000,
          backgroundColor: 'rgba(0,0,0,0.7)',
          borderRadius: '8px',
        }}>
          {status}
        </div>
      )}
      <div
        ref={containerRef}
        id="openseadragon-viewer"
        style={{
          width: '100%',
          height: '100%',
        }}
      />
    </div>
  );
}
