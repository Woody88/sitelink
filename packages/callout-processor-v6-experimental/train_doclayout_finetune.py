#!/usr/bin/python3
"""
Fine-tune DocLayout-YOLO on construction drawing layout regions.

This script fine-tunes the DocLayout-YOLO model (pre-trained on DocStructBench)
to detect four layout region classes specific to construction/architectural
drawings: schedule_table, notes_block, and legend_box.

DocLayout-YOLO uses a YOLOv10 architecture with document-specific enhancements
(D2DocE modules for multi-scale feature extraction). The pre-trained weights
from DocStructBench provide strong initialization for document layout detection,
which we adapt to the construction drawing domain.

Pre-requisites:
    pip install doclayout-yolo huggingface_hub

Usage:
    # Basic training (100 epochs, batch 4)
    python train_doclayout_finetune.py

    # Custom epochs and batch size
    python train_doclayout_finetune.py --epochs 50 --batch 2

    # Resume from checkpoint
    python train_doclayout_finetune.py --resume

    # Freeze backbone layers for transfer learning
    python train_doclayout_finetune.py --freeze 10

Dataset:
    Expects a YOLO-format dataset at datasets/document-layout-construction/data.yaml
    with 3 classes: schedule_table, notes_block, legend_box.
    Annotate with Roboflow or CVAT, export in YOLOv8 format.
"""

import argparse
import os
import shutil
import sys
from pathlib import Path

os.environ["HF_HUB_ENABLE_XET_DOWNLOAD"] = "0"

from huggingface_hub import hf_hub_download

try:
    from doclayout_yolo import YOLOv10
except ImportError:
    print("ERROR: doclayout-yolo not installed.")
    print("Run: pip install doclayout-yolo")
    sys.exit(1)

CLASSES = ["legend", "notes", "schedule"]
NUM_CLASSES = len(CLASSES)

DATA_YAML = "datasets/document-layout-construction/data.yaml"

PROJECT = "runs/layout"
NAME = "doclayout_finetune_v1"

WEIGHTS_DIR = Path("weights")
OUTPUT_WEIGHTS = WEIGHTS_DIR / "doclayout_construction_v1.pt"


def download_pretrained() -> str:
    """Download DocLayout-YOLO pre-trained weights from HuggingFace."""
    print("Downloading DocLayout-YOLO pre-trained weights...")
    filepath = hf_hub_download(
        repo_id="juliozhao/DocLayout-YOLO-DocStructBench",
        filename="doclayout_yolo_docstructbench_imgsz1024.pt",
    )
    print(f"Model path: {filepath}")
    return filepath


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Fine-tune DocLayout-YOLO on construction drawing layout regions"
    )
    parser.add_argument(
        "--epochs",
        type=int,
        default=100,
        help="Number of training epochs (default: 100)",
    )
    parser.add_argument(
        "--batch",
        type=int,
        default=4,
        help="Batch size. Use 4 for RTX 3080 10GB, reduce to 2 if OOM (default: 4)",
    )
    parser.add_argument(
        "--resume",
        action="store_true",
        help="Resume training from last checkpoint",
    )
    parser.add_argument(
        "--freeze",
        type=int,
        default=0,
        help="Number of backbone layers to freeze for transfer learning (default: 0)",
    )
    return parser.parse_args()


def validate_dataset(data_yaml: str) -> None:
    """Check that the dataset YAML exists and print its contents."""
    data_path = Path(data_yaml)
    if not data_path.exists():
        print(f"ERROR: Dataset not found at {data_path.resolve()}")
        print()
        print("Expected dataset structure:")
        print(f"  {data_path.parent}/")
        print(f"    data.yaml")
        print(f"    train/")
        print(f"      images/")
        print(f"      labels/")
        print(f"    valid/")
        print(f"      images/")
        print(f"      labels/")
        print()
        print("data.yaml should contain:")
        print(f"  train: train/images")
        print(f"  val: valid/images")
        print(f"  nc: {NUM_CLASSES}")
        print(f"  names: {CLASSES}")
        print()
        print("Annotate with Roboflow, export as YOLOv8 format.")
        sys.exit(1)

    print(f"Dataset config: {data_path.resolve()}")
    with open(data_path) as f:
        print(f"Contents:\n{f.read()}")


def train(args: argparse.Namespace) -> None:
    validate_dataset(DATA_YAML)

    model_path = download_pretrained()
    model = YOLOv10(model_path)
    print("Model loaded successfully!")

    print(f"\n{'=' * 60}")
    print("Training Configuration:")
    print(f"  Model: DocLayout-YOLO (DocStructBench pre-trained)")
    print(f"  Dataset: {DATA_YAML}")
    print(f"  Classes ({NUM_CLASSES}): {', '.join(CLASSES)}")
    print(f"  Epochs: {args.epochs}")
    print(f"  Image Size: 1024")
    print(f"  Batch Size: {args.batch}")
    print(f"  Freeze Layers: {args.freeze}")
    print(f"  Resume: {args.resume}")
    print(f"  LR: 0.001 -> 0.00001 (cosine)")
    print(f"  Warmup: 5 epochs")
    print(f"  Patience: 20 epochs (early stopping)")
    print(f"{'=' * 60}\n")

    results = model.train(
        data=DATA_YAML,
        epochs=args.epochs,
        imgsz=1024,
        batch=args.batch,
        device=0,
        workers=4,
        # Learning rate
        lr0=0.001,
        lrf=0.01,
        warmup_epochs=5,
        # Augmentation - conservative for B&W construction drawings
        hsv_h=0.0,
        hsv_s=0.0,
        hsv_v=0.2,
        degrees=0,
        translate=0.1,
        scale=0.3,
        shear=0,
        perspective=0,
        flipud=0,
        fliplr=0.5,
        mosaic=0.3,
        mixup=0.0,
        copy_paste=0.0,
        # Training control
        patience=20,
        save_period=10,
        freeze=args.freeze,
        resume=args.resume,
        # Output
        project=PROJECT,
        name=NAME,
        val=True,
        plots=True,
        verbose=True,
    )

    best_weights = Path(PROJECT) / NAME / "weights" / "best.pt"
    if best_weights.exists():
        WEIGHTS_DIR.mkdir(parents=True, exist_ok=True)
        shutil.copy2(best_weights, OUTPUT_WEIGHTS)
        print(f"\nBest weights copied to: {OUTPUT_WEIGHTS.resolve()}")
    else:
        print(f"\nWARNING: best.pt not found at {best_weights}")
        print("Training may not have completed successfully.")

    print(f"\n{'=' * 60}")
    print("Training Complete!")
    print(f"  Run directory: {PROJECT}/{NAME}/")
    print(f"  Best weights:  {OUTPUT_WEIGHTS}")
    print(f"  Results CSV:   {PROJECT}/{NAME}/results.csv")
    print(f"{'=' * 60}\n")

    return results


if __name__ == "__main__":
    args = parse_args()
    train(args)
