from typing import List
import numpy as np
import cv2
from transformers import AutoImageProcessor, AutoModel
import torch


class CalloutEmbedder:
    _instance = None
    _model = None
    _processor = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        if CalloutEmbedder._model is None:
            self._load_model()

    def _load_model(self):
        model_name = "facebook/dinov2-small"
        CalloutEmbedder._processor = AutoImageProcessor.from_pretrained(model_name)
        CalloutEmbedder._model = AutoModel.from_pretrained(model_name)
        CalloutEmbedder._model.eval()

    def _preprocess(self, image: np.ndarray) -> np.ndarray:
        rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        resized = cv2.resize(rgb, (224, 224), interpolation=cv2.INTER_AREA)
        return resized

    def embed_image(self, image: np.ndarray) -> np.ndarray:
        preprocessed = self._preprocess(image)
        inputs = self._processor(images=preprocessed, return_tensors="pt")

        with torch.no_grad():
            outputs = self._model(**inputs)

        embedding = outputs.last_hidden_state[:, 0].squeeze().numpy()
        normalized = embedding / np.linalg.norm(embedding)
        return normalized

    def embed_batch(self, images: List[np.ndarray]) -> np.ndarray:
        if not images:
            return np.array([])

        preprocessed = [self._preprocess(img) for img in images]
        inputs = self._processor(images=preprocessed, return_tensors="pt")

        with torch.no_grad():
            outputs = self._model(**inputs)

        embeddings = outputs.last_hidden_state[:, 0].numpy()
        norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
        normalized = embeddings / norms
        return normalized


def load_reference_embeddings(path: str) -> np.ndarray:
    return np.load(path)


def compute_similarity(
    query_embedding: np.ndarray, reference_embeddings: np.ndarray
) -> np.ndarray:
    query_norm = query_embedding / np.linalg.norm(query_embedding)

    if reference_embeddings.ndim == 1:
        reference_embeddings = reference_embeddings.reshape(1, -1)

    ref_norms = np.linalg.norm(reference_embeddings, axis=1, keepdims=True)
    ref_normalized = reference_embeddings / ref_norms

    similarities = np.dot(ref_normalized, query_norm)
    return similarities
