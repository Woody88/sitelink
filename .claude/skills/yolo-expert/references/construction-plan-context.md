# Construction Plan Symbol Detection Context

Domain-specific knowledge for training YOLO models on construction/architectural plans.

## Problem Characteristics

### Symbol Properties

- **Rotation**: Symbols appear at arbitrary angles (0-360 degrees)
- **Scale variance**: Same symbol type varies in size across plans
- **Density**: Many symbols clustered in small areas
- **Overlap**: Symbols may overlap with lines, text, other symbols
- **Line context**: Symbols often connected to/embedded in linework

### Plan Types

| Plan Type | Symbol Density | Typical Symbols |
|-----------|----------------|-----------------|
| **Electrical** | High | Outlets, switches, fixtures, panels |
| **Plumbing** | Medium | Fixtures, valves, pipes, drains |
| **HVAC** | Medium | Diffusers, units, ducts, thermostats |
| **Structural** | Low | Columns, beams, footings, sections |
| **Architectural** | Variable | Doors, windows, stairs, callouts |

### Image Characteristics

- **Resolution**: Construction plans are typically high-DPI (300+)
- **Color**: Often monochrome or limited color
- **Background**: White/light with black linework
- **Aspect ratio**: Sheets are typically 24x36" or 30x42" (landscape)

## OBB Task Selection

**Why OBB over standard detection?**

Standard detection (`task: detect`) produces axis-aligned bounding boxes. For construction symbols:

```
Standard detect:          OBB:
┌─────────────┐          ╱╲
│   ╱╲        │         ╱  ╲
│  ╱  ╲       │        ╱    ╲
│ ╱    ╲      │       ╱      ╲
│╱──────╲     │      ╱────────╲
└─────────────┘

Wastes area, poor IoU       Tight fit, accurate
```

OBB provides:
- Tighter bounding around rotated symbols
- Better IoU during training
- Accurate rotation information for downstream use

## Training Recommendations

### Image Size

```python
# Standard: 640px
# Recommended for construction plans: 1280px or higher
model.train(data="dataset.yaml", imgsz=1280)
```

**Rationale**: Construction plans have many small symbols. Higher resolution preserves detail.

### Batch Size

```python
# Reduce batch size for high-resolution images
# GPU memory constraint: batch_size * imgsz^2
model.train(data="dataset.yaml", imgsz=1280, batch=8)  # Adjust based on GPU
```

### Augmentation Considerations

```yaml
# Be careful with rotation augmentation - symbols already have rotation
# Heavy rotation augmentation may create unrealistic orientations

# Recommended augmentation settings:
augment: true
degrees: 0.0  # Disable additional rotation (OBB handles this)
scale: 0.5    # Scale variation helps
mosaic: 1.0   # Mosaic helps with dense layouts
mixup: 0.0    # Mixup may confuse line-heavy images
```

### Class Balance

Construction plans often have imbalanced symbol distribution:

```python
# Check class distribution
from collections import Counter
# ... count labels per class

# Options for imbalance:
# 1. Oversample rare classes
# 2. Use class weights (not directly supported, use focal loss)
# 3. Augment rare classes more heavily
```

## Annotation Guidelines

### OBB Label Format

```
# class_id x_center y_center width height rotation
# rotation in radians, counter-clockwise from positive x-axis

0 0.5 0.5 0.1 0.05 0.785  # 45-degree rotated symbol
```

### Best Practices

1. **Tight boxes**: Bound the symbol tightly, not surrounding context
2. **Consistent orientation**: Define "up" for each symbol class
3. **Include variations**: Same symbol in different rotations/scales
4. **Context awareness**: Include some background in training images

## Evaluation Metrics

### Key Metrics for Construction Plans

| Metric | Target | Notes |
|--------|--------|-------|
| **mAP@50** | >0.8 | Primary accuracy metric |
| **mAP@50-95** | >0.6 | Stricter localization |
| **Precision** | >0.9 | Minimize false positives (critical for counting) |
| **Recall** | >0.85 | Catch most symbols |

### Common Issues

| Symptom | Likely Cause | Solution |
|---------|--------------|----------|
| Low recall | Symbols too small | Increase imgsz, add small object augmentation |
| Low precision | Similar-looking symbols | More training data, class refinement |
| Poor localization | Inconsistent annotations | Review and clean annotations |
| Rotation errors | Annotation inconsistency | Standardize rotation convention |

## Deployment Considerations

### Export Formats

For construction plan processing pipeline:

```python
# ONNX for cross-platform deployment
model.export(format="onnx", imgsz=1280)

# TensorRT for NVIDIA GPU inference
model.export(format="engine", imgsz=1280)

# CoreML for Apple devices
model.export(format="coreml", imgsz=1280)
```

### Inference Optimization

```python
# For batch processing many plan pages:
model.predict(
    source="plans/*.png",
    imgsz=1280,
    conf=0.25,      # Lower threshold, filter later
    iou=0.45,       # NMS threshold
    max_det=1000,   # Plans can have many symbols
    save=True,
    save_txt=True,  # Save detections for processing
)
```
