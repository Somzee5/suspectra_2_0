import time
import numpy as np
import logging
from app.utils.image_utils import preprocess_image

logger = logging.getLogger(__name__)


class RecognitionService:
    """
    Phase 1: Scaffold with OpenCV preprocessing + placeholder embeddings.
    Phase 4: Will be replaced with real CNN (ArcFace / VGGFace2) embeddings
             and AWS Rekognition dual-pipeline matching.
    """

    def __init__(self):
        self.embedding_dim = 512
        logger.info("RecognitionService initialized (Phase 1 — placeholder mode)")

    async def extract_embedding(self, image_bytes: bytes) -> list[float]:
        """Extract facial embedding vector from image bytes."""
        img = preprocess_image(image_bytes)
        # Phase 1: random unit vector as placeholder embedding
        # Phase 4: replace with CNN forward pass
        raw = np.random.randn(self.embedding_dim).astype(np.float32)
        embedding = raw / (np.linalg.norm(raw) + 1e-8)
        return embedding.tolist()

    async def match(self, image_bytes: bytes) -> dict:
        """Match sketch against criminal profile embeddings."""
        start = time.perf_counter()

        embedding = await self.extract_embedding(image_bytes)

        # Phase 1: return empty matches (no criminal DB yet)
        # Phase 6: query PostgreSQL embeddings, compute cosine similarity, rank results
        matches: list[dict] = []

        elapsed_ms = (time.perf_counter() - start) * 1000
        logger.info("Recognition completed in %.2f ms — %d matches found", elapsed_ms, len(matches))

        return {
            "matches": matches,
            "embedding_dim": self.embedding_dim,
            "processing_time_ms": round(elapsed_ms, 2),
        }

    @staticmethod
    def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
        return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-8))
