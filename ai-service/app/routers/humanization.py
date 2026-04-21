import base64
import json
import logging

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel

from app.services.humanization_service import HumanizationService
from app.services.prompt_parser import parse_prompt

logger = logging.getLogger(__name__)
router = APIRouter()

# Singleton — model loads once, stays in memory
_svc = HumanizationService()


# ── Schema ────────────────────────────────────────────────────

class PromptParseRequest(BaseModel):
    prompt: str
    layers: list[dict]

class PromptParseResponse(BaseModel):
    layer_changes: list[dict]
    sd_prompt: str | None
    actions: list[str]

class HumanizeStatusResponse(BaseModel):
    model_ready: bool
    device: str
    cuda_available: bool
    sd_model: str
    controlnet: str


# ── Endpoints ─────────────────────────────────────────────────

@router.get("/status", response_model=HumanizeStatusResponse)
async def model_status():
    """Check if SD+ControlNet models are loaded and ready."""
    return _svc.status


@router.post("/parse-prompt", response_model=PromptParseResponse)
async def parse_structural_prompt(body: PromptParseRequest):
    """
    Parse a natural language prompt into layer property changes (instant).
    No AI — purely keyword-based structural edits.
    """
    result = parse_prompt(body.prompt, body.layers)
    return result


@router.post("/generate")
async def humanize_sketch(
    sketch: UploadFile = File(..., description="Exported sketch PNG from canvas"),
    prompt: str  = Form(default="", description="Optional descriptive prompt"),
    steps: int   = Form(default=25, ge=10, le=50),
    guidance: float = Form(default=7.5, ge=1.0, le=15.0),
    controlnet_scale: float = Form(default=0.85, ge=0.0, le=2.0),
    seed: int    = Form(default=-1, description="-1 for random"),
):
    """
    Main endpoint: sketch PNG → photorealistic face via SD+ControlNet.
    Returns generated PNG image.
    First call triggers model download (~4-7 GB).
    """
    if sketch.content_type not in ("image/png", "image/jpeg", "image/webp"):
        raise HTTPException(status_code=400, detail="Sketch must be PNG/JPEG/WEBP")

    sketch_bytes = await sketch.read()

    try:
        result_bytes = await _svc.humanize(
            sketch_bytes=sketch_bytes,
            extra_prompt=prompt,
            steps=steps,
            guidance=guidance,
            controlnet_scale=controlnet_scale,
            seed=seed,
        )
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))

    return Response(content=result_bytes, media_type="image/png")


@router.post("/generate-b64")
async def humanize_sketch_b64(
    sketch: UploadFile = File(...),
    prompt: str  = Form(default=""),
    steps: int   = Form(default=25, ge=10, le=50),
    guidance: float = Form(default=7.5),
    controlnet_scale: float = Form(default=0.85),
    seed: int    = Form(default=-1),
):
    """Same as /generate but returns base64 JSON — easier for frontend fetch."""
    if sketch.content_type not in ("image/png", "image/jpeg", "image/webp"):
        raise HTTPException(status_code=400, detail="Sketch must be PNG/JPEG/WEBP")

    sketch_bytes = await sketch.read()

    try:
        result_bytes = await _svc.humanize(
            sketch_bytes=sketch_bytes,
            extra_prompt=prompt,
            steps=steps,
            guidance=guidance,
            controlnet_scale=controlnet_scale,
            seed=seed,
        )
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))

    encoded = base64.b64encode(result_bytes).decode("utf-8")
    return {"image_b64": encoded, "mime": "image/png"}


@router.post("/canny-preview")
async def canny_preview(sketch: UploadFile = File(...)):
    """Return the canny edge map — debug/preview what ControlNet sees."""
    sketch_bytes = await sketch.read()
    result = await _svc.canny_preview(sketch_bytes)
    return Response(content=result, media_type="image/png")
