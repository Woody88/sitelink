# Sampling Strategies for Hard Example Extraction

This module implements diverse + uncertainty sampling to extract high-value false negatives for dataset augmentation.

## Overview

The sampling strategy combines four scoring dimensions to select 15-20 hard examples:

1. **Class Balance** (30%) - Prioritize underperforming classes
2. **Size Diversity** (30%) - Select mix of tiny/small/medium callouts
3. **Spatial Diversity** (20%) - Distribute across image regions
4. **Uncertainty** (20%) - Prefer FNs that were almost detected

## Quick Start

### Basic Usage

```python
from sampling_strategies import extract_hard_examples
from error_analysis import analyze_errors
import json

# 1. Run error analysis first
error_report = analyze_errors(validation_results, image_path, output_dir)

# 2. Configure sampling strategy
strategy = {
    'class_balance_weight': 0.3,
    'size_diversity_weight': 0.3,
    'spatial_diversity_weight': 0.2,
    'uncertainty_weight': 0.2
}

# 3. Extract hard examples
hard_examples = extract_hard_examples(
    error_report,
    strategy,
    max_samples=20
)

# 4. Use the results
print(f"Selected {len(hard_examples)} hard examples")
for ex in hard_examples[:5]:
    print(f"  {ex['class']} - score: {ex['selection_score']:.3f}")
```

### Command Line Interface

```bash
# Extract 20 hard examples with default weights
python sampling_strategies.py error_report.json --max-samples 20

# Customize sampling weights
python sampling_strategies.py error_report.json \
    --max-samples 15 \
    --class-weight 0.4 \
    --size-weight 0.3 \
    --spatial-weight 0.2 \
    --uncertainty-weight 0.1 \
    --output hard_examples.json
```

## Scoring Functions

### 1. Class Balance Score

Prioritizes classes with more false negatives to help balance the dataset.

```python
from sampling_strategies import class_balance_score

class_stats = {
    'detail': 15,      # Most FNs
    'elevation': 5,
    'title': 3
}

fn = {'class': 'detail', 'bbox': [10, 10, 50, 50]}
score = class_balance_score(fn, class_stats)
# Returns 0.652 (highest because detail has most FNs)
```

**Use case**: When one class is significantly underperforming, this ensures you collect more examples from that class.

### 2. Size Diversity Score

Encourages selection of callouts with varying sizes to avoid clustering.

```python
from sampling_strategies import size_diversity_score

fn = {'area': 1000, 'bbox': [10, 10, 50, 20]}
selected_sizes = [500, 5000]  # Already selected: one small, one large

score = size_diversity_score(fn, selected_sizes)
# Returns moderate score since 1000 is between 500 and 5000
```

**Use case**: Prevents selecting 15 tiny callouts or 15 large callouts - ensures coverage across the size spectrum.

### 3. Spatial Diversity Score

Distributes selections across different image regions.

```python
from sampling_strategies import spatial_diversity_score

fn = {'bbox': [800, 600, 50, 50]}  # Bottom-right area
selected_positions = [(100, 100), (200, 200)]  # Top-left area
image_dims = {'width': 1000, 'height': 800}

score = spatial_diversity_score(fn, selected_positions, image_dims)
# Returns high score (distant from selected positions)
```

**Use case**: Avoids spatial bias (e.g., only selecting edge callouts or only center callouts).

### 4. Uncertainty Score

Identifies FNs that were almost detected (high-confidence predictions nearby).

```python
from sampling_strategies import uncertainty_score

fn = {'bbox': [100, 100, 50, 50]}
predictions = [
    {'bbox': [110, 110, 45, 45], 'confidence': 0.85},  # Overlaps with FN
    {'bbox': [500, 500, 50, 50], 'confidence': 0.90}   # Far away
]

score = uncertainty_score(fn, predictions)
# Returns high score (first prediction overlaps with high confidence)
```

**Use case**: These are at the decision boundary - the model detected something but not the ground truth callout. Very valuable for training.

## Advanced Usage

### Stratified Sampling

