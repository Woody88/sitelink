#!/usr/bin/python3
"""
Evaluate fine-tuned DocLayout-YOLO against the pre-trained baseline.

Compares detection quality on construction structural drawings between:
1. Pre-trained DocLayout-YOLO (DocStructBench, generic document layout)
2. Fine-tuned DocLayout-YOLO (trained on construction plan layouts)

The pre-trained model uses generic classes (Table, Plain Text, Figure, Title)
which we map to Sitelink classes. The fine-tuned model outputs our domain
classes directly (schedule_table, notes_block, legend_box).
"""

import os
os.environ["HF_HUB_ENABLE_XET_DOWNLOAD"] = "0"

import argparse
import json
import sys
from collections import defaultdict
from pathlib import Path

try:
    from doclayout_yolo import YOLOv10
except ImportError:
    print("ERROR: doclayout-yolo not installed.")
    print("Run: pip install doclayout-yolo")
    sys.exit(1)

try:
    import fitz
except ImportError:
    print("ERROR: PyMuPDF not installed.")
    print("Run: pip install PyMuPDF")
    sys.exit(1)

import cv2
import numpy as np

SCRIPT_DIR = Path(__file__).parent.resolve()
PLANS_DIR = Path("/home/woodson/Code/projects/sitelink/docs/plans")
OUTPUT_DIR = SCRIPT_DIR / "eval_doclayout_finetune_results"
DEFAULT_FINETUNED_WEIGHTS = SCRIPT_DIR / "weights" / "doclayout_construction_v1.pt"

PRETRAINED_CLASS_NAMES = [
    "Title",
    "Plain Text",
    "Abandoned Text",
    "Figure",
    "Figure Caption",
    "Table",
    "Table Caption",
    "Table Footnote",
    "Isolated Formula",
    "Formula Caption",
]

SITELINK_MAPPING = {
    "Table": "schedule_table",
    "Plain Text": "notes_block",
    "Title": "title_candidate",
}

PRETRAINED_COLORS = {
    "schedule_table": (0, 200, 0),
    "notes_block": (200, 0, 0),
    "title_candidate": (200, 200, 0),
}

FINETUNED_COLORS = {
    "schedule_table": (0, 200, 0),
    "notes_block": (200, 0, 0),
    "legend_box": (200, 0, 200),
}

TEST_CASES = [
    {
        "pdf": str(PLANS_DIR / "ca/examples/4-Structural-Drawings.pdf"),
        "pages": [0, 1, 2],
        "label": "CA",
    },
    {
        "pdf": str(PLANS_DIR / "us/examples/structural/dwl/ATTACHMENT_11_STRUCTURAL.pdf"),
        "pages": [0, 1, 5],
        "label": "DWL",
    },
]


def render_pdf_page(pdf_path: str, page_num: int, dpi: int = 150) -> tuple:
    doc = fitz.open(pdf_path)
    if page_num >= len(doc):
        doc.close()
        raise ValueError(f"Page {page_num} does not exist. PDF has {len(doc)} pages.")

    page = doc[page_num]
    mat = fitz.Matrix(dpi / 72, dpi / 72)
    pix = page.get_pixmap(matrix=mat)

    img_data = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)
    if pix.n == 4:
        img_bgr = cv2.cvtColor(img_data, cv2.COLOR_RGBA2BGR)
    elif pix.n == 3:
        img_bgr = cv2.cvtColor(img_data, cv2.COLOR_RGB2BGR)
    else:
        img_bgr = cv2.cvtColor(img_data, cv2.COLOR_GRAY2BGR)

    width, height = pix.width, pix.height
    doc.close()
    return img_bgr, width, height


def get_pretrained_model_path() -> str:
    from huggingface_hub import hf_hub_download

    filepath = hf_hub_download(
        repo_id="juliozhao/DocLayout-YOLO-DocStructBench",
        filename="doclayout_yolo_docstructbench_imgsz1024.pt",
    )
    return filepath


def run_pretrained(model, img_path: str, conf: float) -> list[dict]:
    results = model.predict(str(img_path), imgsz=1024, conf=conf, device="cuda:0")
    detections = []
    for box in results[0].boxes:
        cls_id = int(box.cls)
        cls_name = PRETRAINED_CLASS_NAMES[cls_id]
        sitelink_class = SITELINK_MAPPING.get(cls_name)
        if sitelink_class is None:
            continue
        x1, y1, x2, y2 = box.xyxy[0].tolist()
        detections.append({
            "class_name": sitelink_class,
            "original_class": cls_name,
            "confidence": float(box.conf),
            "bbox": [x1, y1, x2, y2],
        })
    return detections


def run_finetuned(model, img_path: str, conf: float) -> list[dict]:
    results = model.predict(str(img_path), imgsz=1024, conf=conf, device="cuda:0")
    detections = []
    class_names = model.model.names if hasattr(model.model, "names") else {}
    for box in results[0].boxes:
        cls_id = int(box.cls)
        cls_name = class_names.get(cls_id, f"class_{cls_id}")
        x1, y1, x2, y2 = box.xyxy[0].tolist()
        detections.append({
            "class_name": cls_name,
            "confidence": float(box.conf),
            "bbox": [x1, y1, x2, y2],
        })
    return detections


