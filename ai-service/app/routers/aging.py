import base64
import logging

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, Field

from app.services.aging_service import AgingService

logger = logging.getLogger(__name__)
router = APIRouter()

_svc: AgingService | None = None


def init_service() -> None:
    """Called from main.py lifespan — runs after logging is configured."""
    global _svc
    _svc = AgingService()


# ── Request schemas ───────────────────────────────────────────────────────────

class VariantsRequest(BaseModel):
    image_base64: str
    age_steps: list[int] = Field(default=[-20, -10, 0, 10, 20])


class RecognizeVariantsRequest(BaseModel):
    image_base64: str
    age_steps:    list[int] = Field(default=[-20, -10, 0, 10, 20])
    max_faces:    int        = Field(default=10, ge=1, le=20)
    threshold:    float      = Field(default=30.0, ge=0.0, le=100.0)


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/status")
async def aging_status():
    """Return which backend is active and whether SAM is loaded."""
    return _svc.status


@router.post("/variants")
async def generate_variants(body: VariantsRequest):
    """
    Generate age variants of the provided face image.
    Returns base64-encoded PNG per step — no recognition.
    Limit: 1-7 steps.
    """
    steps = body.age_steps
    if not steps or len(steps) > 7:
        raise HTTPException(status_code=400, detail="age_steps must contain 1–7 values")

    try:
        image_bytes = base64.b64decode(body.image_base64)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid base64 image")

    variants = await _svc.generate_variants(image_bytes, steps)
    return {"variants": variants, "count": len(variants)}


@router.post("/recognize-variants")
async def recognize_variants(body: RecognizeVariantsRequest):
    """
    Generate age variants AND run ArcFace embedding-based recognition on each.
    Returns variants with images + matches, plus the best match across all variants.
    Limit: 1-5 age steps (to keep inference time reasonable).
    """
    steps = body.age_steps
    if not steps or len(steps) > 5:
        raise HTTPException(status_code=400, detail="age_steps must contain 1–5 values")

    try:
        image_bytes = base64.b64decode(body.image_base64)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid base64 image")

    result = await _svc.recognize_variants(
        image_bytes, steps, body.max_faces, body.threshold
    )
    return result


@router.post("/apply")
async def apply_aging_legacy(
    image:      UploadFile = File(...),
    target_age: int        = Form(..., ge=5, le=100),
):
    """
    Legacy endpoint (backward compat): apply a single aging delta.
    target_age is treated as absolute age; delta = target_age - 30.
    """
    if image.content_type not in ("image/jpeg", "image/png", "image/webp"):
        raise HTTPException(status_code=400, detail="Unsupported image format")

    image_bytes = await image.read()
    delta       = target_age - 30   # 30 = arbitrary "neutral" age baseline

    variants    = await _svc.generate_variants(image_bytes, [delta])
    result_b64  = variants[0]["image_b64"]
    return Response(content=base64.b64decode(result_b64), media_type="image/png")
