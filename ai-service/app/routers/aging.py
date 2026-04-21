from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import Response
from app.services.aging_service import AgingService

router = APIRouter()
aging_service = AgingService()


@router.post("/apply")
async def apply_aging(
    image: UploadFile = File(...),
    target_age: int = Form(..., ge=5, le=100, description="Target age (5–100)"),
):
    """
    Apply GAN-based facial aging/de-aging transformation.
    Returns the transformed image as PNG bytes.
    """
    if image.content_type not in ("image/jpeg", "image/png", "image/webp"):
        raise HTTPException(status_code=400, detail="Unsupported image format.")

    image_bytes = await image.read()
    result_bytes = await aging_service.transform(image_bytes, target_age)

    return Response(content=result_bytes, media_type="image/png")