def count_by_class(detections: list[dict]) -> dict[str, int]:
    counts = defaultdict(int)
    for det in detections:
        counts[det["class_name"]] += 1
    return dict(counts)


def draw_annotated(img: np.ndarray, detections: list[dict], colors: dict, title: str) -> np.ndarray:
    vis = img.copy()
    for det in detections:
        x1, y1, x2, y2 = [int(v) for v in det["bbox"]]
        cls = det["class_name"]
        conf = det["confidence"]
        color = colors.get(cls, (128, 128, 128))

        cv2.rectangle(vis, (x1, y1), (x2, y2), color, 2)
        label = f"{cls} {conf:.2f}"
        (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
        cv2.rectangle(vis, (x1, y1 - th - 6), (x1 + tw + 4, y1), color, -1)
        cv2.putText(vis, label, (x1 + 2, y1 - 4), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)

    header_h = 40
    header = np.zeros((header_h, vis.shape[1], 3), dtype=np.uint8)
    cv2.putText(header, title, (10, 28), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (255, 255, 255), 2)
    return np.vstack([header, vis])


def format_counts(counts: dict[str, int]) -> str:
    if not counts:
        return "NONE"
    parts = [f"{count} {cls}" for cls, count in sorted(counts.items())]
    return ", ".join(parts)


def run_success_criteria(all_results: dict) -> list[dict]:
    checks = []

    ca_page0_pre = all_results.get(("CA", 0), {}).get("pretrained_counts", {})
    ca_page0_ft = all_results.get(("CA", 0), {}).get("finetuned_counts", {})

    notes_pre = ca_page0_pre.get("notes_block", 0)
    notes_ft = ca_page0_ft.get("notes_block", 0)
    checks.append({
        "test": "CA page 0: notes_block consolidation",
        "description": "Notes should be 3-4 blocks, not 11+ fragments",
        "pretrained": notes_pre,
        "finetuned": notes_ft,
        "pass": 1 <= notes_ft <= 6,
    })

    legend_ft = ca_page0_ft.get("legend_box", 0)
    checks.append({
        "test": "CA page 0: legend_box detection",
        "description": "Should detect at least 1 legend box",
        "pretrained": "N/A (no class)",
        "finetuned": legend_ft,
        "pass": legend_ft >= 1,
    })

    dwl_page1_pre = all_results.get(("DWL", 1), {}).get("pretrained_counts", {})
    dwl_page1_ft = all_results.get(("DWL", 1), {}).get("finetuned_counts", {})

    notes_dwl_pre = dwl_page1_pre.get("notes_block", 0)
    notes_dwl_ft = dwl_page1_ft.get("notes_block", 0)
    checks.append({
        "test": "DWL page 1: notes_block detection",
        "description": "Should detect notes sections missed by pre-trained",
        "pretrained": notes_dwl_pre,
        "finetuned": notes_dwl_ft,
        "pass": notes_dwl_ft >= 1,
    })

    schedule_detected = False
    for key, data in all_results.items():
        ft_counts = data.get("finetuned_counts", {})
        if ft_counts.get("schedule_table", 0) > 0:
            schedule_detected = True
            break
    checks.append({
        "test": "Any page: schedule_table detection",
        "description": "Should detect small schedule tables somewhere",
        "pretrained": "mapped from Table",
        "finetuned": "detected" if schedule_detected else "MISSED",
        "pass": schedule_detected,
    })

    return checks


def main():
    parser = argparse.ArgumentParser(
        description="Evaluate fine-tuned DocLayout-YOLO vs pre-trained baseline"
    )
    parser.add_argument(
        "--weights",
        type=str,
        default=str(DEFAULT_FINETUNED_WEIGHTS),
        help="Path to fine-tuned model weights",
    )
    parser.add_argument(
        "--conf",
        type=float,
        default=0.2,
        help="Confidence threshold (default: 0.2)",
    )
    args = parser.parse_args()

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    print("=" * 70)
    print("DocLayout-YOLO Evaluation: Pre-trained vs Fine-tuned")
    print("=" * 70)

    print("\nLoading pre-trained model (DocStructBench)...")
    pretrained_path = get_pretrained_model_path()
    pretrained_model = YOLOv10(pretrained_path)
    print(f"  Loaded: {pretrained_path}")

    finetuned_path = Path(args.weights)
    if not finetuned_path.exists():
        print(f"\nERROR: Fine-tuned weights not found at {finetuned_path}")
        print("Either train the model first or specify --weights <path>")
        sys.exit(1)

    print(f"\nLoading fine-tuned model...")
    finetuned_model = YOLOv10(str(finetuned_path))
    print(f"  Loaded: {finetuned_path}")

    ft_names = finetuned_model.model.names if hasattr(finetuned_model.model, "names") else {}
    print(f"  Fine-tuned classes: {ft_names}")

    all_results = {}
    comparison_data = []

    for test_case in TEST_CASES:
        pdf_path = test_case["pdf"]
        pdf_label = test_case["label"]

        if not Path(pdf_path).exists():
            print(f"\nSKIP: {pdf_path} not found")
            continue

        pdf_stem = Path(pdf_path).stem.replace(" ", "_").replace("-", "_")

        for page_num in test_case["pages"]:
            print(f"\n{'=' * 60}")
            print(f"  {pdf_label} - Page {page_num}: {Path(pdf_path).name}")
            print(f"{'=' * 60}")

            try:
                img_bgr, width, height = render_pdf_page(pdf_path, page_num)
            except ValueError as e:
                print(f"  ERROR: {e}")
                continue

            print(f"  Image size: {width}x{height}")

            temp_path = OUTPUT_DIR / f"temp_{pdf_stem}_p{page_num}.png"
            cv2.imwrite(str(temp_path), img_bgr)

            print("  Running pre-trained model...")
            pre_dets = run_pretrained(pretrained_model, temp_path, args.conf)
            pre_counts = count_by_class(pre_dets)
            print(f"    Detections: {format_counts(pre_counts)}")

            print("  Running fine-tuned model...")
            ft_dets = run_finetuned(finetuned_model, temp_path, args.conf)
            ft_counts = count_by_class(ft_dets)
            print(f"    Detections: {format_counts(ft_counts)}")

            pre_img = draw_annotated(img_bgr, pre_dets, PRETRAINED_COLORS, f"Pre-trained: {pdf_label} page {page_num}")
            ft_img = draw_annotated(img_bgr, ft_dets, FINETUNED_COLORS, f"Fine-tuned: {pdf_label} page {page_num}")

            pre_out = OUTPUT_DIR / f"{pdf_stem}_{page_num}_pretrained.png"
            ft_out = OUTPUT_DIR / f"{pdf_stem}_{page_num}_finetuned.png"
            cv2.imwrite(str(pre_out), pre_img)
            cv2.imwrite(str(ft_out), ft_img)
            print(f"  Saved: {pre_out.name}, {ft_out.name}")

            temp_path.unlink(missing_ok=True)

            all_results[(pdf_label, page_num)] = {
                "pdf": pdf_path,
                "page": page_num,
                "image_size": [width, height],
                "pretrained_detections": pre_dets,
                "pretrained_counts": pre_counts,
                "finetuned_detections": ft_dets,
                "finetuned_counts": ft_counts,
            }

            comparison_data.append({
                "test_case": f"{pdf_label} page {page_num}",
                "pretrained": pre_counts,
                "finetuned": ft_counts,
                "pretrained_total": len(pre_dets),
                "finetuned_total": len(ft_dets),
            })

    comparison_json = {
        "config": {
            "pretrained_model": "juliozhao/DocLayout-YOLO-DocStructBench",
            "finetuned_weights": str(finetuned_path),
            "confidence_threshold": args.conf,
            "imgsz": 1024,
            "dpi": 150,
        },
        "results": comparison_data,
    }
    comparison_path = OUTPUT_DIR / "comparison.json"
    with open(comparison_path, "w") as f:
        json.dump(comparison_json, f, indent=2)
    print(f"\nSaved comparison JSON: {comparison_path}")

    print(f"\n{'=' * 80}")
    print("COMPARISON TABLE")
    print(f"{'=' * 80}")
    header = f"{'Test Case':<30} | {'Pre-trained':<30} | {'Fine-tuned':<30}"
    print(header)
    print(f"{'-' * 30}-+-{'-' * 30}-+-{'-' * 30}")

    for entry in comparison_data:
        tc = entry["test_case"]
        pre_str = format_counts(entry["pretrained"])
        ft_str = format_counts(entry["finetuned"])
        print(f"{tc:<30} | {pre_str:<30} | {ft_str:<30}")

    print(f"\n{'=' * 80}")
    print("SUCCESS CRITERIA CHECKS")
    print(f"{'=' * 80}")

    checks = run_success_criteria(all_results)
    passed = 0
    total = len(checks)

    for check in checks:
        status = "PASS" if check["pass"] else "FAIL"
        icon = "[+]" if check["pass"] else "[-]"
        print(f"  {icon} {status}: {check['test']}")
        print(f"       {check['description']}")
        print(f"       Pre-trained={check['pretrained']}, Fine-tuned={check['finetuned']}")
        if check["pass"]:
            passed += 1

    print(f"\n  Score: {passed}/{total} checks passed")

    print(f"\n{'=' * 80}")
    print("SUMMARY")
    print(f"{'=' * 80}")
    print(f"  Output directory: {OUTPUT_DIR}/")
    print(f"  Annotated images: *_pretrained.png, *_finetuned.png")
    print(f"  Comparison JSON:  comparison.json")
    print(f"  Success rate:     {passed}/{total}")

    if passed == total:
        print("\n  RESULT: Fine-tuned model meets all success criteria.")
    else:
        failed = [c["test"] for c in checks if not c["pass"]]
        print(f"\n  RESULT: {len(failed)} check(s) failed:")
        for f in failed:
            print(f"    - {f}")


if __name__ == "__main__":
    main()
