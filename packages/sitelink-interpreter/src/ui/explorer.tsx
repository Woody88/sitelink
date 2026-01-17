import React, { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";

interface Metrics {
  total_reviewed: number;
  correct: number;
  false_positives: number;
  misclassified: number;
  accuracy: number;
  false_positive_rate: number;
  precision_by_class: Record<string, number>;
}

interface Sheet {
  id: string;
  sheet_number: string;
  sheet_type: string | null;
  sheet_title: string | null;
  page_number: number;
  width: number;
  height: number;
  image_url: string;
}

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
  sheet_number?: string;
}

interface Provenance {
  entity: Entity;
  source_location: {
    sheet_id: string;
    sheet_number: string;
    image_url: string;
    bbox: { x1: number; y1: number; x2: number; y2: number };
  };
  references: Entity[];
  referenced_by: Entity[];
}

const CLASS_COLORS: Record<string, string> = {
  detail_callout: "#22c55e",
  elevation_callout: "#3b82f6",
  section_cut: "#f97316",
  title_callout: "#a855f7",
};

function App() {
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<Sheet | null>(null);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);
  const [provenance, setProvenance] = useState<Provenance | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [retraining, setRetraining] = useState(false);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scale, setScale] = useState(1);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchSheets();
    fetchMetrics();
  }, []);

  useEffect(() => {
    if (selectedSheet) {
      fetchEntities(selectedSheet.id);
    }
  }, [selectedSheet]);

  useEffect(() => {
    if (selectedSheet && entities.length >= 0) {
      drawSheetWithCallouts();
    }
  }, [selectedSheet, entities, selectedEntity, scale]);

  useEffect(() => {
    if (selectedEntity) {
      fetchProvenance(selectedEntity.id);
    } else {
      setProvenance(null);
    }
  }, [selectedEntity]);

  async function fetchSheets() {
    const res = await fetch("/api/sheets");
    const data = await res.json() as { sheets: Sheet[] };
    setSheets(data.sheets);
    if (data.sheets.length > 0) {
      setSelectedSheet(data.sheets[0]!);
    }
    setLoading(false);
  }

  async function fetchMetrics() {
    const res = await fetch("/api/metrics");
    const data = await res.json() as Metrics;
    setMetrics(data);
  }

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("pdf", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const result = await res.json();
      if (result.success) {
        alert(`Processed ${result.pdf_name}:\n- ${result.sheets_created} sheets\n- ${result.entities_found} entities\n- ${result.relationships_created} relationships`);
        fetchSheets();
        fetchMetrics();
      } else {
        alert(`Error: ${result.error}\n${result.details || ""}`);
      }
    } catch (error) {
      alert(`Upload failed: ${error}`);
    }
    setUploading(false);
  }

  async function handleRetrain() {
    if (!confirm("This will re-run detection with learned corrections.\n\nFalse positives will be removed and misclassifications will be fixed.\n\nContinue?")) {
      return;
    }

    setRetraining(true);
    try {
      const res = await fetch("/api/retrain", { method: "POST" });
      const result = await res.json();

      if (result.success) {
        alert(
          `Retraining Complete!\n\n` +
          `Correction rules applied: ${result.correction_rules}\n` +
          `Entities before: ${result.entities_before}\n` +
          `Entities after: ${result.entities_after}\n` +
          `False positives removed: ${result.false_positives_removed}\n` +
          `Corrections applied: ${result.corrections_applied}`
        );
        fetchSheets();
        fetchMetrics();
        if (selectedSheet) {
          fetchEntities(selectedSheet.id);
        }
      } else {
        alert(`Error: ${result.error}\n${result.details || ""}`);
      }
    } catch (error) {
      alert(`Retrain failed: ${error}`);
    }
    setRetraining(false);
  }

  async function fetchEntities(sheetId: string) {
    const res = await fetch(`/api/sheets/${sheetId}/entities`);
    const data = await res.json() as { entities: Entity[] };
    setEntities(data.entities);
    setSelectedEntity(null);
  }

  async function fetchProvenance(entityId: string) {
    const res = await fetch(`/api/entities/${entityId}/provenance`);
    const data = await res.json() as Provenance;
    setProvenance(data);
  }

  function drawSheetWithCallouts() {
    const canvas = canvasRef.current;
    if (!canvas || !selectedSheet) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const maxWidth = 900;
      const maxHeight = 600;
      const imgScale = Math.min(maxWidth / img.width, maxHeight / img.height) * scale;

      canvas.width = img.width * imgScale;
      canvas.height = img.height * imgScale;

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      for (const entity of entities) {
        const x = entity.bbox_x1 * imgScale;
        const y = entity.bbox_y1 * imgScale;
        const w = (entity.bbox_x2 - entity.bbox_x1) * imgScale;
        const h = (entity.bbox_y2 - entity.bbox_y1) * imgScale;

        const isSelected = selectedEntity?.id === entity.id;
        const color = CLASS_COLORS[entity.class_label] || "#888";

        ctx.strokeStyle = isSelected ? "#facc15" : color;
        ctx.lineWidth = isSelected ? 4 : 2;
        ctx.strokeRect(x, y, w, h);

        if (isSelected) {
          ctx.fillStyle = "rgba(250, 204, 21, 0.3)";
          ctx.fillRect(x, y, w, h);
        }

        ctx.fillStyle = isSelected ? "#facc15" : color;
        ctx.font = `bold ${Math.max(12, 14 * scale)}px sans-serif`;
        const label = entity.ocr_text || "?";
        const textWidth = ctx.measureText(label).width;
        ctx.fillRect(x, y - 18 * scale, textWidth + 8, 18 * scale);
        ctx.fillStyle = "#000";
        ctx.fillText(label, x + 4, y - 4 * scale);
      }
    };
    img.src = selectedSheet.image_url;
  }

  function handleCanvasClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas || !selectedSheet) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;

    const maxWidth = 900;
    const maxHeight = 600;
    const imgScale = Math.min(maxWidth / selectedSheet.width, maxHeight / selectedSheet.height);

    const imgX = x / imgScale;
    const imgY = y / imgScale;

    for (const entity of entities) {
      if (imgX >= entity.bbox_x1 && imgX <= entity.bbox_x2 &&
          imgY >= entity.bbox_y1 && imgY <= entity.bbox_y2) {
        setSelectedEntity(entity);
        return;
      }
    }
    setSelectedEntity(null);
  }

  function navigateToSheet(sheetNumber: string) {
    const sheet = sheets.find(s => s.sheet_number === sheetNumber);
    if (sheet) {
      setSelectedSheet(sheet);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl text-gray-300">Loading sheets...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white p-4">
      <header className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-2xl font-bold">SiteLink Plan Explorer</h1>
            <p className="text-gray-400">{sheets.length} sheets | {entities.length} callouts on current sheet</p>
          </div>
          <div className="flex items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="px-4 py-2 bg-green-600 rounded hover:bg-green-500 disabled:opacity-50"
            >
              {uploading ? "Processing..." : "Upload PDF"}
            </button>
            <button
              onClick={handleRetrain}
              disabled={retraining || !metrics || metrics.total_reviewed === 0}
              className="px-4 py-2 bg-yellow-600 rounded hover:bg-yellow-500 disabled:opacity-50"
              title={!metrics || metrics.total_reviewed === 0 ? "Review some entities first" : "Apply learned corrections"}
            >
              {retraining ? "Retraining..." : "Retrain Model"}
            </button>
            <a href="/review" className="px-4 py-2 bg-gray-700 rounded hover:bg-gray-600">
              HITL Review →
            </a>
          </div>
        </div>

        {metrics && metrics.total_reviewed > 0 && (
          <div className="bg-gray-800 rounded-lg p-3 flex items-center gap-6">
            <div className="text-sm">
              <span className="text-gray-400">Model Accuracy:</span>
              <span className={`ml-2 font-bold ${metrics.accuracy >= 70 ? 'text-green-400' : metrics.accuracy >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                {metrics.accuracy}%
              </span>
            </div>
            <div className="text-sm">
              <span className="text-gray-400">False Positives:</span>
              <span className="ml-2 text-red-400">{metrics.false_positive_rate}%</span>
            </div>
            <div className="text-sm">
              <span className="text-gray-400">Reviewed:</span>
              <span className="ml-2">{metrics.total_reviewed}</span>
              <span className="text-gray-500 ml-1">({metrics.correct} correct, {metrics.false_positives} FP, {metrics.misclassified} misclassified)</span>
            </div>
            <div className="flex gap-2 ml-auto">
              {Object.entries(metrics.precision_by_class).map(([label, precision]) => (
                <span key={label} className="text-xs bg-gray-700 px-2 py-1 rounded">
                  {label.replace(/_/g, " ")}: {precision}%
                </span>
              ))}
            </div>
          </div>
        )}
      </header>

      <div className="flex gap-4">
        {/* Sheet List */}
        <div className="w-48 flex-shrink-0">
          <h2 className="text-sm font-semibold text-gray-400 mb-2">SHEETS</h2>
          <div className="space-y-1">
            {sheets.map(sheet => (
              <button
                key={sheet.id}
                onClick={() => setSelectedSheet(sheet)}
                className={`w-full text-left px-3 py-2 rounded ${
                  selectedSheet?.id === sheet.id
                    ? "bg-blue-600"
                    : "bg-gray-800 hover:bg-gray-700"
                }`}
              >
                <div className="font-medium">{sheet.sheet_number}</div>
                <div className="text-xs text-gray-400">{sheet.sheet_type || "Sheet"}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1">
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-4">
                <h2 className="font-semibold">Sheet {selectedSheet?.sheet_number}</h2>
                <div className="flex items-center gap-2 text-sm">
                  {Object.entries(CLASS_COLORS).map(([label, color]) => (
                    <span key={label} className="flex items-center gap-1">
                      <span className="w-3 h-3 rounded" style={{ backgroundColor: color }} />
                      <span className="text-gray-400">{label.replace(/_/g, " ")}</span>
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-400">Zoom:</span>
                <button onClick={() => setScale(Math.max(0.5, scale - 0.25))} className="px-2 py-1 bg-gray-700 rounded">-</button>
                <span className="w-12 text-center">{(scale * 100).toFixed(0)}%</span>
                <button onClick={() => setScale(Math.min(2, scale + 0.25))} className="px-2 py-1 bg-gray-700 rounded">+</button>
              </div>
            </div>
            <div className="bg-gray-900 rounded overflow-auto max-h-[600px]">
              <canvas
                ref={canvasRef}
                onClick={handleCanvasClick}
                className="cursor-crosshair"
              />
            </div>
            <p className="text-xs text-gray-500 mt-2">Click on a callout to see its provenance and references</p>
          </div>
        </div>

        {/* Provenance Panel */}
        <div className="w-80 flex-shrink-0">
          <h2 className="text-sm font-semibold text-gray-400 mb-2">PROVENANCE</h2>
          {selectedEntity && provenance ? (
            <div className="bg-gray-800 rounded-lg p-4 space-y-4">
              <div>
                <div className="text-3xl font-mono font-bold text-yellow-400">
                  {selectedEntity.ocr_text || "?"}
                </div>
                <div className="text-sm text-gray-400 mt-1">
                  {selectedEntity.class_label.replace(/_/g, " ")}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Sheet {selectedEntity.sheet_number} at ({selectedEntity.bbox_x1}, {selectedEntity.bbox_y1})
                </div>
              </div>

              {selectedEntity.target_sheet && (
                <div className="border-t border-gray-700 pt-3">
                  <div className="text-sm text-gray-400 mb-2">References sheet:</div>
                  <button
                    onClick={() => navigateToSheet(selectedEntity.target_sheet!)}
                    className="w-full px-4 py-3 bg-blue-600 rounded hover:bg-blue-500 text-left"
                  >
                    <div className="font-bold">→ Sheet {selectedEntity.target_sheet}</div>
                    <div className="text-xs text-blue-200">Click to navigate</div>
                  </button>
                </div>
              )}

              {provenance.references.length > 0 && (
                <div className="border-t border-gray-700 pt-3">
                  <div className="text-sm text-gray-400 mb-2">
                    References ({provenance.references.length}):
                  </div>
                  <div className="space-y-2">
                    {provenance.references.map(ref => (
                      <button
                        key={ref.id}
                        onClick={() => {
                          navigateToSheet(ref.sheet_number!);
                          setTimeout(() => setSelectedEntity(ref), 100);
                        }}
                        className="w-full px-3 py-2 bg-gray-700 rounded hover:bg-gray-600 text-left text-sm"
                      >
                        <span className="font-mono text-green-400">{ref.ocr_text}</span>
                        <span className="text-gray-400 ml-2">on {ref.sheet_number}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {provenance.referenced_by.length > 0 && (
                <div className="border-t border-gray-700 pt-3">
                  <div className="text-sm text-gray-400 mb-2">
                    Referenced by ({provenance.referenced_by.length}):
                  </div>
                  <div className="space-y-2">
                    {provenance.referenced_by.map(ref => (
                      <button
                        key={ref.id}
                        onClick={() => {
                          navigateToSheet(ref.sheet_number!);
                          setTimeout(() => setSelectedEntity(ref), 100);
                        }}
                        className="w-full px-3 py-2 bg-gray-700 rounded hover:bg-gray-600 text-left text-sm"
                      >
                        <span className="font-mono text-orange-400">{ref.ocr_text}</span>
                        <span className="text-gray-400 ml-2">on {ref.sheet_number}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="border-t border-gray-700 pt-3 text-xs text-gray-500">
                Entity ID: {selectedEntity.id}
              </div>
            </div>
          ) : (
            <div className="bg-gray-800 rounded-lg p-4 text-gray-500 text-center">
              Select a callout to see provenance
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const root = createRoot(document.getElementById("root")!);
root.render(<App />);
