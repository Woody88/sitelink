#!/usr/bin/env python3
"""
Test script to verify the embedding + text validation approach correctly rejects false positives.

Known false positives from original callout-processor:
- crop_0111.png: "TRIGGER SIZE" text - NOT a callout
- crop_0155.png: Random structural lines - NOT a callout

These should be REJECTED by either:
1. Low embedding similarity (<0.75), OR
2. Invalid text pattern (e.g., "TRIGGER SIZE" is not a valid callout text)
"""

import sys
from pathlib import Path

import cv2
import numpy as np

sys.path.insert(0, str(Path(__file__).parent))

from src.embedder import CalloutEmbedder, load_reference_embeddings, compute_similarity
from src.detect import extract_text, is_valid_callout_text


def test_full_pipeline():
    base_dir = Path(__file__).parent
    ref_path = base_dir / "reference_embeddings" / "callout_embeddings.npy"

    if not ref_path.exists():
        print("ERROR: Reference embeddings not found. Run compute_embeddings.py first.")
        return False

    ref_embeddings = load_reference_embeddings(str(ref_path))
    print(f"Loaded {len(ref_embeddings)} reference embeddings\n")

    embedder = CalloutEmbedder()

    test_cases = [
        (Path("/home/woodson/Code/projects/sitelink/packages/callout-processor/output-debug-v3/sheet-3/crops/crop_0111.png"), False, "TRIGGER SIZE text"),
        (Path("/home/woodson/Code/projects/sitelink/packages/callout-processor/output-debug-v3/sheet-3/crops/crop_0155.png"), False, "Random lines"),
        (Path("/home/woodson/Code/projects/sitelink/packages/callout-processor/output-debug-v3/sheet-3/crops/crop_0020.png"), True, "Circle with 2"),
        (Path("/home/woodson/Code/projects/sitelink/packages/callout-processor/output-debug-v3/sheet-3/crops/crop_0022.png"), True, "Circle with 1"),
    ]

    threshold = 0.75
    results = []

    print("=" * 70)
    print("Testing FULL PIPELINE (Embedding + Text Validation)")
    print("=" * 70)

    for crop_path, should_accept, description in test_cases:
        if not crop_path.exists():
            print(f"Warning: {crop_path.name} not found, skipping")
            continue

        image = cv2.imread(str(crop_path))
        if image is None:
            print(f"Warning: Could not load {crop_path.name}")
            continue

        embedding = embedder.embed_image(image)
        similarities = compute_similarity(embedding, ref_embeddings)
        max_sim = float(np.max(similarities))

        text = extract_text(image)
        text_valid = is_valid_callout_text(text)

        passes_embedding = max_sim >= threshold
        passes_text = text_valid
        accepted = passes_embedding and passes_text

        correct = accepted == should_accept
        results.append(correct)

        status = "[PASS]" if correct else "[FAIL]"
        expected = "ACCEPT" if should_accept else "REJECT"
        actual = "ACCEPT" if accepted else "REJECT"

        print(f"\n{status} {description} ({crop_path.name})")
        print(f"  Similarity: {max_sim:.4f} ({'PASS' if passes_embedding else 'FAIL'} at {threshold})")
        print(f"  Text: '{text}' ({'VALID' if text_valid else 'INVALID'})")
        print(f"  Expected: {expected}, Actual: {actual}")

    print("\n" + "=" * 70)
    print("SUMMARY")
    print("=" * 70)

    correct_count = sum(results)
    total_count = len(results)

    print(f"Tests passed: {correct_count}/{total_count}")

    if correct_count == total_count:
        print("\n[PASS] All tests passed!")
        return True
    else:
        print("\n[FAIL] Some tests failed!")
        return False


if __name__ == "__main__":
    success = test_full_pipeline()
    sys.exit(0 if success else 1)
