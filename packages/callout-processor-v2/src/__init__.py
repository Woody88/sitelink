from .detector import detect_candidates, get_crop, Candidate
from .embedder import CalloutEmbedder, load_reference_embeddings, compute_similarity
from .detect import process_pdf, extract_text

__all__ = [
    "detect_candidates",
    "get_crop",
    "Candidate",
    "CalloutEmbedder",
    "load_reference_embeddings",
    "compute_similarity",
    "process_pdf",
    "extract_text",
]
