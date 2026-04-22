import base64
import logging
from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel
from typing import Optional
from app.services.recognition_service import RecognitionService

logger = logging.getLogger(__name__)
router = APIRouter()
recognition_service = RecognitionService()


class SearchByBase64Request(BaseModel):
    image_base64: str
    max_faces:    int = 10
    threshold:    float = 40.0


class SuspectMatch(BaseModel):
    suspect_id:      str
    name:            str
    age:             Optional[int]
    gender:          Optional[str]
    crime_type:      str
    description:     str
    image_url:       str
    aws_similarity:  float
    confidence:      float


class SearchResponse(BaseModel):
    matches:              list[SuspectMatch]
    total:                int
    query_s3_key:         Optional[str] = None
    processing_time_ms:   float
    error:                Optional[str] = None


@router.post("/search", response_model=SearchResponse)
async def search_by_base64(body: SearchByBase64Request):
    """
    Primary endpoint — accepts base64-encoded humanized face image.
    Called by the Spring Boot backend during a recognition run.
    """
    try:
        image_bytes = base64.b64decode(body.image_base64)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid base64 image data")

    result = await recognition_service.search(image_bytes, body.max_faces, body.threshold)
    return result


@router.post("/search-file", response_model=SearchResponse)
async def search_by_file(file: UploadFile = File(...)):
    """Upload a face image file directly for recognition."""
    if file.content_type not in ("image/jpeg", "image/png", "image/webp"):
        raise HTTPException(status_code=400, detail="Unsupported image format")
    image_bytes = await file.read()
    result = await recognition_service.search(image_bytes)
    return result


@router.get("/status")
async def recognition_status():
    """Check if the recognition service and AWS connection are healthy."""
    try:
        recognition_service.rek.describe_collection(
            CollectionId=recognition_service.collection
        )
        suspect_count = len(recognition_service._suspects)
        return {
            "status": "ok",
            "collection": recognition_service.collection,
            "suspects_loaded": suspect_count,
        }
    except Exception as exc:
        return {"status": "error", "detail": str(exc)}
