# Visual Prompt Examples for YOLO-26E

This directory contains cropped reference images used as **visual prompts** for YOLO-26E's one-shot detection capability.

## Directory Structure

```
examples/
├── us/                 # United States standards
│   ├── ncs/           # National CAD Standard
│   │   ├── detail/    # Detail callouts (e.g., circles with numbers/letters)
│   │   ├── elevation/ # Elevation callouts (e.g., triangles with numbers)
│   │   ├── section/   # Section callouts (e.g., circles with section cuts)
│   │   └── title/     # Title blocks
│   └── csi/           # CSI MasterFormat
│       └── (same structure)
└── ca/                # Canadian standards
    ├── ncs/
    └── csi/
```

## What Images Are Needed

### Per Callout Type
- **3-5 crop images** representing typical variations
- Examples should show different:
  - Numbers/letters (1, 2, A, B, etc.)
  - Sizes (15-40px symbol diameter)
  - Line weights (thin vs thick)
  - Orientations (if applicable)

### Callout Types

#### 1. Detail Callouts
- **Symbol**: Circle with number/letter inside, usually with tail/leader line
- **Typical appearance**: `(1)`, `(2)`, `(A)`, `(3.1)`
- **Common variations**: Single circle, double circle, hexagon
- **Size**: 15-30px diameter

#### 2. Elevation Callouts
- **Symbol**: Triangle or arrow pointing up/down with number
- **Typical appearance**: `△1`, `▽2`, elevation markers
- **Common variations**: Filled vs outline, different arrow styles
- **Size**: 20-40px height

#### 3. Section Callouts
- **Symbol**: Circle with section cut line and number
- **Typical appearance**: Circle cut in half with reference numbers
- **Common variations**: Different cut directions, single vs double circles
- **Size**: 25-40px diameter

#### 4. Title Blocks (Future)
- **Symbol**: Rectangular frame with sheet number and title
- **Typical appearance**: Contains sheet number (A1, S3, etc.)
- **Size**: Variable (large, multi-line)

## Image Requirements

### Size and Cropping
- **Crop tightly** around the symbol with ~5px margin on all sides
- **Minimum size**: 15x15 pixels
- **Maximum size**: 100x100 pixels
- **Aspect ratio**: Approximately square (slight variations OK)

### Quality
- **Resolution**: Use plan native resolution (typically 72-300 DPI)
- **Format**: PNG with transparency preferred, or white background
- **Clarity**: Symbol should be clearly visible and crisp
- **Background**: Minimal surrounding context (just the symbol + small margin)

### Naming Convention
```
{callout_type}_{standard}_{number}.png

Examples:
- detail_ncs_01.png
- detail_ncs_02.png
- elevation_ncs_01.png
- section_csi_01.png
```

## Where to Source Images

### Available Plans in Repository
Check the following directories for PDF plans to extract crops from:
- `apps/sample-plan.pdf`
- `apps/RTA_DRAWINGS_VOL1_US_PLAN.pdf`
- `apps/RTA_DRAWRING_8_PAGE_PLAN.pdf`
- `apps/4-Structural-Drawings - 4pages.pdf`
- `ncs6_uds3_schedules.pdf`

### Extraction Process
1. Open PDF in a viewer that supports high-quality rendering
2. Zoom to 200-300% to get clear symbol view
3. Use screenshot tool to crop individual symbols
4. Save as PNG with the naming convention above
5. Verify crop is 15-100px and clearly shows the symbol

## Usage in YOLO-26E

These cropped images are passed to YOLO-26E as **visual prompts**:

```python
from ultralytics import YOLOE

model = YOLOE("yoloe26n-world.pt")

# One-shot detection with visual prompt
results = model.predict(
    source="plan_sheet.png",
    prompts=["examples/us/ncs/detail/detail_ncs_01.png"],
    conf=0.1
)
```

YOLO-26E will detect all instances that visually match the provided example crops.

## Next Steps

1. **Extract crops** from available PDF plans
2. **Organize** into appropriate directories (us/ncs/detail/, etc.)
3. **Validate** by running visual prompt detection
4. **Iterate** by adding more variations if recall is low
5. **Document** which plan and page each crop came from (optional but helpful)

## Notes

- Start with **US NCS** standards (most common in repository)
- Focus on **detail callouts** first (most frequent type)
- Add more variations if initial detection recall is < 70%
- Visual prompts work best with consistent symbol styles within a plan set
