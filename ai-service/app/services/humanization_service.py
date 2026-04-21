"""
Phase 3 — Sketch Humanization via Stable Diffusion + ControlNet

Pipeline:
  Sketch PNG  →  Canny edge map  →  ControlNet conditioning
                                   + SD v1.5 inference
                                   →  Photorealistic face PNG
"""
import io
import logging
import os
import time

import cv2
import numpy as np
import torch
from PIL import Image

logger = logging.getLogger(__name__)

# HuggingFace model IDs
SD_MODEL_ID      = os.getenv("SD_MODEL_ID",      "SG161222/Realistic_Vision_V5.1_noVAE")
CONTROLNET_ID    = os.getenv("CONTROLNET_ID",    "lllyasviel/sd-controlnet-canny")
MODEL_CACHE_DIR  = os.getenv("HF_HOME",          "./models")

# Forensic sketch generation prompts
POSITIVE_PROMPT = (
    "professional forensic composite portrait, photorealistic face, "
    "realistic skin texture, detailed eyes, sharp facial features, "
    "black and white police sketch photo, 8k, high detail"
)
NEGATIVE_PROMPT = (
    "cartoon, anime, painting, deformed, blurry, bad anatomy, "
    "extra limbs, ugly, mutation, low quality, worst quality, "
    "watermark, text, logo, artifact"
)

TARGET_W, TARGET_H = 512, 640    # SD-compatible, matches canvas ratio


class HumanizationService:
    """Lazy-loaded SD+ControlNet pipeline.  Model downloads on first request."""

    def __init__(self):
        self.pipe         = None
        self.device       = "cuda" if torch.cuda.is_available() else "cpu"
        self._model_ready = False
        logger.info("HumanizationService created — device: %s (model loads on first request)", self.device)

    # ── Model loading ─────────────────────────────────────────
    def _load_models(self):
        if self._model_ready:
            return

        logger.info("Loading ControlNet + Stable Diffusion models (first-run download may take several minutes)…")
        t0 = time.time()

        try:
            from diffusers import ControlNetModel, StableDiffusionControlNetPipeline
            from diffusers.schedulers import UniPCMultistepScheduler

            dtype = torch.float16 if self.device == "cuda" else torch.float32

            controlnet = ControlNetModel.from_pretrained(
                CONTROLNET_ID,
                torch_dtype=dtype,
                cache_dir=MODEL_CACHE_DIR,
            )

            self.pipe = StableDiffusionControlNetPipeline.from_pretrained(
                SD_MODEL_ID,
                controlnet=controlnet,
                torch_dtype=dtype,
                safety_checker=None,
                requires_safety_checker=False,
                cache_dir=MODEL_CACHE_DIR,
            )

            # Faster scheduler
            self.pipe.scheduler = UniPCMultistepScheduler.from_config(self.pipe.scheduler.config)

            if self.device == "cuda":
                self.pipe.to("cuda")
                try:
                    self.pipe.enable_xformers_memory_efficient_attention()
                    logger.info("xformers memory-efficient attention enabled")
                except Exception:
                    self.pipe.enable_attention_slicing()
            else:
                self.pipe.enable_attention_slicing()
                logger.warning("Running on CPU — generation will be slow (5-20 min per image)")

            self._model_ready = True
            logger.info("Models loaded in %.1f s", time.time() - t0)

        except Exception as e:
            logger.error("Failed to load models: %s", e)
            raise RuntimeError(f"Model loading failed: {e}") from e

    # ── Canny preprocessing ───────────────────────────────────
    def _make_canny_control_image(self, image_bytes: bytes) -> Image.Image:
        """Convert sketch PNG → canny edge map for ControlNet conditioning."""
        arr    = np.frombuffer(image_bytes, np.uint8)
        img    = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        img    = cv2.resize(img, (TARGET_W, TARGET_H), interpolation=cv2.INTER_AREA)

        gray   = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

        # CLAHE contrast enhancement before canny — improves edge extraction on light sketches
        clahe  = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        gray   = clahe.apply(gray)

        edges  = cv2.Canny(gray, low_threshold=50, high_threshold=150)
        edges_rgb = cv2.cvtColor(edges, cv2.COLOR_GRAY2RGB)
        return Image.fromarray(edges_rgb)

    # ── Main humanization ─────────────────────────────────────
    async def humanize(
        self,
        sketch_bytes: bytes,
        extra_prompt: str = "",
        steps: int = 25,
        guidance: float = 7.5,
        controlnet_scale: float = 0.85,
        seed: int = -1,
    ) -> bytes:
        """
        Run the full SD+ControlNet pipeline.
        Returns PNG bytes of the generated realistic face.
        """
        self._load_models()

        control_image = self._make_canny_control_image(sketch_bytes)

        prompt = POSITIVE_PROMPT
        if extra_prompt.strip():
            prompt = f"{extra_prompt.strip()}, {prompt}"

        generator = None
        if seed >= 0:
            generator = torch.Generator(device=self.device).manual_seed(seed)

        logger.info("Generating: steps=%d  guidance=%.1f  controlnet_scale=%.2f  device=%s",
                    steps, guidance, controlnet_scale, self.device)
        t0 = time.time()

        result = self.pipe(
            prompt=prompt,
            image=control_image,
            negative_prompt=NEGATIVE_PROMPT,
            num_inference_steps=steps,
            guidance_scale=guidance,
            controlnet_conditioning_scale=controlnet_scale,
            generator=generator,
            height=TARGET_H,
            width=TARGET_W,
        ).images[0]

        logger.info("Generation completed in %.1f s", time.time() - t0)

        buf = io.BytesIO()
        result.save(buf, format="PNG")
        buf.seek(0)
        return buf.read()

    # ── Canny preview (lightweight — no SD) ───────────────────
    async def canny_preview(self, sketch_bytes: bytes) -> bytes:
        """Return just the canny edge map — useful for debugging."""
        control_image = self._make_canny_control_image(sketch_bytes)
        buf = io.BytesIO()
        control_image.save(buf, format="PNG")
        buf.seek(0)
        return buf.read()

    @property
    def status(self) -> dict:
        return {
            "model_ready": self._model_ready,
            "device": self.device,
            "cuda_available": torch.cuda.is_available(),
            "sd_model": SD_MODEL_ID,
            "controlnet": CONTROLNET_ID,
        }
