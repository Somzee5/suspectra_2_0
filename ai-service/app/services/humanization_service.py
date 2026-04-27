"""
Humanization Service — auto-selects backend based on available hardware/keys.

Backend priority:
  1. Replicate API   — if REPLICATE_API_KEY is set (cloud, no download)
  2. CUDA SD         — if NVIDIA GPU detected (downloads ~5 GB on first run, fast GPU inference)
  3. Local OpenCV    — always available, zero download, instant, CPU-safe fallback
"""
import asyncio
import io
import logging
import os
import time

import cv2
import numpy as np
from PIL import Image, ImageEnhance

logger = logging.getLogger(__name__)

TARGET_W, TARGET_H = 512, 640

_REPLICATE_MODEL = "jagilley/controlnet-canny:aff48af9c68d162388d230a2ab003f68d2638d88307bdaf1c2f1ac95079c9613"

_POSITIVE_PROMPT = (
    "professional forensic composite portrait, photorealistic face, "
    "realistic skin texture, detailed eyes, sharp facial features, 8k, high detail"
)
_NEGATIVE_PROMPT = (
    "cartoon, anime, painting, deformed, blurry, bad anatomy, "
    "extra limbs, ugly, mutation, low quality, watermark, text"
)


def _detect_backend() -> str:
    """Auto-detect the best available backend."""
    if os.getenv("REPLICATE_API_KEY", "").strip():
        return "replicate"
    try:
        import torch
        cuda_ok = torch.cuda.is_available()
        logger.info(
            "CUDA check — available=%s  torch.version.cuda=%s  device_count=%d",
            cuda_ok,
            getattr(torch.version, "cuda", "N/A"),
            torch.cuda.device_count() if cuda_ok else 0,
        )
        if cuda_ok:
            gpu_name = torch.cuda.get_device_name(0)
            vram_gb  = torch.cuda.get_device_properties(0).total_memory / 1e9
            logger.info("GPU: %s  VRAM: %.1f GB — SD+ControlNet backend selected", gpu_name, vram_gb)
            return "cuda"
        logger.warning(
            "CUDA not available — torch installed without GPU support? "
            "Run: pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121"
        )
    except ImportError:
        logger.warning("torch not installed — using local OpenCV backend")
    return "local"


