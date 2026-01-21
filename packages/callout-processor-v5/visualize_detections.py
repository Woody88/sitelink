#!/usr/bin/env python3
"""Visualize detection results by drawing bounding boxes on the image."""

import json
import sys
from PIL import Image, ImageDraw, ImageFont

def visualize_detections(image_path, results_json, output_path):
    """Draw detection bounding boxes on the image."""
    # Load image
    img = Image.open(image_path)
    draw = ImageDraw.Draw(img)

    # Load results
    with open(results_json, 'r') as f:
        results = json.load(f)

    # Color mapping for callout types
    colors = {
        'detail': 'blue',
        'elevation': 'green',
        'section': 'red',
        'title': 'orange'
    }

    # Draw each detection
    for det in results['detections']:
        bbox = det['bbox']  # [x, y, width, height]
        x, y, w, h = bbox

        # Convert to corner coordinates
        x1, y1 = x, y
        x2, y2 = x + w, y + h

        # Get color for this callout type
        color = colors.get(det['callout_type'], 'yellow')

        # Draw bounding box
        draw.rectangle([x1, y1, x2, y2], outline=color, width=3)

        # Draw label with confidence
        label = f"{det['callout_type']}: {det['confidence']:.3f}"

        # Draw label background
        try:
            font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 16)
        except:
            font = ImageFont.load_default()

        # Get text bounding box
        bbox_text = draw.textbbox((x1, y1 - 20), label, font=font)
        draw.rectangle(bbox_text, fill=color)
        draw.text((x1, y1 - 20), label, fill='white', font=font)

    # Save annotated image
    img.save(output_path)
    print(f"Saved annotated image to: {output_path}")
    print(f"Total detections: {len(results['detections'])}")

    # Print summary by callout type
    summary = {}
    for det in results['detections']:
        ct = det['callout_type']
        summary[ct] = summary.get(ct, 0) + 1

    print("\nDetection summary:")
    for ct, count in sorted(summary.items()):
        print(f"  {ct}: {count}")

if __name__ == '__main__':
    if len(sys.argv) != 4:
        print("Usage: python visualize_detections.py <image> <results.json> <output_image>")
        sys.exit(1)

    visualize_detections(sys.argv[1], sys.argv[2], sys.argv[3])
