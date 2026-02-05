# Ultralytics Documentation Map

Comprehensive mapping of Ultralytics YOLO documentation sections for accurate Context7 queries.

## Primary Documentation Sections

### Modes (https://docs.ultralytics.com/modes/)

Core operational modes for YOLO models.

| Mode | Description | Query Keywords |
|------|-------------|----------------|
| **Train** | Train models on custom datasets | `train epochs batch imgsz optimizer lr0` |
| **Val** | Validate model performance | `val metrics mAP precision recall` |
| **Predict** | Run inference on images/video | `predict source conf iou save` |
| **Export** | Convert models to deployment formats | `export onnx tensorrt coreml openvino` |
| **Track** | Multi-object tracking | `track bytetrack botsort persist` |
| **Benchmark** | Compare model performance | `benchmark speed accuracy` |

### Tasks (https://docs.ultralytics.com/tasks/)

Different computer vision tasks supported.

| Task | Description | Query Keywords |
|------|-------------|----------------|
| **Detect** | Standard bounding box detection | `detect bbox yolov8 yolo11` |
| **Segment** | Instance segmentation with masks | `segment mask instance pixel` |
| **Classify** | Image classification | `classify classification cls` |
| **Pose** | Keypoint/pose estimation | `pose keypoint skeleton` |
| **OBB** | Oriented bounding boxes (rotated) | `obb oriented rotation angle dota` |

### Models (https://docs.ultralytics.com/models/)

Available model architectures.

| Model | Description | Query Keywords |
|-------|-------------|----------------|
| **Latest** | Query Context7 to determine | `latest YOLO model version current` |
| **YOLO-World** | Open-vocabulary detection | `yolo-world zero-shot text prompt` |
| **SAM** | Segment Anything integration | `sam segment anything prompt` |

**IMPORTANT**: Model versions change frequently. NEVER assume which version is "latest". Always query:
```
mcp__Context7__query-docs(libraryId="/websites/ultralytics", query="latest YOLO model available")
```

### Datasets (https://docs.ultralytics.com/datasets/)

Dataset formats and preparation.

| Topic | Description | Query Keywords |
|-------|-------------|----------------|
| **Format** | YOLO annotation format | `label format txt class x y w h` |
| **YAML** | Dataset configuration | `dataset yaml path train val names` |
| **Convert** | Format conversion utilities | `convert coco voc labelme` |
| **OBB Format** | Oriented bbox annotations | `obb format angle rotation dota` |

### Guides (https://docs.ultralytics.com/guides/)

Practical tutorials and tips.

| Topic | Description | Query Keywords |
|-------|-------------|----------------|
| **Hyperparameters** | Training configuration | `hyperparameter lr0 momentum warmup` |
| **Augmentation** | Data augmentation settings | `augment mosaic mixup hsv flip` |
| **Tips** | Training best practices | `tips tricks best practices` |
| **Deployment** | Production deployment | `deploy edge mobile cloud` |

### Reference (https://docs.ultralytics.com/reference/)

Python API documentation.

| Topic | Description | Query Keywords |
|-------|-------------|----------------|
| **YOLO Class** | Main model class | `YOLO class model load` |
| **Results** | Inference results handling | `results boxes masks probs` |
| **Callbacks** | Training callbacks | `callback on_train_start on_epoch_end` |
| **Settings** | Global configuration | `settings config yaml` |

## Query Strategy by Question Type

### "How do I train..." questions
```
Primary: /websites/ultralytics - "train [specific topic]"
Fallback: /ultralytics/ultralytics - "[topic] example code"
```

### "What parameters..." questions
```
Primary: /websites/ultralytics - "[mode] parameters arguments"
Fallback: /ultralytics/ultralytics - "[class] method signature"
```

### "Why is my model..." (debugging) questions
```
Primary: /websites/ultralytics - "[symptom] troubleshooting"
Secondary: /ultralytics/notebooks - "[task] tutorial"
```

### "How do I export..." questions
```
Primary: /websites/ultralytics - "export [format] deployment"
```

### OBB-specific questions (construction plans)
```
Primary: /websites/ultralytics - "OBB oriented bounding box [topic]"
Note: OBB is different from standard detection - always specify OBB in query
```

## Version Awareness

The documentation covers multiple YOLO versions. When answering:

1. **NEVER assume which version is latest** - always query Context7 first
2. **Query for current models**: `"latest YOLO model version available"`
3. **Check compatibility** - some features are version-specific
4. **Note differences** - API may vary between versions

This ensures answers remain accurate as Ultralytics releases new versions.
