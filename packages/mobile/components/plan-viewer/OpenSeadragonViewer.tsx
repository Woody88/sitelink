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

/**
 * Marker/Hyperlink data from the API
 */
export interface Marker {
  id: string;
  calloutRef: string;
  targetSheetRef: string;
  x: number;
  y: number;
  confidence: number;
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
   * Markers/callouts to display on the plan
   */
  markers?: Marker[];
  /**
   * Callback when a marker is tapped
   */
  onMarkerPress?: (marker: Marker) => void;
  /**
   * Callback when a marker position is adjusted (long-press + drag)
   * newX and newY are normalized coordinates (0-1)
   */
  onMarkerPositionUpdate?: (marker: Marker, newX: number, newY: number) => void;
  /**
   * Marker callout ref to highlight (e.g., "5" to highlight marker "5/A7")
   * Used when navigating from another sheet to highlight the target marker
   */
  highlightMarkerRef?: string;
  /**
   * DOM props from Expo
   */
  dom?: import('expo/dom').DOMProps;
}

// Styling constants - more transparent to show callout details underneath
const MARKER_STYLES = {
  // Very subtle background - almost transparent
  normalBackground: 'rgba(255, 87, 34, 0.08)',
  normalBorder: 'rgba(255, 87, 34, 0.5)',
  // Slightly more visible on hover
  hoverBackground: 'rgba(255, 87, 34, 0.15)',
  hoverBorder: 'rgba(255, 87, 34, 0.7)',
  // Edit mode - pulsing border, slightly more opaque
  editBackground: 'rgba(255, 87, 34, 0.12)',
  editBorder: '#FF5722',
  // Highlight mode - green glow for navigation target
  highlightBackground: 'rgba(76, 175, 80, 0.15)',
  highlightBorder: '#4CAF50',
};

/**
 * OpenSeadragon viewer that displays DZI tiles with marker overlays
 *
 * Architecture:
 * 1. React Native fetches tiles (authenticated)
 * 2. Returns base64 data URLs via fetchTile callback
 * 3. OpenSeadragon uses custom ImageLoader to load from base64
 * 4. Markers are rendered as small transparent anchors that scale with zoom
 *
 * Marker Interaction:
 * - Tap: Show marker details (onMarkerPress)
 * - Long press: Enter adjustment mode (marker becomes draggable)
 * - Drag: Reposition marker
 * - Release: Save new position (onMarkerPositionUpdate) and exit adjustment mode
 */
