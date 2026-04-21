import io
import logging
import numpy as np
from PIL import Image
from app.utils.image_utils import preprocess_image

logger = logging.getLogger(__name__)


class AgingService:
    """
    Phase 1: Scaffold with basic image processing placeholder.
    Phase 5: Will integrate pre-trained GAN aging model
             (SAM — Style-based Age Manipulation or HRFAE).
    """

    def __init__(self):
        self.model_loaded = False
        logger.info("AgingService initialized (Phase 1 — placeholder mode)")

    async def transform(self, image_bytes: bytes, target_age: int) -> bytes:
        """
        Apply age transformation to the image.
        Returns PNG-encoded result bytes.
        """
        img_array = preprocess_image(image_bytes)  # (H, W, C) BGR numpy array

        # Phase 1: return slightly modified image as placeholder
        # Phase 5: replace with GAN model inference
        result_img = self._placeholder_transform(img_array, target_age)

        pil_img = Image.fromarray(result_img)
        buf = io.BytesIO()
        pil_img.save(buf, format="PNG")
        buf.seek(0)
        return buf.read()

    def _placeholder_transform(self, img: np.ndarray, target_age: int) -> np.ndarray:
        """
        Placeholder: applies a mild brightness shift based on target age.
        Older age → slightly darker; younger → slightly brighter.
        Real GAN model replaces this in Phase 5.
        """
        factor = 1.0 + (target_age - 30) * 0.002  # very mild effect
        adjusted = np.clip(img.astype(np.float32) * factor, 0, 255).astype(np.uint8)
        return adjusted
