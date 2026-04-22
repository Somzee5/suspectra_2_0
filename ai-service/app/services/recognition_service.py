import time
import json
import logging
import os
import uuid
from pathlib import Path
from typing import Optional

import boto3
import numpy as np
from botocore.exceptions import ClientError

logger = logging.getLogger(__name__)

SUSPECTS_PATH = Path(__file__).parent.parent.parent / "dataset" / "suspects.json"

# Weights for hybrid scoring
AWS_WEIGHT       = 0.6
EMBEDDING_WEIGHT = 0.4


def _load_insightface():
    """Lazy-load InsightFace ArcFace model (downloads ~100 MB on first use)."""
    try:
        import insightface
        from insightface.app import FaceAnalysis
        app = FaceAnalysis(name="buffalo_sc", providers=["CPUExecutionProvider"])
        app.prepare(ctx_id=-1, det_size=(640, 640))
        logger.info("InsightFace ArcFace model loaded (CPU)")
        return app
    except Exception as exc:
        logger.warning("InsightFace not available — embedding path disabled: %s", exc)
        return None


class RecognitionService:
    """
    Hybrid face recognition:
      Path A — AWS Rekognition  (cloud, 60% weight)
      Path B — InsightFace ArcFace embeddings + cosine similarity  (local, 40% weight)
    final_score = 0.6 * AWS_similarity + 0.4 * (cosine * 100)
    """

    def __init__(self):
        region      = os.getenv("AWS_REGION", "us-east-1")
        key_id      = os.getenv("AWS_ACCESS_KEY_ID")
        secret      = os.getenv("AWS_SECRET_ACCESS_KEY")
        self.bucket     = os.getenv("AWS_S3_BUCKET", "suspectra-facematch-somzee5")
        self.collection = os.getenv("AWS_REKOGNITION_COLLECTION", "suspectra_collection")

        self.rek = boto3.client("rekognition", region_name=region,
                                aws_access_key_id=key_id, aws_secret_access_key=secret)
        self.s3  = boto3.client("s3", region_name=region,
                                aws_access_key_id=key_id, aws_secret_access_key=secret)

        self._suspects:   dict[str, dict]    = {}
        self._embeddings: dict[str, np.ndarray] = {}
        self._face_app = None   # loaded lazily on first use

        self._load_suspects()
        logger.info("RecognitionService ready — %d suspects loaded", len(self._suspects))

    # ── Loading ───────────────────────────────────────────────────────────────

    def _load_suspects(self) -> None:
        if not SUSPECTS_PATH.exists():
            logger.warning("suspects.json missing — run scripts/setup_dataset.py first")
            return
        with open(SUSPECTS_PATH, encoding="utf-8") as f:
            data = json.load(f)
        self._suspects = {s["id"]: s for s in data}
        # Pre-load ArcFace embeddings stored as lists in suspects.json
        for s in data:
            emb = s.get("embedding")
            if emb:
                self._embeddings[s["id"]] = np.array(emb, dtype=np.float32)
        logger.info("Loaded %d suspects, %d with embeddings", len(self._suspects), len(self._embeddings))

    def _get_face_app(self):
        if self._face_app is None:
            self._face_app = _load_insightface()
        return self._face_app

    # ── Helpers ───────────────────────────────────────────────────────────────

    def _presigned_url(self, s3_key: str, expiry: int = 3600) -> str:
        if not s3_key:
            return ""
        try:
            return self.s3.generate_presigned_url(
                "get_object",
                Params={"Bucket": self.bucket, "Key": s3_key},
                ExpiresIn=expiry,
            )
        except ClientError:
            return ""

    def _upload_query_image(self, image_bytes: bytes) -> str:
        key = f"searches/{uuid.uuid4()}.jpg"
        self.s3.put_object(Bucket=self.bucket, Key=key,
                           Body=image_bytes, ContentType="image/jpeg")
        return key

    @staticmethod
    def _cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
        denom = (np.linalg.norm(a) * np.linalg.norm(b)) + 1e-8
        return float(np.dot(a, b) / denom)

    # ── Path B: ArcFace embedding extraction ─────────────────────────────────

    def _extract_embedding(self, image_bytes: bytes) -> Optional[np.ndarray]:
        app = self._get_face_app()
        if app is None:
            return None
        try:
            import cv2
            nparr = np.frombuffer(image_bytes, np.uint8)
            img   = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            faces = app.get(img)
            if not faces:
                logger.debug("InsightFace: no face detected")
                return None
            emb = faces[0].normed_embedding
            return emb.astype(np.float32)
        except Exception as exc:
            logger.warning("Embedding extraction failed: %s", exc)
            return None

    def _embedding_matches(self, query_emb: np.ndarray, top_n: int = 10) -> list[dict]:
        """Rank all suspects by cosine similarity against the query embedding."""
        if not self._embeddings:
            return []
        scored = []
        for sid, emb in self._embeddings.items():
            sim = self._cosine_similarity(query_emb, emb)
            scored.append((sid, sim))
        scored.sort(key=lambda x: x[1], reverse=True)
        return [{"suspect_id": sid, "cosine": float(sim)} for sid, sim in scored[:top_n]]

    # ── Path A: AWS Rekognition ───────────────────────────────────────────────

    def _aws_matches(self, query_s3_key: str, max_faces: int, threshold: float) -> tuple[list[dict], Optional[str]]:
        """Returns (matches, error_msg)."""
        try:
            resp = self.rek.search_faces_by_image(
                CollectionId=self.collection,
                Image={"S3Object": {"Bucket": self.bucket, "Name": query_s3_key}},
                MaxFaces=max_faces,
                FaceMatchThreshold=threshold,
            )
            return [
                {
                    "suspect_id": fm["Face"].get("ExternalImageId", ""),
                    "aws_sim":    round(fm["Similarity"], 2),
                }
                for fm in resp.get("FaceMatches", [])
            ], None
        except self.rek.exceptions.InvalidParameterException:
            return [], "no_face"
        except ClientError as exc:
            logger.error("Rekognition error: %s", exc)
            return [], str(exc)

    # ── Public API ────────────────────────────────────────────────────────────

    async def search(self, image_bytes: bytes, max_faces: int = 10, threshold: float = 40.0) -> dict:
        start = time.perf_counter()

        # Upload query image to S3 (needed for Rekognition)
        try:
            query_s3_key = self._upload_query_image(image_bytes)
        except ClientError as exc:
            return {"matches": [], "total": 0, "error": f"S3 upload failed: {exc}"}

        # ── Path A: AWS Rekognition ──
        aws_results, aws_error = self._aws_matches(query_s3_key, max_faces, threshold)
        if aws_error == "no_face":
            return {
                "matches": [], "total": 0, "query_s3_key": query_s3_key,
                "error": "No face detected. Use the humanized (photorealistic) image, not the raw sketch.",
                "processing_time_ms": round((time.perf_counter() - start) * 1000, 2),
            }

        aws_by_id = {r["suspect_id"]: r["aws_sim"] for r in aws_results}

        # ── Path B: ArcFace embeddings ──
        query_emb     = self._extract_embedding(image_bytes)
        emb_by_id     = {}
        embedding_active = False
        if query_emb is not None and self._embeddings:
            embedding_active = True
            for item in self._embedding_matches(query_emb, top_n=max_faces * 2):
                emb_by_id[item["suspect_id"]] = item["cosine"]

        # ── Hybrid merge ──
        # Collect all candidate suspect IDs from both paths
        all_ids = set(aws_by_id) | set(emb_by_id)

        matches = []
        for sid in all_ids:
            aws_score = aws_by_id.get(sid, 0.0)
            cos_sim   = emb_by_id.get(sid, 0.0)
            cos_pct   = max(cos_sim * 100, 0.0)   # convert [-1,1] → [0,100]

            # Hybrid scoring — only blend when BOTH paths produced a score.
            # If ArcFace has no stored embedding for this suspect (cos_pct == 0),
            # use AWS score directly so a 100% AWS match isn't dragged down to 60%.
            if embedding_active and cos_pct > 0:
                final = (AWS_WEIGHT * aws_score) + (EMBEDDING_WEIGHT * cos_pct)
            else:
                final = aws_score   # AWS-only fallback

            # Skip if below threshold
            if final < threshold:
                continue

            suspect = self._suspects.get(sid, {})
            s3_key  = suspect.get("s3_key", "")

            matches.append({
                "suspect_id":      sid,
                "name":            suspect.get("name", "Unknown"),
                "age":             suspect.get("age"),
                "gender":          suspect.get("gender"),
                "crime_type":      suspect.get("crime_type", "Unknown"),
                "description":     suspect.get("description", ""),
                "image_url":       self._presigned_url(s3_key),
                "aws_similarity":  round(aws_score, 2),
                "embedding_score": round(cos_pct, 2),
                "final_score":     round(final, 2),
                "confidence":      round(final / 100, 4),
            })

        matches.sort(key=lambda x: x["final_score"], reverse=True)
        matches = matches[:max_faces]

        elapsed = round((time.perf_counter() - start) * 1000, 2)
        logger.info("Hybrid recognition done in %.2f ms — %d matches (AWS=%d, emb=%s)",
                    elapsed, len(matches), len(aws_results),
                    "on" if embedding_active else "off")

        return {
            "matches":             matches,
            "total":               len(matches),
            "query_s3_key":        query_s3_key,
            "embedding_active":    embedding_active,
            "processing_time_ms":  elapsed,
        }
