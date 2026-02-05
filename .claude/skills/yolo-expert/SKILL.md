---
name: yolo-expert
description: Ultralytics YOLO expertise for training custom object detection models. This skill should be used when working with YOLO models, training on custom datasets, configuring hyperparameters, or deploying models. Specializes in construction plan symbol detection using OBB (oriented bounding boxes). CRITICAL - Always queries Context7 documentation before answering to prevent hallucination.
---

# YOLO Expert

## Overview

This skill provides verified Ultralytics YOLO expertise for training custom object detection models, specifically optimized for construction plan symbol detection. All technical answers MUST be verified against Context7 documentation.

## Anti-Hallucination Protocol

**CRITICAL**: Before answering ANY technical YOLO question:

1. Query Context7 with the appropriate library ID based on question type
2. Use the actual documentation response to inform the answer
3. If Context7 lacks the info, explicitly state uncertainty
4. **NEVER assume which YOLO version is "latest"** - always query Context7 to determine current models

### Discovering Current Models

When user asks about "latest YOLO" or doesn't specify a version:
```
mcp__Context7__query-docs(libraryId="/websites/ultralytics", query="latest YOLO model version current")
```

Use the response to determine what models are currently available and recommended.

### Context7 Library IDs

| Question Type | Library ID | Code Snippets |
|---------------|------------|---------------|
| **Primary** (modes, tasks, training) | `/websites/ultralytics` | 23,487 |
| **Python API** (code patterns) | `/ultralytics/ultralytics` | 5,623 |
| **Notebooks** (tutorials) | `/ultralytics/notebooks` | 371 |

### Query Patterns

```
# For training questions
mcp__Context7__query-docs(libraryId="/websites/ultralytics", query="train custom dataset YOLO format")

# For API questions
mcp__Context7__query-docs(libraryId="/ultralytics/ultralytics", query="model.train parameters epochs batch")

# For OBB/oriented detection
mcp__Context7__query-docs(libraryId="/websites/ultralytics", query="OBB oriented bounding box training")
```

## Ultralytics Doc Structure

Map questions to the correct documentation section:

| Section | Topics | Query Keywords |
|---------|--------|----------------|
| **Modes** | train, val, predict, export, track, benchmark | `mode train`, `validation`, `export onnx` |
| **Tasks** | detect, segment, classify, pose, obb | `task detect`, `OBB rotation`, `instance segmentation` |
| **Models** | YOLO11, YOLOv10, YOLOv9, YOLOv8, YOLO-World | `yolo11 architecture`, `model comparison` |
| **Datasets** | COCO, VOC, custom formats, annotation | `dataset yaml`, `annotation format`, `label format` |
| **Guides** | training tips, hyperparameters, augmentation | `hyperparameter tuning`, `data augmentation` |
| **Reference** | Python API, CLI args, settings | `YOLO class methods`, `CLI arguments` |

## Domain Context: Construction Plan Symbol Detection

This project trains YOLO models to detect symbols on construction/architectural plans.

### Key Characteristics

- **Rotated symbols**: Symbols appear at arbitrary angles (use OBB task, not standard detect)
- **Dense layouts**: Many small symbols close together
- **Variable scale**: Plans range from site-wide to detail views
- **Symbol types**: Electrical fixtures, plumbing, HVAC, structural elements, callouts

### Recommended Configuration

```yaml
# dataset.yaml for construction plan symbols
task: obb  # Oriented bounding boxes for rotated symbols
path: /path/to/dataset
train: images/train
val: images/val

names:
  0: electrical_outlet
  1: light_fixture
  2: switch
  # ... add symbol classes
```

### Training Considerations

1. **Image size**: Use higher `imgsz` (1280+) for small symbols on large plans
2. **Augmentation**: Be careful with heavy rotation augmentation - symbols already rotated
3. **Batch size**: Reduce for high-resolution images
4. **Mosaic**: May help with dense symbol layouts

## Common Workflows

### Training a Custom Model

Before providing training code, query Context7:
```
query: "train custom dataset YOLO OBB oriented bounding box epochs batch imgsz"
```

### Exporting for Deployment

Before providing export code, query Context7:
```
query: "export model ONNX TensorRT CoreML format"
```

### Hyperparameter Tuning

Before providing tuning advice, query Context7:
```
query: "hyperparameter tuning lr0 momentum weight_decay augmentation"
```

## Resources

### references/

- `ultralytics-doc-map.md` - Detailed mapping of documentation sections to query patterns
- `construction-plan-context.md` - Domain-specific knowledge for construction plan detection

## Usage Examples

**User**: "How do I train YOLO on my construction plan dataset?"

**Response pattern**:
1. Query Context7: `/websites/ultralytics` with "train custom dataset OBB format yaml"
2. Provide answer based on actual docs
3. Include construction-plan-specific recommendations (high imgsz, OBB task)

**User**: "What's the best image size for detecting small symbols?"

**Response pattern**:
1. Query Context7: `/websites/ultralytics` with "imgsz image size small objects detection"
2. Provide docs-verified answer
3. Add domain context: construction plans often need 1280+ for small symbols
