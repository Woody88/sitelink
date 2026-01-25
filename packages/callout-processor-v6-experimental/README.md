# Callout Processor v6 Experimental - Iteration 5 🚀

**Status:** Active Development - Iteration 5 Complete
**Performance:** 96.6% mAP50, 88.8% mAP50-95 (validation)
**Model:** YOLOv8n with Active Learning
**Last Updated:** 2026-01-25

## Quick Start

### 📚 Documentation

**Start here:** [docs/README.md](docs/README.md)

| Doc | Purpose |
|-----|---------|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System overview, critical parameters |
| [docs/TRAINING.md](docs/TRAINING.md) | How to train/retrain the model |
| [docs/INFERENCE.md](docs/INFERENCE.md) | How to generate detections |
| [docs/ADDING_CLASSES.md](docs/ADDING_CLASSES.md) | How to add new callout classes |

### 🚀 Run Detection

```bash
# API-based detection (recommended)
python src/api_detect.py

# Validation with ground truth
python src/validate_with_ground_truth.py \
  image.png detections.json ground_truth.txt \
  --output validation.png

# Test scripts (organized in test_scripts/)
python test_scripts/test_v5_sahi.py
```

### 🎯 Performance Summary - Iteration 5

**Training Metrics (Epoch 88/100):**

| Metric | Value |
|--------|-------|
| mAP50 | 96.6% |
| mAP50-95 | 88.8% |
| Precision | 95.0% |
| Recall | 92.0% |

**Training Dataset:**
- Combined v8 dataset
- 295 training images
- 126 validation images
- Classes: detail, elevation, title

## Directory Structure

```
callout-processor-v6-experimental/
├── docs/                              # Complete documentation
├── src/                               # Source code
│   ├── api_detect.py                  # API detection endpoint
│   ├── detect_yolo_finetuned.py       # YOLO detection
│   ├── postprocess_filters.py         # Post-processing
│   ├── sahi_tiling.py                 # SAHI tiling logic
│   └── validate_with_ground_truth.py  # Validation
├── active_learning/                   # Active learning iterations
│   └── iterations/
│       └── iteration_5_v8dataset/     # Latest iteration
│           └── weights/best.pt        # Trained model (5.5 MB)
├── dataset_v8_combined/               # Current training dataset (108 MB)
├── v6-experimental/                   # R2 uploads & experiments
│   └── iteration-5/                   # Iteration 5 artifacts
├── weights/                           # Production models
├── test_scripts/                      # Test & utility scripts
├── archive_2026-01-25/                # Archived old files (645 MB)
├── train_combined.py                  # Training script
└── README.md                          # This file
```

## Key Features

- ✅ Active learning pipeline with iterative training
- ✅ YOLOv8n architecture (improved from v5)
- ✅ SAHI tiling for large plan images
- ✅ Post-processing filters for precision
- ✅ Multi-standard support (Canadian + US plans)
- ✅ Three callout classes (detail, elevation, title)

## Model Storage (R2)

Iteration 5 artifacts uploaded to Cloudflare R2 bucket `sitelink-models`:

```
v6-experimental/iteration-5/
├── model/
│   ├── best.pt (5.5 MB)
│   └── metadata.json
├── dataset.tar.gz (86 MB)
├── training/results.csv
└── validation/report.md
```

**Access:** `https://r2.sitelink.dev/v6-experimental/iteration-5/`

## Critical Parameters

**DO NOT CHANGE without retraining:**
- DPI: 72
- Tile Size: 2048×2048 (SAHI)
- Overlap: 0.2
- Model: YOLOv8n

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for details.

## Recent Updates

### 2026-01-25
- ✅ Completed Iteration 5 training (100 epochs)
- ✅ Uploaded model & dataset to R2
- ✅ Cleaned up directory (archived 645 MB, deleted 249 MB temp files)
- ✅ Organized test scripts into `test_scripts/`
- ✅ Updated documentation

### Iteration 5 Results
- Training: mAP50 96.6%, mAP50-95 88.8%
- Dataset: 295 train, 126 validation images
- Model size: 5.5 MB
- Full report: `/tmp/ITERATION5_FINAL_REPORT.md`

## Quick Links

- **Run detection:** `python src/api_detect.py`
- **Validation:** See [docs/INFERENCE.md](docs/INFERENCE.md)
- **Retrain:** See [docs/TRAINING.md](docs/TRAINING.md)
- **Add classes:** See [docs/ADDING_CLASSES.md](docs/ADDING_CLASSES.md)
- **Cleanup:** See [CLEANUP_PLAN.md](CLEANUP_PLAN.md)

## Troubleshooting

See [docs/INFERENCE.md - Troubleshooting](docs/INFERENCE.md#troubleshooting)

---

**Current Status:** Iteration 5 complete with 96.6% mAP50. Ready for integration testing.
