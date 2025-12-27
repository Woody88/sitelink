#!/usr/bin/env python3
"""
Image preprocessing utilities for Stage 1 detection
"""

import cv2
import numpy as np


def preprocess_tile(image):
    """
    Preprocess tile image for template matching

    Args:
        image: Input image (BGR or grayscale)

    Returns:
        Preprocessed grayscale image with enhanced contrast
    """
    # Convert to grayscale if needed
    if len(image.shape) == 3:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    else:
        gray = image.copy()

    # Apply CLAHE (Contrast Limited Adaptive Histogram Equalization)
    # This enhances local contrast and helps with varying lighting
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(gray)

    return enhanced


def load_template(template_path):
    """
    Load and preprocess a template image

    Args:
        template_path: Path to template PNG file

    Returns:
        Preprocessed grayscale template
    """
    template = cv2.imread(str(template_path), cv2.IMREAD_GRAYSCALE)
    if template is None:
        raise ValueError(f"Failed to load template: {template_path}")

    # Ensure template is binary (0 or 255)
    _, template = cv2.threshold(template, 127, 255, cv2.THRESH_BINARY)

    return template
