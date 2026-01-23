import json
from pathlib import Path
import cv2
import numpy as np

from .embedder import CalloutEmbedder


def main():
    base_dir = Path(__file__).parent.parent
    crops_dir = base_dir / "assets" / "reference_crops"
    output_dir = base_dir / "reference_embeddings"
    output_dir.mkdir(parents=True, exist_ok=True)

    png_files = sorted(crops_dir.glob("*.png"))
    if not png_files:
        print(f"No PNG files found in {crops_dir}")
        return

    print(f"Found {len(png_files)} reference crops")

    embedder = CalloutEmbedder()
    images = []
    filenames = []

    for png_path in png_files:
        image = cv2.imread(str(png_path))
        if image is None:
            print(f"Warning: Could not load {png_path.name}")
            continue
        images.append(image)
        filenames.append(png_path.name)

    print(f"Computing embeddings for {len(images)} images...")
    embeddings = embedder.embed_batch(images)

    embeddings_path = output_dir / "callout_embeddings.npy"
    np.save(embeddings_path, embeddings)
    print(f"Saved embeddings to {embeddings_path}")

    meta = {
        "files": filenames,
        "count": len(filenames),
        "embedding_dim": embeddings.shape[1] if embeddings.ndim > 1 else 384,
    }
    meta_path = output_dir / "callout_embeddings_meta.json"
    with open(meta_path, "w") as f:
        json.dump(meta, f, indent=2)
    print(f"Saved metadata to {meta_path}")

    print(f"Done! Embeddings shape: {embeddings.shape}")


if __name__ == "__main__":
    main()
