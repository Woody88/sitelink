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
  yolo_confidence: number | null;
  ocr_confidence: number | null;
  detection_method: string | null;
  standard: string | null;
  raw_ocr_text: string | null;
  crop_image_path: string | null;
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
  const [detecting, setDetecting] = useState(false);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scale, setScale] = useState(1);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [useYOLO, setUseYOLO] = useState(true);
  const [showLowConfidence, setShowLowConfidence] = useState(true);
  const [confThreshold, setConfThreshold] = useState(0.1);

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
  }, [selectedSheet, entities, selectedEntity, scale, showLowConfidence, confThreshold]);

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

      const endpoint = useYOLO ? "/api/detect" : "/api/upload";

      if (useYOLO) {
        formData.append("options", JSON.stringify({
          dpi: 300,
          confThreshold: confThreshold,
        }));
      }

      const res = await fetch(endpoint, {
        method: "POST",
        body: formData,
      });

      const result = await res.json();
      if (result.success) {
        const methodLabel = useYOLO ? "YOLO" : "Legacy";
        alert(`Processed ${result.pdf_name} (${methodLabel}):\n- ${result.sheets_created} sheets\n- ${result.entities_found} entities\n- ${result.needs_review ?? 0} need review\n- ${result.relationships_created} relationships`);
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

  async function handleDetectSheet() {
    if (!selectedSheet) return;

    setDetecting(true);
    try {
      const res = await fetch(`/api/sheets/${selectedSheet.id}/detect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confThreshold: confThreshold,
        }),
      });

      const result = await res.json();
      if (result.success) {
        alert(`Detected ${result.entities_detected} entities on sheet ${result.sheet_number}`);
        fetchEntities(selectedSheet.id);
      } else {
        alert(`Error: ${result.error}\n${result.details || ""}`);
      }
    } catch (error) {
      alert(`Detection failed: ${error}`);
    }
    setDetecting(false);
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
      const maxWidth = 1400;
      const maxHeight = 900;
      const imgScale = Math.min(maxWidth / img.width, maxHeight / img.height) * scale;

      canvas.width = img.width * imgScale;
      canvas.height = img.height * imgScale;

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const filteredEntities = entities.filter(e => {
        if (!showLowConfidence && (e.confidence ?? 1) < confThreshold) {
          return false;
        }
        return true;
      });

      for (const entity of filteredEntities) {
        const x = entity.bbox_x1 * imgScale;
        const y = entity.bbox_y1 * imgScale;
        const w = (entity.bbox_x2 - entity.bbox_x1) * imgScale;
        const h = (entity.bbox_y2 - entity.bbox_y1) * imgScale;

        const isSelected = selectedEntity?.id === entity.id;
        const isLowConf = (entity.confidence ?? 1) < confThreshold;
        const color = CLASS_COLORS[entity.class_label] || "#888";

        ctx.strokeStyle = isSelected ? "#facc15" : isLowConf ? "#666" : color;
        ctx.lineWidth = isSelected ? 4 : 2;
        ctx.setLineDash(isLowConf ? [5, 5] : []);
        ctx.strokeRect(x, y, w, h);
        ctx.setLineDash([]);

        if (isSelected) {
          ctx.fillStyle = "rgba(250, 204, 21, 0.3)";
          ctx.fillRect(x, y, w, h);
        }

        ctx.fillStyle = isSelected ? "#facc15" : isLowConf ? "#666" : color;
        ctx.font = `bold ${Math.max(12, 14 * scale)}px sans-serif`;
        const label = entity.ocr_text || "?";
        const textWidth = ctx.measureText(label).width;
        ctx.fillRect(x, y - 18 * scale, textWidth + 8, 18 * scale);
        ctx.fillStyle = isLowConf ? "#aaa" : "#000";
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
            <div className="flex items-center gap-2 bg-gray-800 rounded px-2 py-1">
              <label className="text-sm text-gray-400 flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={useYOLO}
                  onChange={(e) => setUseYOLO(e.target.checked)}
                  className="w-4 h-4"
                />
                YOLO
              </label>
              <span className="text-gray-600">|</span>
              <label className="text-sm text-gray-400 flex items-center gap-1">
                Conf:
                <input
                  type="range"
                  min="0.1"
                  max="0.9"
                  step="0.1"
                  value={confThreshold}
                  onChange={(e) => setConfThreshold(parseFloat(e.target.value))}
                  className="w-16"
                />
                <span className="w-8">{(confThreshold * 100).toFixed(0)}%</span>
              </label>
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="px-4 py-2 bg-green-600 rounded hover:bg-green-500 disabled:opacity-50"
            >
              {uploading ? "Processing..." : "Upload PDF"}
            </button>
            <button
              onClick={handleDetectSheet}
              disabled={detecting || !selectedSheet}
              className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-500 disabled:opacity-50"
              title="Run YOLO detection on current sheet"
            >
              {detecting ? "Detecting..." : "Detect Sheet"}
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
              <div className="flex items-center gap-4">
                <label className="text-sm text-gray-400 flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={showLowConfidence}
                    onChange={(e) => setShowLowConfidence(e.target.checked)}
                    className="w-4 h-4"
                  />
                  Show low confidence
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-400">Zoom:</span>
                  <button onClick={() => setScale(Math.max(0.25, scale - 0.25))} className="px-2 py-1 bg-gray-700 rounded">-</button>
                  <span className="w-12 text-center">{(scale * 100).toFixed(0)}%</span>
                  <button onClick={() => setScale(Math.min(4, scale + 0.25))} className="px-2 py-1 bg-gray-700 rounded">+</button>
                </div>
              </div>
            </div>
            <div className="bg-gray-900 rounded overflow-auto max-h-[800px]">
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

              {selectedEntity.crop_image_path && (
                <div className="border-t border-gray-700 pt-3">
                  <div className="text-sm text-gray-400 mb-2">Detection Crop:</div>
                  <div className="bg-gray-900 rounded p-2 flex items-center justify-center">
                    <img
                      src={`/api/entities/${selectedEntity.id}/crop`}
                      alt="Detection crop"
                      className="max-h-24 border border-gray-600"
                    />
                  </div>
                </div>
              )}

              {(selectedEntity.yolo_confidence != null || selectedEntity.ocr_confidence != null) && (
                <div className="border-t border-gray-700 pt-3">
                  <div className="text-sm text-gray-400 mb-2">Confidence Scores:</div>
                  <div className="space-y-2 text-sm">
                    {selectedEntity.yolo_confidence != null && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500">YOLO:</span>
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-2 bg-gray-700 rounded overflow-hidden">
                            <div
                              className={`h-full ${selectedEntity.yolo_confidence >= 0.7 ? 'bg-green-500' : selectedEntity.yolo_confidence >= 0.5 ? 'bg-yellow-500' : 'bg-red-500'}`}
                              style={{ width: `${selectedEntity.yolo_confidence * 100}%` }}
                            />
                          </div>
                          <span className="w-12 text-right">{(selectedEntity.yolo_confidence * 100).toFixed(0)}%</span>
                        </div>
                      </div>
                    )}
                    {selectedEntity.ocr_confidence != null && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500">OCR:</span>
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-2 bg-gray-700 rounded overflow-hidden">
                            <div
                              className={`h-full ${selectedEntity.ocr_confidence >= 0.7 ? 'bg-green-500' : selectedEntity.ocr_confidence >= 0.5 ? 'bg-yellow-500' : 'bg-red-500'}`}
                              style={{ width: `${selectedEntity.ocr_confidence * 100}%` }}
                            />
                          </div>
                          <span className="w-12 text-right">{(selectedEntity.ocr_confidence * 100).toFixed(0)}%</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {(selectedEntity.identifier || selectedEntity.standard) && (
                <div className="border-t border-gray-700 pt-3">
                  <div className="text-sm text-gray-400 mb-2">Parsed Data:</div>
                  <div className="space-y-1 text-sm">
                    {selectedEntity.identifier && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Identifier:</span>
                        <span className="font-mono text-green-400">{selectedEntity.identifier}</span>
                      </div>
                    )}
                    {selectedEntity.target_sheet && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Target Sheet:</span>
                        <span className="font-mono text-blue-400">{selectedEntity.target_sheet}</span>
                      </div>
                    )}
                    {selectedEntity.standard && selectedEntity.standard !== 'auto' && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Standard:</span>
                        <span className="uppercase text-purple-400">{selectedEntity.standard}</span>
                      </div>
                    )}
                    {selectedEntity.detection_method && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Method:</span>
                        <span className="uppercase text-gray-400">{selectedEntity.detection_method}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

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

              {selectedEntity.raw_ocr_text && selectedEntity.raw_ocr_text !== selectedEntity.ocr_text && (
                <div className="border-t border-gray-700 pt-3 text-xs text-gray-500">
                  Raw OCR: {selectedEntity.raw_ocr_text}
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
