'use dom';

import { useEffect, useRef, useState } from 'react';

interface Props {
  tileSource?: string;
  dom?: import('expo/dom').DOMProps;
}

export default function OpenSeadragonViewer({ tileSource }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const [status, setStatus] = useState('Initializing...');

  useEffect(() => {
    if (!containerRef.current) {
      setStatus('No container ref');
      return;
    }

    if (viewerRef.current) {
      setStatus('Viewer already exists');
      return;
    }

    setStatus('Loading OpenSeadragon...');

    // Dynamic import to avoid "document is not defined" error
    import('openseadragon').then((OSD) => {
      if (!containerRef.current) {
        setStatus('Container lost');
        return;
      }

      setStatus('Creating viewer...');

      try {
        const OpenSeadragon = OSD.default;

        // Use a simple image for testing if no tileSource provided
        const source = tileSource || {
          type: 'image',
          url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/Camponotus_flavomarginatus_ant.jpg/1280px-Camponotus_flavomarginatus_ant.jpg',
        };

        viewerRef.current = OpenSeadragon({
          element: containerRef.current,
          tileSources: source,
          showNavigationControl: true,
          showNavigator: false,
          animationTime: 0.5,
          blendTime: 0.1,
          constrainDuringPan: true,
          maxZoomPixelRatio: 2,
          minZoomLevel: 0.5,
          maxZoomLevel: 10,
          visibilityRatio: 1,
          zoomPerScroll: 2,
          gestureSettingsTouch: {
            pinchRotate: true,
          },
          gestureSettingsMouse: {
            clickToZoom: true,
            dblClickToZoom: true,
          },
        });

        viewerRef.current.addHandler('open', () => {
          setStatus('');
        });

        viewerRef.current.addHandler('open-failed', (event: any) => {
          setStatus(`Failed to load: ${event.message || 'Unknown error'}`);
        });

      } catch (err) {
        setStatus(`Error: ${err instanceof Error ? err.message : 'Unknown'}`);
      }
    }).catch((err) => {
      setStatus(`Import error: ${err instanceof Error ? err.message : 'Unknown'}`);
    });

    return () => {
      if (viewerRef.current) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
    };
  }, [tileSource]);

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
