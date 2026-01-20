#!/usr/bin/env python3
"""
Train YOLO for callout detection at high resolution.

Usage:
    python src/train_yolo.py --epochs 100

IMPORTANT: Callout symbols (detail circles, elevation triangles) are very small.
At 1280x1280 training resolution:
  - Detail circles: ~9px (TOO SMALL - YOLO minimum is ~20-30px)
  - Elevation triangles: ~19px (borderline)

At 2560x2560 training resolution:
  - Detail circles: ~18px (borderline acceptable)
  - Elevation triangles: ~40px (good)

Always train at 2560+ resolution for reliable callout detection.
"""

import argparse
from pathlib import Path

from ultralytics import YOLO


def main():
    parser = argparse.ArgumentParser(description='Train YOLO for callout detection')
    parser.add_argument('--model', default='yolo11n.pt',
                        help='Base model (yolo11n.pt, yolo26n.pt, yolo11s.pt)')
    parser.add_argument('--epochs', type=int, default=100, help='Training epochs')
    parser.add_argument('--batch', type=int, default=2, help='Batch size (smaller for large images)')
    parser.add_argument('--imgsz', type=int, default=2560, help='Image size for training (2560+ recommended)')
    parser.add_argument('--data', default='dataset/dataset.yaml', help='Dataset YAML')
    parser.add_argument('--name', default='callout_detector_highres', help='Run name')
    parser.add_argument('--resume', action='store_true', help='Resume from last checkpoint')
    parser.add_argument('--device', default='0', help='GPU device (0, 1, or cpu)')

    args = parser.parse_args()

    data_path = Path(args.data).absolute()
    if not data_path.exists():
        print(f"Error: Dataset YAML not found: {data_path}")
        return

    print("=" * 60)
    print("YOLO High-Resolution Training for Callout Detection")
    print("=" * 60)
    print(f"Model: {args.model}")
    print(f"Epochs: {args.epochs}")
    print(f"Batch size: {args.batch}")
    print(f"Image size: {args.imgsz}")
    print(f"Dataset: {data_path}")
    print(f"Device: {args.device}")
    print("=" * 60)

    if args.imgsz < 2560:
        print("\n⚠️  WARNING: imgsz < 2560 may result in poor detection of small callouts")
        print("   Detail circles need ~18+ px to be detectable (requires 2560+ imgsz)")
        print("")

    if args.imgsz >= 2560 and args.batch > 2:
        print("\n⚠️  WARNING: High imgsz with batch > 2 may cause GPU OOM")
        print("   Consider using --batch 2 or --batch 1")
        print("")

    model = YOLO(args.model)

    results = model.train(
        data=str(data_path),
        epochs=args.epochs,
        batch=args.batch,
        imgsz=args.imgsz,
        name=args.name,
        device=args.device,
        # Data augmentation - tuned for construction drawings
        hsv_h=0.0,      # No hue shift (drawings are black/white)
        hsv_s=0.0,      # No saturation shift
        hsv_v=0.2,      # Slight brightness variation
        degrees=0,      # No rotation (drawings are axis-aligned)
        translate=0.1,  # Slight translation
        scale=0.3,      # Scale augmentation
        shear=0,        # No shear
        perspective=0,  # No perspective
        flipud=0,       # No vertical flip
        fliplr=0.5,     # Horizontal flip (drawings can be mirrored)
        mosaic=0.5,     # Reduced mosaic (preserve drawing context)
        mixup=0.0,      # No mixup
        copy_paste=0.0, # No copy-paste
        # Training settings
        patience=20,    # Early stopping patience
        save_period=10, # Save every 10 epochs
        val=True,       # Validate during training
        plots=True,     # Generate plots
        verbose=True,
    )

    print("\n" + "=" * 60)
    print("Training Complete!")
    print("=" * 60)

    # Show where the model was saved
    best_model = Path(results.save_dir) / "weights" / "best.pt"
    last_model = Path(results.save_dir) / "weights" / "last.pt"

    print(f"Best model: {best_model}")
    print(f"Last model: {last_model}")

    # Copy best model to weights directory
    weights_dir = Path(__file__).parent.parent / "weights"
    weights_dir.mkdir(exist_ok=True)

    import shutil
    dest_model = weights_dir / "callout_detector.pt"
    shutil.copy(best_model, dest_model)
    print(f"Model copied to: {dest_model}")


if __name__ == '__main__':
    main()
