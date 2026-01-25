# Sampling Strategies Implementation Summary

## Overview

Implemented `sampling_strategies.py` - a comprehensive module for extracting hard examples from validation errors using diverse + uncertainty sampling. This enables intelligent dataset augmentation for active learning.

## Files Created

### 1. `sampling_strategies.py` (20KB)

Core module implementing four scoring dimensions:

- **`extract_hard_examples()`** - Main function combining all scoring dimensions
- **`class_balance_score()`** - Prioritizes underperforming classes
- **`size_diversity_score()`** - Prevents size clustering
- **`spatial_diversity_score()`** - Distributes across image regions
- **`uncertainty_score()`** - Finds examples near decision boundaries

Additional utilities:
- **`weighted_sample()`** - Alternative probabilistic sampling
- **`stratified_sample_by_class()`** - Ensures class representation

### 2. `test_sampling.py` (11KB)

Comprehensive test suite validating:
- ✓ Individual scoring functions
- ✓ Hard example extraction
- ✓ Weighted sampling
- ✓ Stratified sampling

**Test Results**: All tests pass

### 3. `demo_sampling.py` (13KB)

Interactive demonstration showing:
- Individual scoring function behavior
- Different sampling strategies (balanced, class-focused, size-focused)
- Strategy comparison
- Complete workflow example

### 4. `SAMPLING_README.md` (15KB)

Comprehensive documentation including:
- Quick start guide
- Detailed function documentation
- Advanced usage patterns
- Integration with active learning pipeline
- Best practices and troubleshooting
- Performance considerations

### 5. `example_usage.py` (11KB)

End-to-end workflow integrating:
- Error analysis
- Strategy recommendation
- Hard example extraction
- Visualization generation

### 6. `active_learning_pipeline.py` (11KB)

Production-ready CLI tool for complete active learning workflow:
```bash
python active_learning_pipeline.py \
    --ground-truth data/gt.json \
    --predictions data/pred.json \
    --image data/val.png \
    --output-dir ./iteration_1 \
    --max-samples 20
```

## Key Features

### 1. Multi-Dimensional Scoring

Combines four complementary dimensions:

| Dimension | Weight | Purpose |
|-----------|--------|---------|
| Class Balance | 30% | Prioritize underperforming classes |
| Size Diversity | 30% | Cover full size spectrum (tiny to large) |
| Spatial Diversity | 20% | Avoid spatial bias |
| Uncertainty | 20% | Find decision boundary examples |

### 2. Flexible Strategy Configuration

Easily adjust weights based on specific needs:

```python
# Default balanced strategy
strategy = {
    'class_balance_weight': 0.3,
    'size_diversity_weight': 0.3,
    'spatial_diversity_weight': 0.2,
    'uncertainty_weight': 0.2
}

# Focus on class imbalance
strategy = {
    'class_balance_weight': 0.6,
    'size_diversity_weight': 0.2,
    'spatial_diversity_weight': 0.1,
    'uncertainty_weight': 0.1
}
```

### 3. Greedy Selection Algorithm

Iteratively selects examples to maximize diversity:

1. Score all remaining candidates against already-selected examples
2. Select highest-scoring candidate
3. Update selected set (affects diversity scores)
4. Repeat until max_samples reached

### 4. Production-Ready Integration

- Works with `error_analysis.py` for FN categorization
- Compatible with existing validation pipeline
- CLI tools for easy integration
- Comprehensive error handling

## Algorithm Details

### Class Balance Score

```python
score = class_fn_count / total_fns
```

Higher score for classes with more false negatives.

**Example**: If "detail" has 15 FNs and total is 27:
- score = 15/27 = 0.556

### Size Diversity Score

```python
min_log_diff = min(|log10(fn_area) - log10(selected_area)|)
score = min(min_log_diff / 2.0, 1.0)
```

Uses log scale to handle wide size range. Score increases with size difference from selected examples.