export default function OpenSeadragonViewer({
  metadata,
  fetchTile,
  markers = [],
  onMarkerPress,
  onMarkerPositionUpdate,
  highlightMarkerRef
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const [status, setStatus] = useState('Initializing...');
  const markersAddedRef = useRef(false);
  // Track which marker is in edit/adjustment mode
  const [editingMarkerIndex, setEditingMarkerIndex] = useState<number | null>(null);
  // Track highlighted marker element for cleanup
  const highlightedMarkerRef = useRef<{ element: HTMLElement; timeoutId: ReturnType<typeof setTimeout> } | null>(null);
  // Store marker elements for highlight lookup
  const markerElementsRef = useRef<Map<string, HTMLElement>>(new Map());

  // Function to apply highlight styling to a marker element
  const applyHighlightStyle = (element: HTMLElement) => {
    element.style.background = MARKER_STYLES.highlightBackground;
    element.style.borderColor = MARKER_STYLES.highlightBorder;
    element.style.borderWidth = '3px';
    element.style.animation = 'marker-highlight 1.5s ease-in-out infinite';
  };

  // Function to remove highlight styling from a marker element
  const removeHighlightStyle = (element: HTMLElement) => {
    element.style.background = MARKER_STYLES.normalBackground;
    element.style.borderColor = MARKER_STYLES.normalBorder;
    element.style.borderWidth = '2px';
    element.style.boxShadow = 'none';
    element.style.animation = '';
  };

  // Function to highlight a marker and pan to it
  const highlightMarker = (calloutRef: string, viewer: any) => {
    // Clear any existing highlight
    if (highlightedMarkerRef.current) {
      clearTimeout(highlightedMarkerRef.current.timeoutId);
      removeHighlightStyle(highlightedMarkerRef.current.element);
      highlightedMarkerRef.current = null;
    }

    // Find the marker element
    const markerElement = markerElementsRef.current.get(calloutRef);
    if (!markerElement || !viewer) {
      console.log(`[OpenSeadragon] Could not find marker element for calloutRef: ${calloutRef}`);
      return;
    }

    // Find the marker data to get coordinates
    const marker = markers.find(m => m.calloutRef === calloutRef);
    if (!marker) {
      console.log(`[OpenSeadragon] Could not find marker data for calloutRef: ${calloutRef}`);
      return;
    }

    console.log(`[OpenSeadragon] Highlighting marker ${calloutRef}`);

    // Apply highlight styling
    applyHighlightStyle(markerElement);

    // Get the image dimensions and pan to the marker
    const tiledImage = viewer.world.getItemAt(0);
    if (tiledImage) {
      const imageSize = tiledImage.getContentSize();
      const tilePixelX = marker.x * imageSize.x;
      const tilePixelY = marker.y * imageSize.y;

      // Convert to viewport coordinates
      const viewportPoint = viewer.viewport.imageToViewportCoordinates(tilePixelX, tilePixelY);

      // Pan to center the marker with a nice zoom level
      viewer.viewport.panTo(viewportPoint, false);
      // Optionally zoom in a bit to make the marker more visible
      const currentZoom = viewer.viewport.getZoom();
      if (currentZoom < 2) {
        viewer.viewport.zoomTo(2, viewportPoint, false);
      }
    }

    // Set up timeout to remove highlight after 2 seconds
    const timeoutId = setTimeout(() => {
      removeHighlightStyle(markerElement);
      highlightedMarkerRef.current = null;
      console.log(`[OpenSeadragon] Removed highlight from marker ${calloutRef}`);
    }, 2000);

    highlightedMarkerRef.current = { element: markerElement, timeoutId };
  };

  // Add markers to the viewer as overlays (matching demo styling)
  const addMarkersToViewer = (viewer: any, OpenSeadragon: any) => {
    if (!viewer || markersAddedRef.current || markers.length === 0) {
      return;
    }

    console.log(`[OpenSeadragon] Adding ${markers.length} marker overlays...`);
    markersAddedRef.current = true;

    // Clear the marker elements map
    markerElementsRef.current.clear();

    // Get the image dimensions from the tiled image
    const tiledImage = viewer.world.getItemAt(0);
    const imageSize = tiledImage.getContentSize();

    console.log('[OpenSeadragon] Image size:', imageSize.x, 'x', imageSize.y);

    // Size of overlay in image pixels (will scale with zoom) - small and subtle
    const overlayPixelSize = 25;

    markers.forEach((marker, index) => {
      // Create the marker overlay element - styled to be more transparent
      const markerElement = document.createElement('div');
      markerElement.id = `marker-${index}`;
      markerElement.className = 'callout-overlay';
      markerElement.dataset.markerIndex = String(index);
      markerElement.dataset.calloutRef = marker.calloutRef;

      // Store reference for highlight lookup
      markerElementsRef.current.set(marker.calloutRef, markerElement);

      // Check if this marker should be initially highlighted
      const shouldHighlight = highlightMarkerRef && marker.calloutRef === highlightMarkerRef;

      // Style as a subtle transparent ring - very see-through
      markerElement.style.cssText = `
        width: 100%;
        height: 100%;
        border: 2px solid ${shouldHighlight ? MARKER_STYLES.highlightBorder : MARKER_STYLES.normalBorder};
        border-radius: 50%;
        background: ${shouldHighlight ? MARKER_STYLES.highlightBackground : MARKER_STYLES.normalBackground};
        cursor: pointer;
        pointer-events: auto;
        box-sizing: border-box;
        transition: background 0.15s ease-out, box-shadow 0.15s ease-out, border-color 0.15s ease-out;
      `;

      // If this marker should be highlighted, apply the animation and set up removal
      if (shouldHighlight) {
        markerElement.style.borderWidth = '3px';
        markerElement.style.animation = 'marker-highlight 1.5s ease-in-out infinite';

        // Set up timeout to remove highlight after 2 seconds
        const timeoutId = setTimeout(() => {
          removeHighlightStyle(markerElement);
          highlightedMarkerRef.current = null;
          console.log(`[OpenSeadragon] Removed initial highlight from marker ${marker.calloutRef}`);
        }, 2000);

        highlightedMarkerRef.current = { element: markerElement, timeoutId };
      }

      // Track state for this marker
      let isInEditMode = false;
      let longPressTimer: ReturnType<typeof setTimeout> | null = null;
      let isDragging = false;
      let currentOverlayLocation: any = null;

      // Function to enter edit mode
      const enterEditMode = () => {
        isInEditMode = true;
        setEditingMarkerIndex(index);
        markerElement.style.background = MARKER_STYLES.editBackground;
        markerElement.style.borderColor = MARKER_STYLES.editBorder;
        markerElement.style.borderWidth = '3px';
        markerElement.style.boxShadow = '0 0 8px rgba(255, 87, 34, 0.6)';
        // Add pulsing animation
        markerElement.style.animation = 'marker-pulse 1.5s ease-in-out infinite';
        markerElement.style.cursor = 'grab';
        console.log(`[OpenSeadragon] Marker ${marker.calloutRef} entered edit mode`);
      };

      // Function to exit edit mode
      const exitEditMode = () => {
        isInEditMode = false;
        isDragging = false;
        setEditingMarkerIndex(null);
        markerElement.style.background = MARKER_STYLES.normalBackground;
        markerElement.style.borderColor = MARKER_STYLES.normalBorder;
        markerElement.style.borderWidth = '2px';
        markerElement.style.boxShadow = 'none';
        markerElement.style.animation = '';
        markerElement.style.cursor = 'pointer';
        console.log(`[OpenSeadragon] Marker ${marker.calloutRef} exited edit mode`);
      };

      // Add hover effect (only when not in edit mode)
      markerElement.addEventListener('mouseenter', () => {
        if (!isInEditMode) {
          markerElement.style.background = MARKER_STYLES.hoverBackground;
          markerElement.style.borderColor = MARKER_STYLES.hoverBorder;
          markerElement.style.boxShadow = '0 0 6px rgba(255, 87, 34, 0.3)';
        }
      });
      markerElement.addEventListener('mouseleave', () => {
        if (!isInEditMode) {
          markerElement.style.background = MARKER_STYLES.normalBackground;
          markerElement.style.borderColor = MARKER_STYLES.normalBorder;
          markerElement.style.boxShadow = 'none';
        }
      });

      // Convert normalized coordinates (0-1) to tile image pixel coordinates
      // marker.x and marker.y are NORMALIZED coordinates from the API (0-1 range)
      // Must multiply by tile image dimensions to get actual pixel positions
      // See: packages/callout-processor/OPENSEADRAGON-INTEGRATION.md
      const tilePixelX = marker.x * imageSize.x;
      const tilePixelY = marker.y * imageSize.y;

      // Create a Rect in IMAGE coordinates (pixels), centered on the callout
      const imageRect = new OpenSeadragon.Rect(
        tilePixelX - overlayPixelSize / 2,
        tilePixelY - overlayPixelSize / 2,
        overlayPixelSize,
        overlayPixelSize
      );

      // Convert image rect to viewport rect
      const viewportRect = viewer.viewport.imageToViewportRectangle(imageRect);
      currentOverlayLocation = viewportRect;

      console.log(`[OpenSeadragon] Callout ${marker.calloutRef}: normalized(${marker.x.toFixed(4)}, ${marker.y.toFixed(4)}) -> imagePixels(${tilePixelX.toFixed(0)}, ${tilePixelY.toFixed(0)})`);

      // Add overlay using the viewport rect - scales with image, no drift
      viewer.addOverlay({
        element: markerElement,
        location: viewportRect,
      });

      // If this marker should be highlighted, pan to it
      if (shouldHighlight) {
        // Delay panning slightly to ensure viewer is ready
        setTimeout(() => {
          const viewportPoint = viewer.viewport.imageToViewportCoordinates(tilePixelX, tilePixelY);
          viewer.viewport.panTo(viewportPoint, false);
          const currentZoom = viewer.viewport.getZoom();
          if (currentZoom < 2) {
            viewer.viewport.zoomTo(2, viewportPoint, false);
          }
          console.log(`[OpenSeadragon] Panned to highlighted marker ${marker.calloutRef}`);
        }, 100);
      }

      // Use MouseTracker for all interactions
      new OpenSeadragon.MouseTracker({
        element: markerElement,

        // Press handler - start long press timer
        pressHandler: (event: any) => {
          if (!onMarkerPositionUpdate) return; // Skip if no update callback

          // Start long press timer (500ms)
          longPressTimer = setTimeout(() => {
            enterEditMode();
            // Prevent the click from firing after long press
            event.preventDefaultAction = true;
          }, 500);
        },

        // Release handler - end drag or cancel long press
        releaseHandler: () => {
          // Clear long press timer
          if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
          }

          // If we were dragging, save the new position
          if (isInEditMode && isDragging && onMarkerPositionUpdate) {
            // Get the current overlay position
            const overlay = viewer.getOverlayById(`marker-${index}`);
            if (overlay) {
              const bounds = overlay.getBounds(viewer.viewport);
              const centerViewport = bounds.getCenter();

              // Convert viewport coordinates back to image coordinates
              const imagePoint = viewer.viewport.viewportToImageCoordinates(centerViewport);

              // Convert to normalized coordinates (0-1)
              const newX = imagePoint.x / imageSize.x;
              const newY = imagePoint.y / imageSize.y;

              console.log(`[OpenSeadragon] Marker ${marker.calloutRef} repositioned to normalized(${newX.toFixed(4)}, ${newY.toFixed(4)})`);

              // Call the update callback
              onMarkerPositionUpdate(marker, newX, newY);
            }
          }

          // Exit edit mode
          if (isInEditMode) {
            exitEditMode();
          }
        },

        // Drag handler - reposition marker if in edit mode
        dragHandler: (event: any) => {
          if (!isInEditMode || !onMarkerPositionUpdate) return;

          isDragging = true;
          markerElement.style.cursor = 'grabbing';

          // Get the delta in viewport coordinates
          const delta = event.delta;

          // Get current overlay and update its position
          const overlay = viewer.getOverlayById(`marker-${index}`);
          if (overlay && currentOverlayLocation) {
            // Calculate new position
            const zoom = viewer.viewport.getZoom();
            const containerSize = viewer.viewport.getContainerSize();

            // Convert pixel delta to viewport coordinates
            const viewportDeltaX = delta.x / containerSize.x / zoom;
            const viewportDeltaY = delta.y / containerSize.y / zoom;

            // Update the location
            const newRect = new OpenSeadragon.Rect(
              currentOverlayLocation.x + viewportDeltaX,
              currentOverlayLocation.y + viewportDeltaY,
              currentOverlayLocation.width,
              currentOverlayLocation.height
            );

            currentOverlayLocation = newRect;
            viewer.updateOverlay(markerElement, newRect);
          }
        },

        // Click handler - only fires if not a long press
        clickHandler: () => {
          // Don't trigger click if we were in edit mode or dragging
          if (isInEditMode || isDragging) {
            return;
          }

          if (onMarkerPress) {
            onMarkerPress(marker);
          }
        },
      });

      console.log(`[OpenSeadragon] Added marker ${marker.calloutRef}`);
    });

    // Add CSS keyframes for pulse and highlight animations
    const styleElement = document.createElement('style');
    styleElement.id = 'marker-animations';
    // Only add if not already present
    if (!document.getElementById('marker-animations')) {
      styleElement.textContent = `
        @keyframes marker-pulse {
          0%, 100% {
            box-shadow: 0 0 8px rgba(255, 87, 34, 0.6);
          }
          50% {
            box-shadow: 0 0 16px rgba(255, 87, 34, 0.9);
          }
        }
        @keyframes marker-highlight {
          0%, 100% {
            box-shadow: 0 0 12px rgba(76, 175, 80, 0.8);
          }
          50% {
            box-shadow: 0 0 24px rgba(76, 175, 80, 1);
          }
        }
      `;
      document.head.appendChild(styleElement);
    }

    console.log(`[OpenSeadragon] Finished adding ${markers.length} markers`);
  };

  useEffect(() => {
    if (!containerRef.current) {
      setStatus('No container ref');
      return;
    }

    if (viewerRef.current) {
      viewerRef.current.destroy();
      viewerRef.current = null;
    }

    // Reset markers added flag when viewer is recreated
    markersAddedRef.current = false;

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
                image: null as HTMLImageElement | null,
                errorMsg: null as string | null,
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
          // Add markers once the viewer is ready, passing OpenSeadragon for Rect/MouseTracker
          addMarkersToViewer(viewer, OpenSeadragon);
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
      // Clean up highlight timeout on unmount
      if (highlightedMarkerRef.current) {
        clearTimeout(highlightedMarkerRef.current.timeoutId);
      }
      if (viewerRef.current) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
    };
  }, [metadata, fetchTile]);

  // Re-add markers when they change
  useEffect(() => {
    if (viewerRef.current && markers.length > 0 && !markersAddedRef.current) {
      // Need to get OpenSeadragon reference for Rect/MouseTracker
      import('openseadragon').then((OSD) => {
        addMarkersToViewer(viewerRef.current, OSD.default);
      });
    }
  }, [markers]);

  // Handle highlightMarkerRef changes after initial render
  useEffect(() => {
    if (!highlightMarkerRef || !viewerRef.current || !markersAddedRef.current) {
      return;
    }

    // If markers are already added, highlight the matching one
    highlightMarker(highlightMarkerRef, viewerRef.current);
  }, [highlightMarkerRef]);

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
      {/* Marker count badge - red theme to match anchors */}
      {markers.length > 0 && !status && (
        <div style={{
          position: 'absolute',
          bottom: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          color: '#fff',
          padding: '8px 16px',
          borderRadius: '20px',
          fontSize: '14px',
          fontWeight: '500',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          zIndex: 1000,
        }}>
          <div style={{
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            backgroundColor: '#FF5722',
            border: '2px solid rgba(255, 87, 34, 0.4)',
          }} />
          {markers.length} {markers.length === 1 ? 'Callout' : 'Callouts'}
          {editingMarkerIndex !== null && (
            <span style={{
              marginLeft: '8px',
              fontSize: '12px',
              color: '#FF5722',
              fontStyle: 'italic'
            }}>
              Adjusting...
            </span>
          )}
        </div>
      )}
    </div>
  );
}