Ensure minimum representation per class before diverse sampling:

```python
from sampling_strategies import stratified_sample_by_class, extract_hard_examples

# First, stratify by class (guarantees at least 1 per class)
candidates = [...all FNs...]
stratified = stratified_sample_by_class(
    candidates,
    max_samples=20,
    min_per_class=2  # At least 2 per class
)

# Then apply diverse sampling on stratified subset
error_report['false_negatives']['details']['by_size'] = {
    'all': stratified  # Override with stratified subset
}
hard_examples = extract_hard_examples(error_report, strategy, max_samples=20)
```

### Custom Weights

Adjust weights based on your use case:

```python
# Focus on class imbalance (e.g., detail class is severely underperforming)
strategy = {
    'class_balance_weight': 0.6,    # Emphasize class balance
    'size_diversity_weight': 0.2,
    'spatial_diversity_weight': 0.1,
    'uncertainty_weight': 0.1
}

# Focus on spatial coverage (e.g., edge callouts are missed)
strategy = {
    'class_balance_weight': 0.2,
    'size_diversity_weight': 0.2,
    'spatial_diversity_weight': 0.5,  # Emphasize spatial diversity
    'uncertainty_weight': 0.1
}

# Focus on uncertainty (e.g., refining decision boundaries)
strategy = {
    'class_balance_weight': 0.2,
    'size_diversity_weight': 0.2,
    'spatial_diversity_weight': 0.1,
    'uncertainty_weight': 0.5  # Emphasize uncertainty
}
```

### Weighted Random Sampling

Alternative to greedy selection - adds randomness:

```python
from sampling_strategies import weighted_sample

# Calculate weights for all candidates
candidates = [...]
weights = [
    calculate_combined_weight(cand, strategy)
    for cand in candidates
]

# Sample with probability proportional to weights
selected = weighted_sample(candidates, weights, max_samples=20)
```

## Integration with Active Learning Pipeline

### Complete Workflow

```python
# 1. Run validation
validation_results = run_validation(model, val_dataset)

# 2. Analyze errors
error_report = analyze_errors(
    validation_results,
    image_path='/path/to/val/image.png',
    output_dir='./analysis'
)

# 3. Extract hard examples
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

# 4. Extract crops for annotation
from error_analysis import extract_fn_crops
extract_fn_crops(
    error_report={'false_negatives': {'details': {'by_size': {'all': hard_examples}}}},
    output_dir='./crops',
    padding=50
)

# 5. Generate annotations for the selected examples
for ex in hard_examples:
    bbox = ex['bbox']
    crop_image = extract_crop_with_padding(image, bbox, padding=50)
    annotation = create_annotation(crop_image, bbox, ex['class'])
    save_annotation(annotation, f"fn_{ex['class']}_{idx}.json")

# 6. Add to training dataset
augmented_dataset = original_dataset + hard_examples
retrain_model(augmented_dataset)
```

### Iterative Active Learning

```python
# Iteration 1: Initial model
hard_examples_1 = extract_hard_examples(error_report_1, strategy, max_samples=20)
dataset_2 = dataset_1 + hard_examples_1
model_2 = train(dataset_2)

# Iteration 2: After adding hard examples
validation_results_2 = run_validation(model_2, val_dataset)
error_report_2 = analyze_errors(validation_results_2, ...)

# Adjust strategy based on iteration 1 results
if error_report_2['false_negatives']['by_class']['detail'] > 10:
    strategy['class_balance_weight'] = 0.5  # Focus more on class balance

hard_examples_2 = extract_hard_examples(error_report_2, strategy, max_samples=20)
dataset_3 = dataset_2 + hard_examples_2
model_3 = train(dataset_3)
```

## Output Format

Each selected hard example includes:

```json
{
  "bbox": [100, 100, 50, 50],
  "class": "detail",
  "area": 2500,
  "size_category": "small",
  "selection_score": 0.823,
  "aspect_ratio": 1.0,
  "contrast": 45.2
}
```

