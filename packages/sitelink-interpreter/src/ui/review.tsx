import React, { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";

interface Entity {
  id: string;
  sheet_id: string;
  class_label: string;
  ocr_text: string | null;
  confidence: number | null;
  bbox_x1: number;
  bbox_y1: number;
  bbox_x2: number;
  bbox_y2: number;
  identifier: string | null;
  target_sheet: string | null;
  needs_review: number;
  reviewed: number;
  sheet_number?: string;
  image_url?: string;
  sheet_width?: number;
  sheet_height?: number;
}

const CLASS_LABELS = [
  "detail_callout",
  "elevation_callout",
  "section_cut",
  "title_callout",
  "not_a_callout",
];

function App() {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(0);

  useEffect(() => {
    fetchReviewQueue();
  }, []);

  useEffect(() => {
    if (entities.length > 0 && entities[currentIndex]) {
      drawCalloutOnCanvas(entities[currentIndex]!);
    }
  }, [currentIndex, entities, zoomLevel]);

  async function fetchReviewQueue() {
    try {
      const res = await fetch("/api/review");
      const data = await res.json() as { entities: Entity[] };
      setEntities(data.entities);
      setLoading(false);
    } catch (err) {
      setError("Failed to fetch review queue");
      setLoading(false);
    }
  }

  function drawCalloutOnCanvas(entity: Entity) {
    const canvas = canvasRef.current;
    if (!canvas || !entity.image_url) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvasWidth = 1200;
      const canvasHeight = 700;

      const bboxWidth = entity.bbox_x2 - entity.bbox_x1;
      const bboxHeight = entity.bbox_y2 - entity.bbox_y1;
      const bboxCenterX = entity.bbox_x1 + bboxWidth / 2;
      const bboxCenterY = entity.bbox_y1 + bboxHeight / 2;

      const padding = 200;
      const croppedWidth = bboxWidth + padding * 2;
      const croppedHeight = bboxHeight + padding * 2;
      const croppedScale = Math.min(canvasWidth / croppedWidth, canvasHeight / croppedHeight);
      const fullScale = Math.min(canvasWidth / img.width, canvasHeight / img.height);

      const t = zoomLevel / 100;
      const currentScale = croppedScale * (1 - t) + fullScale * t;

      const viewWidth = canvasWidth / currentScale;
      const viewHeight = canvasHeight / currentScale;

      const croppedViewX = bboxCenterX - viewWidth / 2;
      const croppedViewY = bboxCenterY - viewHeight / 2;
      const fullViewX = (img.width - viewWidth) / 2;
      const fullViewY = (img.height - viewHeight) / 2;

      const viewX = Math.max(0, Math.min(img.width - viewWidth, croppedViewX * (1 - t) + fullViewX * t));
      const viewY = Math.max(0, Math.min(img.height - viewHeight, croppedViewY * (1 - t) + fullViewY * t));

      canvas.width = canvasWidth;
      canvas.height = canvasHeight;

      ctx.drawImage(
        img,
        viewX, viewY, viewWidth, viewHeight,
        0, 0, canvasWidth, canvasHeight
      );

      const highlightX = (entity.bbox_x1 - viewX) * currentScale;
      const highlightY = (entity.bbox_y1 - viewY) * currentScale;
      const highlightW = bboxWidth * currentScale;
      const highlightH = bboxHeight * currentScale;

      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 4;
      ctx.strokeRect(highlightX, highlightY, highlightW, highlightH);

      ctx.fillStyle = "rgba(239, 68, 68, 0.2)";
      ctx.fillRect(highlightX, highlightY, highlightW, highlightH);

      ctx.beginPath();
      ctx.arc(highlightX + highlightW / 2, highlightY + highlightH / 2, Math.max(highlightW, highlightH) * 1.5, 0, Math.PI * 2);
      ctx.strokeStyle = "#facc15";
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      setImageLoaded(true);
    };
    img.src = entity.image_url;
  }

  async function submitReview(correctedLabel: string) {
    const entity = entities[currentIndex];
    if (!entity) return;

    try {
      await fetch(`/api/entities/${entity.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ corrected_label: correctedLabel }),
      });

      const newEntities = entities.filter((_, i) => i !== currentIndex);
      setEntities(newEntities);

      if (currentIndex >= newEntities.length && newEntities.length > 0) {
        setCurrentIndex(newEntities.length - 1);
      }

      setSelectedLabel(null);
      setImageLoaded(false);
    } catch (err) {
      setError("Failed to submit review");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="text-xl text-gray-300">Loading review queue...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="text-xl text-red-400">{error}</div>
      </div>
    );
  }

  if (entities.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="text-center">
          <div className="text-3xl text-green-400 mb-2">✓ All caught up!</div>
          <div className="text-gray-400">No entities need review.</div>
        </div>
      </div>
    );
  }

  const entity = entities[currentIndex];
  if (!entity) return null;

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <header className="max-w-6xl mx-auto mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">SiteLink Review</h1>
          <p className="text-gray-400">
            {currentIndex + 1} of {entities.length} items needing review
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setCurrentIndex(Math.max(0, currentIndex - 1)); setZoomLevel(0); }}
            disabled={currentIndex === 0}
            className="px-4 py-2 bg-gray-700 rounded hover:bg-gray-600 disabled:opacity-50"
          >
            ← Prev
          </button>
          <button
            onClick={() => { setCurrentIndex(Math.min(entities.length - 1, currentIndex + 1)); setZoomLevel(0); }}
            disabled={currentIndex === entities.length - 1}
            className="px-4 py-2 bg-gray-700 rounded hover:bg-gray-600 disabled:opacity-50"
          >
            Next →
          </button>
        </div>
      </header>

      {/* Review Controls */}
      <div className="max-w-6xl mx-auto mb-4 bg-gray-800 rounded-lg p-4">
        <div className="flex flex-wrap items-center gap-4 justify-between">
          <div className="flex items-center gap-4">
            <span className="text-3xl font-mono font-bold text-yellow-400">
              {entity.ocr_text || "?"}
            </span>
            <span className="px-3 py-1 bg-gray-700 rounded">
              {entity.class_label.replace(/_/g, " ")}
            </span>
            <span className="text-gray-400">
              Sheet {entity.sheet_number} | Confidence: {((entity.confidence ?? 0) * 100).toFixed(0)}%
              {entity.target_sheet && <span className="ml-2">→ {entity.target_sheet}</span>}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => submitReview(entity.class_label)}
              className="px-4 py-2 bg-green-600 rounded hover:bg-green-500 transition font-medium"
            >
              ✓ Correct
            </button>
            <button
              onClick={() => submitReview("not_a_callout")}
              className="px-4 py-2 bg-red-600 rounded hover:bg-red-500 transition font-medium"
            >
              ✗ Not a Callout
            </button>
            {CLASS_LABELS.filter(l => l !== entity.class_label && l !== "not_a_callout").map(label => (
              <button
                key={label}
                onClick={() => submitReview(label)}
                className="px-3 py-2 bg-gray-700 rounded hover:bg-gray-600 transition text-sm"
              >
                {label.replace(/_/g, " ")}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Plan Image with Zoom */}
      <div className="max-w-6xl mx-auto bg-gray-800 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-400">Zoom:</span>
            <span className="text-xs text-gray-500">Detail</span>
            <input
              type="range"
              min="0"
              max="100"
              value={zoomLevel}
              onChange={(e) => setZoomLevel(Number(e.target.value))}
              className="w-48 accent-yellow-500"
            />
            <span className="text-xs text-gray-500">Full Sheet</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setZoomLevel(0)}
              className={`px-3 py-1 rounded text-sm ${zoomLevel === 0 ? 'bg-yellow-600' : 'bg-gray-700 hover:bg-gray-600'}`}
            >
              Detail
            </button>
            <button
              onClick={() => setZoomLevel(50)}
              className={`px-3 py-1 rounded text-sm ${zoomLevel === 50 ? 'bg-yellow-600' : 'bg-gray-700 hover:bg-gray-600'}`}
            >
              Context
            </button>
            <button
              onClick={() => setZoomLevel(100)}
              className={`px-3 py-1 rounded text-sm ${zoomLevel === 100 ? 'bg-yellow-600' : 'bg-gray-700 hover:bg-gray-600'}`}
            >
              Full
            </button>
          </div>
        </div>
        <div className="bg-gray-900 rounded overflow-auto flex items-center justify-center">
          <canvas
            ref={canvasRef}
            className="max-w-full"
          />
        </div>
        <div className="mt-2 text-xs text-gray-500 text-center">
          Entity {entity.id} | Bbox: ({entity.bbox_x1}, {entity.bbox_y1}) - ({entity.bbox_x2}, {entity.bbox_y2})
        </div>
      </div>
    </div>
  );
}

const root = createRoot(document.getElementById("root")!);
root.render(<App />);