class HumanizationService:

    def __init__(self):
        self._backend       = _detect_backend()
        self._replicate_key = os.getenv("REPLICATE_API_KEY", "").strip()
        self._sd_pipe       = None      # lazy-loaded SD pipeline (CUDA only)
        self._sd_ready      = False
        logger.info("HumanizationService — backend: %s", self._backend)

    # ── Public API ────────────────────────────────────────────

    async def humanize(
        self,
        sketch_bytes: bytes,
        extra_prompt: str = "",
        steps: int = 25,
        guidance: float = 7.5,
        controlnet_scale: float = 0.85,
        seed: int = -1,
    ) -> bytes:
        if self._backend == "replicate":
            try:
                return await self._humanize_replicate(
                    sketch_bytes, extra_prompt, steps, guidance, controlnet_scale, seed
                )
            except Exception as e:
                logger.warning("Replicate failed (%s), falling back to local", e)
        elif self._backend == "cuda":
            try:
                return await self._humanize_cuda(
                    sketch_bytes, extra_prompt, steps, guidance, controlnet_scale, seed
                )
            except Exception as e:
                logger.warning("CUDA SD failed — falling back to local", exc_info=True)

        return await self._humanize_local(sketch_bytes, extra_prompt)

    async def canny_preview(self, sketch_bytes: bytes) -> bytes:
        img = self._make_canny_pil(sketch_bytes)
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        buf.seek(0)
        return buf.read()

    @property
    def status(self) -> dict:
        if self._backend == "replicate":
            device, model, ctrl = "cloud", "replicate/controlnet-canny", "cloud"
        elif self._backend == "cuda":
            device = "cuda"
            model  = os.getenv("SD_MODEL_ID", "SG161222/Realistic_Vision_V5.1_noVAE")
            ctrl   = os.getenv("CONTROLNET_ID", "lllyasviel/sd-controlnet-canny")
        else:
            device, model, ctrl = "cpu", "local-opencv", "opencv"

        return {
            "model_ready":    self._sd_ready if self._backend == "cuda" else True,
            "device":         device,
            "cuda_available": self._backend == "cuda",
            "backend":        self._backend,
            "sd_model":       model,
            "controlnet":     ctrl,
        }

    # ── Backend 1: Replicate cloud ────────────────────────────

    async def _humanize_replicate(
        self, sketch_bytes, extra_prompt, steps, guidance, controlnet_scale, seed
    ) -> bytes:
        try:
            import replicate
        except ImportError:
            raise RuntimeError("replicate package not installed — run: pip install replicate")

        import httpx

        canny_buf = io.BytesIO()
        self._make_canny_pil(sketch_bytes).save(canny_buf, format="PNG")
        canny_buf.seek(0)

        prompt = f"{extra_prompt.strip()}, {_POSITIVE_PROMPT}" if extra_prompt.strip() else _POSITIVE_PROMPT
        inp = {
            "image": canny_buf,
            "prompt": prompt,
            "negative_prompt": _NEGATIVE_PROMPT,
            "num_inference_steps": steps,
            "guidance_scale": guidance,
            "controlnet_conditioning_scale": controlnet_scale,
        }
        if seed >= 0:
            inp["seed"] = seed

        logger.info("Calling Replicate ControlNet — steps=%d", steps)
        t0 = time.time()
        client = replicate.Client(api_token=self._replicate_key)
        output = await asyncio.to_thread(client.run, _REPLICATE_MODEL, input=inp)
        result_url = output[0] if isinstance(output, list) else str(output)
        logger.info("Replicate done in %.1f s", time.time() - t0)

        async with httpx.AsyncClient(timeout=30) as http:
            resp = await http.get(result_url)
            resp.raise_for_status()
        return resp.content

    # ── Backend 2: Local CUDA (SD+ControlNet) ─────────────────

    def _load_sd_models(self):
        """Lazy-load SD+ControlNet on first generate call. Downloads ~5 GB on first run."""
        if self._sd_ready:
            return

        import torch
        from diffusers import ControlNetModel, StableDiffusionControlNetPipeline
        from diffusers.schedulers import UniPCMultistepScheduler

        sd_model_id   = os.getenv("SD_MODEL_ID",   "SG161222/Realistic_Vision_V5.1_noVAE")
        controlnet_id = os.getenv("CONTROLNET_ID", "lllyasviel/sd-controlnet-canny")
        cache_dir     = os.getenv("HF_HOME", "./models")

        logger.info("Loading ControlNet + SD models (first run downloads ~5 GB)…")
        t0 = time.time()

        controlnet = ControlNetModel.from_pretrained(
            controlnet_id, torch_dtype=torch.float16, cache_dir=cache_dir
        )
        pipe = StableDiffusionControlNetPipeline.from_pretrained(
            sd_model_id,
            controlnet=controlnet,
            torch_dtype=torch.float16,
            safety_checker=None,
            requires_safety_checker=False,
            cache_dir=cache_dir,
        )
        pipe.scheduler = UniPCMultistepScheduler.from_config(pipe.scheduler.config)
        pipe.to("cuda")
        try:
            pipe.enable_xformers_memory_efficient_attention()
        except Exception:
            pipe.enable_attention_slicing()

        self._sd_pipe  = pipe
        self._sd_ready = True
        logger.info("SD models loaded in %.1f s", time.time() - t0)

    async def _humanize_cuda(
        self, sketch_bytes, extra_prompt, steps, guidance, controlnet_scale, seed
    ) -> bytes:
        import torch

        await asyncio.to_thread(self._load_sd_models)

        control_image = self._make_canny_pil(sketch_bytes)
        prompt = f"{extra_prompt.strip()}, {_POSITIVE_PROMPT}" if extra_prompt.strip() else _POSITIVE_PROMPT

        generator = torch.Generator(device="cuda").manual_seed(seed) if seed >= 0 else None

        logger.info("SD inference on CUDA — steps=%d guidance=%.1f controlnet=%.2f",
                    steps, guidance, controlnet_scale)
        t0 = time.time()

        result = await asyncio.to_thread(
            lambda: self._sd_pipe(
                prompt=prompt,
                image=control_image,
                negative_prompt=_NEGATIVE_PROMPT,
                num_inference_steps=steps,
                guidance_scale=guidance,
                controlnet_conditioning_scale=controlnet_scale,
                generator=generator,
                height=TARGET_H,
                width=TARGET_W,
            ).images[0]
        )

        logger.info("CUDA inference done in %.1f s", time.time() - t0)

        buf = io.BytesIO()
        result.save(buf, format="PNG")
        buf.seek(0)
        return buf.read()

    # ── Backend 3: Local OpenCV colorization ─────────────────

    async def _humanize_local(self, sketch_bytes: bytes, extra_prompt: str = "") -> bytes:
        """
        CPU-safe lightweight colorization. No models, no download.
        Takes pencil-on-paper composite → applies skin tone + portrait enhancement.
        """
        t0 = time.time()

        arr = np.frombuffer(sketch_bytes, np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if img is None:
            raise ValueError("Could not decode sketch image")
        img = cv2.resize(img, (TARGET_W, TARGET_H), interpolation=cv2.INTER_AREA)

        gray       = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY).astype(np.float32) / 255.0
        light_mask = gray
        dark_mask  = 1.0 - gray

        skin_bgr = np.array(self._parse_skin_tone(extra_prompt), dtype=np.float32) / 255.0

        result = np.zeros((TARGET_H, TARGET_W, 3), dtype=np.float32)
        for c in range(3):
            result[:, :, c] = (
                light_mask * skin_bgr[c]
                + dark_mask * (gray * 0.35)
            )

        result_u8 = (np.clip(result, 0, 1) * 255).astype(np.uint8)

        hsv = cv2.cvtColor(result_u8, cv2.COLOR_BGR2HSV)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        hsv[:, :, 2] = clahe.apply(hsv[:, :, 2])
        result_u8 = cv2.cvtColor(hsv, cv2.COLOR_HSV2BGR)

        result_u8 = cv2.bilateralFilter(result_u8, 9, 75, 75)

        pil = Image.fromarray(cv2.cvtColor(result_u8, cv2.COLOR_BGR2RGB))
        pil = ImageEnhance.Contrast(pil).enhance(1.35)
        pil = ImageEnhance.Color(pil).enhance(1.5)
        pil = ImageEnhance.Sharpness(pil).enhance(1.4)
        pil = ImageEnhance.Brightness(pil).enhance(1.05)

        final = self._apply_vignette(np.array(pil))

        logger.info("Local colorization done in %.2f s", time.time() - t0)

        buf = io.BytesIO()
        Image.fromarray(final).save(buf, format="PNG")
        buf.seek(0)
        return buf.read()

    # ── Shared helpers ────────────────────────────────────────

    def _make_canny_pil(self, sketch_bytes: bytes) -> Image.Image:
        arr  = np.frombuffer(sketch_bytes, np.uint8)
        img  = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        img  = cv2.resize(img, (TARGET_W, TARGET_H), interpolation=cv2.INTER_AREA)
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        gray  = clahe.apply(gray)
        edges = cv2.Canny(gray, 50, 150)
        return Image.fromarray(cv2.cvtColor(edges, cv2.COLOR_GRAY2RGB))

    def _parse_skin_tone(self, prompt: str) -> tuple[int, int, int]:
        """Return BGR skin-tone from prompt keywords."""
        p = prompt.lower()
        if any(x in p for x in ("very dark", "dark skin", "black skin", "ebony")):
            return (55, 85, 120)
        if any(x in p for x in ("brown skin", "dark complexion", "dark brown")):
            return (75, 115, 160)
        if any(x in p for x in ("olive", "tan", "medium skin", "golden", "caramel")):
            return (105, 145, 185)
        if any(x in p for x in ("light skin", "fair", "pale", "white skin")):
            return (185, 200, 225)
        return (130, 165, 200)   # default neutral warm

    def _apply_vignette(self, img_rgb: np.ndarray) -> np.ndarray:
        h, w = img_rgb.shape[:2]
        y = np.linspace(-1, 1, h)
        x = np.linspace(-1, 1, w)
        X, Y = np.meshgrid(x, y)
        mask = 1.0 - np.clip((X ** 2 + Y ** 2) * 0.35, 0, 0.45)
        return (img_rgb * mask[:, :, np.newaxis]).astype(np.uint8)
