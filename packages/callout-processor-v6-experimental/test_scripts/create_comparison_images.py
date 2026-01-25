#!/usr/bin/env python3
"""
Create side-by-side comparison images: Ground Truth | Model Output | Validation Result
"""
import cv2
import numpy as np
from pathlib import Path

def create_comparison(gt_path, model_path, result_path, output_path, title):
    """Create side-by-side comparison image."""

    gt = cv2.imread(gt_path)
    model = cv2.imread(model_path)
    result = cv2.imread(result_path)

    if gt is None or model is None or result is None:
        print(f"Error loading images for {title}")
        return

    # Resize all to same height
    h = min(gt.shape[0], model.shape[0], result.shape[0])
    gt = cv2.resize(gt, (int(gt.shape[1] * h / gt.shape[0]), h))
    model = cv2.resize(model, (int(model.shape[1] * h / model.shape[0]), h))
    result = cv2.resize(result, (int(result.shape[1] * h / result.shape[0]), h))

    # Add labels
    label_h = 50
    gt_labeled = np.zeros((h + label_h, gt.shape[1], 3), dtype=np.uint8)
    model_labeled = np.zeros((h + label_h, model.shape[1], 3), dtype=np.uint8)
    result_labeled = np.zeros((h + label_h, result.shape[1], 3), dtype=np.uint8)

    gt_labeled[label_h:] = gt
    model_labeled[label_h:] = model
    result_labeled[label_h:] = result

    # Add text labels
    cv2.putText(gt_labeled, "Ground Truth (Roboflow)", (10, 35),
                cv2.FONT_HERSHEY_SIMPLEX, 1.2, (255, 255, 255), 2)
    cv2.putText(model_labeled, "v5 Detections", (10, 35),
                cv2.FONT_HERSHEY_SIMPLEX, 1.2, (255, 255, 255), 2)
    cv2.putText(result_labeled, "Validation (TP/FP/FN)", (10, 35),
                cv2.FONT_HERSHEY_SIMPLEX, 1.2, (255, 255, 255), 2)

    # Concatenate horizontally
    comparison = np.hstack([gt_labeled, model_labeled, result_labeled])

    # Add title at top
    title_h = 60
    final = np.zeros((comparison.shape[0] + title_h, comparison.shape[1], 3), dtype=np.uint8)
    final[title_h:] = comparison

    cv2.putText(final, title, (10, 45),
                cv2.FONT_HERSHEY_SIMPLEX, 1.5, (255, 255, 255), 3)

    cv2.imwrite(output_path, final)
    print(f"Created {output_path}")

if __name__ == "__main__":
    create_comparison(
        "validation_page2_ground_truth.png",
        "test_v5_sahi_output/4page_canadian/page2_annotated.png",
        "validation_page2_result.png",
        "comparison_page2.png",
        "Page 2: Floor Plan - 96.7% Precision, 98.9% Recall"
    )

    create_comparison(
        "validation_page3_ground_truth.png",
        "test_v5_sahi_output/4page_canadian/page3_annotated.png",
        "validation_page3_result.png",
        "comparison_page3.png",
        "Page 3: Detail Sheet - 97.0% Precision, 91.4% Recall"
    )

    create_comparison(
        "validation_page4_ground_truth.png",
        "test_v5_sahi_output/4page_canadian/page4_annotated.png",
        "validation_page4_result.png",
        "comparison_page4.png",
        "Page 4: Mixed - 95.0% Precision, 95.0% Recall"
    )
