from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel
from typing import List
from app.services.recognition_service import RecognitionService
from app.utils.image_utils import read_image_bytes

router = APIRouter()
recognition_service = RecognitionService()


class MatchResult(BaseModel):
    criminal_profile_id: str
    similarity_score: float
    rank: int


class RecognitionResponse(BaseModel):
    matches: List[MatchResult]
    embedding_dim: int
    processing_time_ms: float


@router.post("/match", response_model=RecognitionResponse)
async def match_sketch(sketch: UploadFile = File(...)):
    """
    Accept a sketch image, extract CNN embeddings, compute cosine similarity
    against stored criminal profile embeddings, return ranked matches.
    """
    if sketch.content_type not in ("image/jpeg", "image/png", "image/webp"):
        raise HTTPException(status_code=400, detail="Unsupported image format. Use JPEG or PNG.")

    image_bytes = await sketch.read()
    result = await recognition_service.match(image_bytes)
    return result


@router.post("/embed")
async def extract_embedding(image: UploadFile = File(...)):
    """Return raw facial embedding vector for a given image."""
    image_bytes = await image.read()
    embedding = await recognition_service.extract_embedding(image_bytes)
    return {"embedding": embedding, "dim": len(embedding)}