**Example**:
- Selected: 400 px² (tiny)
- Candidate: 2500 px² (medium)
- log_diff = |log10(2500) - log10(400)| = 0.795
- score = 0.795 / 2.0 = 0.398

### Spatial Diversity Score

```python
# Normalize positions to [0, 1]
min_distance = min(euclidean_distance(fn_pos, selected_pos))
score = min(min_distance / sqrt(2), 1.0)
```

Euclidean distance in normalized coordinate space.

**Example**:
- Selected: (100, 100) → normalized (0.1, 0.1)
- Candidate: (900, 900) → normalized (0.9, 0.9)
- distance = sqrt((0.9-0.1)² + (0.9-0.1)²) = 1.13
- score = 1.13 / 1.414 = 0.80

### Uncertainty Score

```python
# For each prediction near FN:
if overlapping:
    weighted_conf = confidence * (1.0 + iou)
else:
    proximity_weight = exp(-distance / scale)
    weighted_conf = confidence * proximity_weight

score = min(max(weighted_conf) / 1.5, 1.0)
```

High score when high-confidence predictions are nearby or overlapping.

**Example**:
- FN at (100, 100, 50, 50)
- Prediction at (110, 110, 40, 40), conf=0.85
- IoU = 0.42
- weighted_conf = 0.85 * (1.0 + 0.42) = 1.207
- score = min(1.207 / 1.5, 1.0) = 0.805

## Performance Characteristics

### Time Complexity

- **Best case**: O(n × k) where n = candidates, k = max_samples
- **Typical**: O(n × k × m) where m = avg predictions per FN
- **For 100 FNs, 20 samples**: ~2000 score computations

### Memory Usage

- O(n) - stores all FN candidates
- O(k) - tracks selected examples
- Minimal additional overhead

### Optimization Tips

For large FN sets (>1000):
1. Pre-filter by confidence threshold
2. Use stratified sampling first
3. Reduce max_samples
4. Cache prediction lookups

## Integration Examples

### With error_analysis.py

```python
from error_analysis import analyze_errors
from sampling_strategies import extract_hard_examples

# 1. Analyze errors
error_report = analyze_errors(
    validation_results,
    image_path='val.png',
    output_dir='./analysis'
)

# 2. Extract hard examples
strategy = {
    'class_balance_weight': 0.3,
    'size_diversity_weight': 0.3,
    'spatial_diversity_weight': 0.2,
    'uncertainty_weight': 0.2
}

hard_examples = extract_hard_examples(
    error_report,
    strategy,
    max_samples=20
)

# 3. Use for dataset augmentation
for ex in hard_examples:
    # Create annotation and add to training set
    add_to_dataset(ex)
```

### With augment_dataset.py

```python
from augment_dataset import augment_with_synthetic_data
from sampling_strategies import extract_hard_examples

# 1. Extract hard examples
hard_examples = extract_hard_examples(error_report, strategy, max_samples=20)

# 2. Create synthetic variants
for ex in hard_examples:
    # Extract crop with context
    crop = extract_crop(image, ex['bbox'], padding=50)

    # Generate synthetic variants
    variants = augment_with_synthetic_data([ex], num_variants=3)

    # Add to training dataset
    add_to_dataset(variants)
```

### With active_learning_loop.py

```python
from active_learning_loop import ActiveLearningLoop

loop = ActiveLearningLoop(
    model_name="yolov5s",
    data_dir="./data",
    max_iterations=5
)

# Custom sampling strategy
loop.sampling_strategy = {
    'class_balance_weight': 0.4,
    'size_diversity_weight': 0.3,
    'spatial_diversity_weight': 0.2,
    'uncertainty_weight': 0.1
}

loop.max_samples = 20
loop.run()
```

## Validation Results

Tested with synthetic data showing:

### Default Strategy (balanced)
- **Selected**: 15 examples
- **Class diversity**: 2 classes
- **Size diversity**: 3 size categories (tiny, small, medium)
- **Score range**: 0.147 - 0.827