Fields:
- `bbox`: [x, y, w, h] in pixels
- `class`: One of "detail", "elevation", "title"
- `area`: Bbox area in pixels²
- `size_category`: "tiny" (<500), "small" (500-2000), "medium" (2000-10000), "large" (>10000)
- `selection_score`: Combined score from all dimensions (higher = more important)
- `aspect_ratio`: Width/height ratio
- `contrast`: Optional - standard deviation of pixel intensities in region

## Best Practices

### 1. Start with Balanced Weights

Use the default weights (0.3, 0.3, 0.2, 0.2) unless you have specific needs:

```python
strategy = {
    'class_balance_weight': 0.3,
    'size_diversity_weight': 0.3,
    'spatial_diversity_weight': 0.2,
    'uncertainty_weight': 0.2
}
```

### 2. Adjust Based on Error Analysis

Look at the error report first:

```python
fn_data = error_report['false_negatives']

# If one class dominates errors
if max(fn_data['by_class'].values()) > 2 * min(fn_data['by_class'].values()):
    strategy['class_balance_weight'] = 0.5  # Increase class focus

# If errors are concentrated in one size
size_dist = fn_data['by_size']
if max(size_dist.values()) > 0.5 * sum(size_dist.values()):
    strategy['size_diversity_weight'] = 0.4  # Increase size diversity

# If errors are concentrated in one region (check heatmap)
if fn_data['by_position']['edge'] > 0.7 * fn_data['total']:
    strategy['spatial_diversity_weight'] = 0.4  # Increase spatial diversity
```

### 3. Validate Selection Quality

After extraction, verify the selection is diverse:

```python
hard_examples = extract_hard_examples(error_report, strategy, max_samples=20)

# Check class distribution
from collections import Counter
class_counts = Counter(ex['class'] for ex in hard_examples)
print(f"Class distribution: {dict(class_counts)}")

# Check size distribution
size_counts = Counter(ex['size_category'] for ex in hard_examples)
print(f"Size distribution: {dict(size_counts)}")

# Check score range
scores = [ex['selection_score'] for ex in hard_examples]
print(f"Score range: {min(scores):.3f} - {max(scores):.3f}")
```

### 4. Iterate and Refine

Don't expect perfect results on the first try:

1. Extract 20 examples with default weights
2. Manually review the selection quality
3. Adjust weights if the selection is too clustered
4. Re-extract and compare
5. Use the best configuration for your dataset

## Troubleshooting

### Problem: All examples from one class

**Cause**: Class balance weight too high or one class has many more FNs.

**Solution**:
```python
# Use stratified sampling first
stratified = stratified_sample_by_class(candidates, max_samples=20, min_per_class=2)
# Then apply diverse sampling on stratified subset
```

### Problem: All examples are similar sizes

**Cause**: Size diversity weight too low or limited size variation in FNs.

**Solution**:
```python
strategy['size_diversity_weight'] = 0.5  # Increase from 0.3
```

### Problem: All examples from same image region

**Cause**: Spatial diversity weight too low or errors concentrated in one region.

**Solution**:
```python
strategy['spatial_diversity_weight'] = 0.4  # Increase from 0.2
```

### Problem: Selection scores are very similar

**Cause**: All FNs are similar quality or weights are not well-tuned.

**Solution**: Check error report statistics and adjust weights to emphasize the most important dimension for your use case.

## Performance Considerations

- **Time Complexity**: O(n² × k) where n = number of FNs, k = max_samples
  - For 100 FNs and max_samples=20: ~2000 score computations
- **Memory**: O(n) - stores all FN candidates in memory
- **Optimization**: For very large FN sets (>1000), consider:
  1. Pre-filtering by size/class to reduce n
  2. Using stratified sampling first
  3. Batching the selection process

## References

- **Diverse Sampling**: Reduces redundancy by maximizing dissimilarity
- **Uncertainty Sampling**: Selects examples near decision boundaries
- **Active Learning**: Iteratively improves model by adding informative examples

See `error_analysis.py` for FN categorization and `validation.py` for validation metrics.