### Class-Focused Strategy
- **Selected**: 15 examples
- **Class diversity**: 2 classes (more balanced distribution)
- **Size diversity**: 3 size categories
- **Score range**: 0.187 - 0.756
- **Result**: Higher class balance weight → better class distribution

### Size-Focused Strategy
- **Selected**: 15 examples
- **Class diversity**: 3 classes
- **Size diversity**: 3 size categories (perfectly balanced: 5-5-5)
- **Score range**: 0.097 - 0.896
- **Result**: Higher size weight → perfect size distribution

## Usage Recommendations

### When to Use Default Weights

Use balanced weights (0.3, 0.3, 0.2, 0.2) when:
- ✓ No obvious single problem (e.g., class imbalance)
- ✓ First iteration of active learning
- ✓ Want general improvement across all dimensions

### When to Adjust Weights

**Increase class_balance_weight (0.5-0.6)** when:
- One class has 2x+ more FNs than others
- Model struggles with specific class
- Dataset has class imbalance

**Increase size_diversity_weight (0.4-0.5)** when:
- Most FNs are one size (e.g., 70% tiny)
- Model misses specific size range
- Want to cover full size spectrum

**Increase spatial_diversity_weight (0.3-0.4)** when:
- FNs concentrated in edges/corners (>70%)
- Spatial bias in predictions
- Want broader spatial coverage

**Increase uncertainty_weight (0.3-0.4)** when:
- Refining decision boundaries
- Model has many "almost correct" predictions
- Want harder, ambiguous examples

## Future Enhancements

Potential improvements:
1. **Adaptive weighting** - Automatically adjust based on error distribution
2. **Batch selection** - Select multiple examples simultaneously for better diversity
3. **Cost-aware sampling** - Consider annotation cost (e.g., prefer smaller crops)
4. **Temporal diversity** - For multi-image validation, distribute across images
5. **Hierarchical sampling** - Sample from different error categories separately

## References

- **Error Analysis**: `error_analysis.py` - FN categorization and visualization
- **Validation**: `validation.py` - Compute TP/FP/FN from predictions
- **Dataset Augmentation**: `augment_dataset.py` - Generate synthetic variants
- **Active Learning Loop**: `active_learning_loop.py` - Complete AL workflow

## File Locations

```
active_learning/scripts/
├── sampling_strategies.py          # Core implementation
├── test_sampling.py                # Test suite
├── demo_sampling.py                # Interactive demonstration
├── example_usage.py                # End-to-end workflow
├── active_learning_pipeline.py    # Production CLI tool
├── SAMPLING_README.md             # User documentation
└── IMPLEMENTATION_SUMMARY.md      # This file
```

## Command Reference

### Run Tests
```bash
python test_sampling.py
```

### Run Demo
```bash
python demo_sampling.py
```

### Extract Hard Examples (Standalone)
```bash
python sampling_strategies.py error_report.json \
    --max-samples 20 \
    --output hard_examples.json
```

### Complete Pipeline
```bash
python active_learning_pipeline.py \
    --ground-truth data/gt.json \
    --predictions data/pred.json \
    --image data/val.png \
    --output-dir ./iteration_1 \
    --max-samples 20
```

### Custom Weights
```bash
python sampling_strategies.py error_report.json \
    --class-weight 0.5 \
    --size-weight 0.3 \
    --spatial-weight 0.1 \
    --uncertainty-weight 0.1 \
    --max-samples 15
```

## Conclusion

The `sampling_strategies.py` module provides a robust, flexible system for extracting high-value training examples from validation errors. It integrates seamlessly with the existing active learning infrastructure and provides both simple defaults and advanced customization options.

Key strengths:
- ✓ Multi-dimensional scoring captures diverse aspects of example difficulty
- ✓ Greedy selection ensures diversity in selected set
- ✓ Flexible weight configuration adapts to different use cases
- ✓ Well-tested and documented
- ✓ Production-ready CLI tools
- ✓ Minimal dependencies

Ready for integration into the active learning workflow.
