"""
AgingService — Phase 5: Age-Invariant Recognition Pipeline.

Backends (auto-selected at startup):
  1. SAM (Style-based Age Manipulation, SIGGRAPH 2021)
       Condition: ai-service/sam/ repo exists AND
                  ai-service/pretrained_models/sam_ffhq_aging.pt exists
       Quality:   Photorealistic 256×256 output, identity-preserving
       Speed:     ~1 s/image on GPU, ~60-120 s/image on CPU
       Setup:     python scripts/setup_sam.py

  2. OpenCV effects (CPU-safe fallback)
       Always available, instant, no download
       Quality:   Artistic simulation (hair gray, skin texture)

Recognition (shared, both backends):
  ArcFace embedding comparison across all generated variants.
  Returns best match per suspect across all age deltas.
"""

import asyncio
import base64
import io
import json
import logging
import sys
import time
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageEnhance

logger = logging.getLogger(__name__)

# ── Paths ─────────────────────────────────────────────────────────────────────
_ROOT            = Path(__file__).parent.parent.parent   # ai-service/
SAM_DIR          = _ROOT / "sam"
SAM_CHECKPOINT   = _ROOT / "pretrained_models" / "sam_ffhq_aging.pt"
SHAPE_PREDICTOR  = _ROOT / "shape_predictor_68_face_landmarks.dat"
SUSPECTS_PATH    = _ROOT / "dataset" / "suspects.json"

TARGET_W, TARGET_H = 512, 640
SAM_BASELINE_AGE = 30   # assumed subject age when delta=0


def _sam_available() -> bool:
    return (SAM_DIR / "models" / "psp.py").exists() and SAM_CHECKPOINT.exists()


# ── Service ───────────────────────────────────────────────────────────────────

class AgingService:

    def __init__(self):
        self._backend     = "sam" if _sam_available() else "opencv"
        self._sam_loaded  = False
        self._net         = None
        self._sam_device  = "cpu"
        self._face_app    = None          # InsightFace, lazy-loaded
        self._suspects:   dict[str, dict]       = {}
        self._embeddings: dict[str, np.ndarray] = {}
        self._load_suspects()
        logger.info(
            "AgingService ready — backend=%s  suspects=%d  embeddings=%d",
            self._backend, len(self._suspects), len(self._embeddings),
        )

    # ── Suspect / embedding data ──────────────────────────────────────────────

    def _load_suspects(self) -> None:
        if not SUSPECTS_PATH.exists():
            logger.warning("suspects.json not found — recognition disabled")
            return
        with open(SUSPECTS_PATH, encoding="utf-8") as f:
            data = json.load(f)
        self._suspects = {s["id"]: s for s in data}
        for s in data:
            emb = s.get("embedding")
            if emb:
                self._embeddings[s["id"]] = np.array(emb, dtype=np.float32)

    # ── InsightFace (lazy) ────────────────────────────────────────────────────

    def _get_face_app(self):
        if self._face_app is None:
            try:
                from insightface.app import FaceAnalysis
                app = FaceAnalysis(name="buffalo_sc", providers=["CPUExecutionProvider"])
                app.prepare(ctx_id=-1, det_size=(640, 640))
                self._face_app = app
            except Exception as exc:
                logger.warning("InsightFace unavailable: %s", exc)
        return self._face_app

    # ── Image helpers ─────────────────────────────────────────────────────────

    @staticmethod
    def _decode_bgr(image_bytes: bytes) -> np.ndarray:
        arr = np.frombuffer(image_bytes, np.uint8)
        bgr = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if bgr is None:
            raise ValueError("Cannot decode image")
        return bgr

    @staticmethod
    def _encode_png(img_rgb: np.ndarray) -> bytes:
        ok, buf = cv2.imencode(".png", cv2.cvtColor(img_rgb, cv2.COLOR_RGB2BGR))
        if not ok:
            raise RuntimeError("PNG encode failed")
        return bytes(buf)

    # ─────────────────────────────────────────────────────────────────────────
    # BACKEND 1 — SAM (photorealistic aging)
    # ─────────────────────────────────────────────────────────────────────────

    def _load_sam_sync(self) -> None:
        """Load SAM model into memory. Blocks — call via asyncio.to_thread."""
        if self._sam_loaded:
            return

        # Add SAM repo to Python path so its internal imports work
        sam_str = str(SAM_DIR)
        if sam_str not in sys.path:
            sys.path.insert(0, sam_str)

        import torch
        from argparse import Namespace
        from models.psp import pSp   # from SAM repo

        device = "cuda" if torch.cuda.is_available() else "cpu"
        logger.info("Loading SAM model from %s on %s …", SAM_CHECKPOINT, device)
        t0 = time.time()

        # weights_only=False required: SAM checkpoint stores Python objects (Namespace,
        # dicts) not just tensors. PyTorch ≥ 2.4 changed the default to True which breaks this.
        ckpt = torch.load(str(SAM_CHECKPOINT), map_location="cpu", weights_only=False)

        # opts may be stored as a dict (normal) or already a Namespace (some builds)
        raw_opts = ckpt["opts"]
        if isinstance(raw_opts, Namespace):
            opts_dict = vars(raw_opts)
        else:
            opts_dict = dict(raw_opts)

        opts_dict["checkpoint_path"] = str(SAM_CHECKPOINT)
        opts_dict["device"]          = device
        opts = Namespace(**opts_dict)

        net = pSp(opts)
        net.eval()
        net.to(device)

        self._net        = net
        self._sam_device = device
        self._sam_opts   = opts
        self._sam_loaded = True
        logger.info("SAM loaded in %.1f s on %s", time.time() - t0, device)

    def _ffhq_align(self, pil_img: Image.Image) -> Image.Image | None:
        """
        FFHQ-style face alignment using dlib 68-point landmarks.
        Identical algorithm to SAM/scripts/align_all_parallel.py — this is
        what SAM was trained on, so it MUST match for good aging results.

        Returns 256×256 aligned PIL image, or None if dlib unavailable.
        """
        try:
            import dlib
            import scipy.ndimage
        except ImportError:
            logger.debug("dlib not installed — falling back to bbox crop")
            return None

        if not SHAPE_PREDICTOR.exists():
            logger.debug("shape_predictor not found — run setup_sam.py")
            return None

        try:
            detector  = dlib.get_frontal_face_detector()
            predictor = dlib.shape_predictor(str(SHAPE_PREDICTOR))

            img_np = np.array(pil_img.convert("RGB"))
            dets   = detector(img_np, 1)
            if not dets:
                logger.debug("dlib: no face detected")
                return None

            shape = predictor(img_np, dets[0])
            lm    = np.array([[p.x, p.y] for p in shape.parts()])  # (68, 2)

        except Exception as exc:
            logger.debug("dlib alignment failed: %s", exc)
            return None

        # ── Compute FFHQ-style oriented crop (from align_all_parallel.py) ──
        lm_eye_left    = lm[36:42]
        lm_eye_right   = lm[42:48]
        lm_mouth_outer = lm[48:60]

        eye_left     = np.mean(lm_eye_left,  axis=0)
        eye_right    = np.mean(lm_eye_right, axis=0)
        eye_avg      = (eye_left + eye_right) * 0.5
        eye_to_eye   = eye_right - eye_left
        mouth_avg    = (lm_mouth_outer[0] + lm_mouth_outer[6]) * 0.5
        eye_to_mouth = mouth_avg - eye_avg

        x  = eye_to_eye - np.flipud(eye_to_mouth) * [-1, 1]
        x /= np.hypot(*x)
        x *= max(np.hypot(*eye_to_eye) * 2.0, np.hypot(*eye_to_mouth) * 1.8)
        y  = np.flipud(x) * [-1, 1]
        c  = eye_avg + eye_to_mouth * 0.1

        quad  = np.stack([c - x - y, c - x + y, c + x + y, c + x - y])
        qsize = np.hypot(*x) * 2

        img            = pil_img.convert("RGB")
        output_size    = 256
        transform_size = 256

        shrink = int(np.floor(qsize / output_size * 0.5))
        if shrink > 1:
            rsize  = (int(np.rint(float(img.size[0]) / shrink)),
                      int(np.rint(float(img.size[1]) / shrink)))
            img    = img.resize(rsize, Image.LANCZOS)
            quad  /= shrink
            qsize /= shrink

        border = max(int(np.rint(qsize * 0.1)), 3)
        crop   = (int(np.floor(min(quad[:, 0]))), int(np.floor(min(quad[:, 1]))),
                  int(np.ceil(max(quad[:, 0]))),  int(np.ceil(max(quad[:, 1]))))
        crop   = (max(crop[0] - border, 0), max(crop[1] - border, 0),
                  min(crop[2] + border, img.size[0]), min(crop[3] + border, img.size[1]))
        if crop[2] - crop[0] < img.size[0] or crop[3] - crop[1] < img.size[1]:
            img   = img.crop(crop)
            quad -= crop[0:2]

        pad = (int(np.floor(min(quad[:, 0]))),  int(np.floor(min(quad[:, 1]))),
               int(np.ceil(max(quad[:, 0]))),   int(np.ceil(max(quad[:, 1]))))
        pad = (max(-pad[0] + border, 0), max(-pad[1] + border, 0),
               max(pad[2] - img.size[0] + border, 0), max(pad[3] - img.size[1] + border, 0))

        if max(pad) > border - 4:
            pad   = np.maximum(pad, int(np.rint(qsize * 0.3)))
            arr   = np.pad(np.float32(img),
                           ((pad[1], pad[3]), (pad[0], pad[2]), (0, 0)), 'reflect')
            h, w, _ = arr.shape
            yg, xg, _ = np.ogrid[:h, :w, :1]
            mask  = np.maximum(
                1.0 - np.minimum(np.float32(xg) / pad[0],  np.float32(w - 1 - xg) / pad[2]),
                1.0 - np.minimum(np.float32(yg) / pad[1],  np.float32(h - 1 - yg) / pad[3]),
            )
            blur  = qsize * 0.02
            arr  += (scipy.ndimage.gaussian_filter(arr, [blur, blur, 0]) - arr) * np.clip(mask * 3.0 + 1.0, 0.0, 1.0)
            arr  += (np.median(arr, axis=(0, 1)) - arr) * np.clip(mask, 0.0, 1.0)
            img   = Image.fromarray(np.uint8(np.clip(np.rint(arr), 0, 255)), 'RGB')
            quad += pad[:2]

        img = img.transform(
            (transform_size, transform_size),
            Image.QUAD,
            (quad + 0.5).flatten(),
            Image.BILINEAR,
        )
        if output_size < transform_size:
            img = img.resize((output_size, output_size), Image.LANCZOS)

        return img

    def _get_face_bbox(self, pil_img: Image.Image) -> tuple[int, int, int, int]:
        """Face bounding box (x1, y1, x2, y2) with padding. InsightFace → center-crop fallback."""
        app = self._get_face_app()
        if app is not None:
            try:
                bgr   = cv2.cvtColor(np.array(pil_img.convert("RGB")), cv2.COLOR_RGB2BGR)
                faces = app.get(bgr)
                if faces:
                    x1, y1, x2, y2 = faces[0].bbox.astype(int)
                    pad = int((x2 - x1) * 0.35)
                    h, w = bgr.shape[:2]
                    return (max(0, x1 - pad), max(0, y1 - pad),
                            min(w, x2 + pad), min(h, y2 + pad))
            except Exception as exc:
                logger.debug("Face bbox detection failed: %s", exc)

        w, h = pil_img.size
        cx, cy = w // 2, int(h * 0.42)
        half   = int(min(w, h) * 0.42)
        return (max(0, cx - half), max(0, cy - half),
                min(w, cx + half), min(h, cy + half))

    def _run_sam_sync(self, image_bytes: bytes, delta: int) -> bytes:
        """
        Correct SAM inference pipeline matching the official Colab notebook:
          1. FFHQ-align face (dlib 68-point) → 256×256  [critical for quality]
          2. ToTensor + Normalize + AgeTransformer → [4, 256, 256]
          3. SAM inference with resize=False → 1024×1024 output
          4. Resize 1024 → original face bbox dims
          5. Feather-blend back into original portrait
        """
        # Patches sys.path so SAM internal imports work
        self._load_sam_sync()

        import torch
        from PIL import ImageDraw, ImageFilter
        from torchvision import transforms
        from datasets.augmentations import AgeTransformer
        from utils.common import tensor2im

        # Decode original portrait
        bgr          = self._decode_bgr(image_bytes)
        original_pil = Image.fromarray(cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)).convert("RGB")

        # ── Step 1: FFHQ alignment (dlib) — what SAM was trained on ──────────
        aligned = self._ffhq_align(original_pil)
        align_method = "ffhq-dlib"
        if aligned is None:
            # Fallback: InsightFace bbox crop at 256×256
            x1, y1, x2, y2 = self._get_face_bbox(original_pil)
            aligned = original_pil.crop((x1, y1, x2, y2)).resize((256, 256), Image.LANCZOS)
            align_method = "insightface-bbox"
            logger.debug("FFHQ alignment unavailable — using InsightFace bbox crop")

        # ── Step 2: Preprocess exactly as in the Colab notebook ──────────────
        preprocess = transforms.Compose([
            transforms.Resize((256, 256)),
            transforms.ToTensor(),
            transforms.Normalize([0.5, 0.5, 0.5], [0.5, 0.5, 0.5]),
        ])
        tensor = preprocess(aligned)                                # [3, 256, 256]

        target_age      = int(np.clip(SAM_BASELINE_AGE + delta, 0, 100))
        tensor_with_age = AgeTransformer(target_age)(tensor)       # [4, 256, 256]

        # ── Step 3: SAM inference — resize=False → 1024×1024 (Colab setting) ─
        batch = tensor_with_age.unsqueeze(0).to(self._sam_device).float()
        with torch.no_grad():
            result = self._net(batch, randomize_noise=False, resize=False)  # [1, 3, 1024, 1024]

        aged_1024 = tensor2im(result[0])                           # PIL 1024×1024

        # ── Step 4: Paste aged face into original portrait at face bbox ───────
        x1, y1, x2, y2 = self._get_face_bbox(original_pil)
        face_w  = x2 - x1
        face_h  = y2 - y1
        aged_face = aged_1024.resize((face_w, face_h), Image.LANCZOS)

        feather_px = max(10, int(min(face_w, face_h) * 0.07))
        mask = Image.new("L", (face_w, face_h), 0)
        ImageDraw.Draw(mask).ellipse(
            [feather_px, feather_px, face_w - feather_px, face_h - feather_px],
            fill=255,
        )
        mask = mask.filter(ImageFilter.GaussianBlur(radius=feather_px))

        result_pil = original_pil.copy()
        result_pil.paste(aged_face, (x1, y1), mask=mask)
        result_pil = result_pil.resize((TARGET_W, TARGET_H), Image.LANCZOS)

        logger.info("SAM: delta=%+d  target_age=%d  align=%s  device=%s",
                    delta, target_age, align_method, self._sam_device)

        buf = io.BytesIO()
        result_pil.save(buf, format="PNG")
        return buf.getvalue()

    async def _generate_sam(self, image_bytes: bytes, age_steps: list[int]) -> list[dict]:
        variants = []
        for delta in age_steps:
            try:
                aged = await asyncio.to_thread(self._run_sam_sync, image_bytes, delta)
                b64  = base64.b64encode(aged).decode()
                logger.info("SAM: generated delta=%+d", delta)
            except Exception as exc:
                # Full traceback so we know exactly which line in SAM is failing
                logger.warning("SAM failed for delta=%+d — falling back to OpenCV", delta, exc_info=True)
                img_rgb = cv2.cvtColor(self._decode_bgr(image_bytes), cv2.COLOR_BGR2RGB)
                aged_rgb = self._apply_age_delta(img_rgb, delta)
                b64 = base64.b64encode(self._encode_png(aged_rgb)).decode()
            variants.append({"age_delta": delta, "image_b64": b64})
        return variants

    # ─────────────────────────────────────────────────────────────────────────
    # BACKEND 2 — OpenCV effects (CPU-safe fallback)
    # ─────────────────────────────────────────────────────────────────────────

    def _apply_age_delta(self, img_rgb: np.ndarray, delta: int) -> np.ndarray:
        """
        Apply aging/de-aging via OpenCV + NumPy.
        +delta = older (hair gray, wrinkle texture, saturation drop)
        -delta = younger (bilateral smooth, saturation boost, hair darken)
        """
        if delta == 0:
            return img_rgb.copy()

        h, w = img_rgb.shape[:2]
        # Scaled to /15 so max effect hits at delta=15 — fully visible within -20…+20 slider range
        factor = min(abs(delta) / 15.0, 1.0)
        result = img_rgb.astype(np.float32)

        if delta > 0:
            # 1. Hair graying — upper 45%, dark pixels → near-white gray (200)
            hh     = int(h * 0.45)
            hr     = result[:hh].astype(np.uint8)
            hr_hsv = cv2.cvtColor(cv2.cvtColor(hr, cv2.COLOR_RGB2BGR), cv2.COLOR_BGR2HSV).astype(np.float32)
            mask   = np.clip((140.0 - hr_hsv[:, :, 2]) / 140.0, 0, 1)
            hr_hsv[:, :, 1] *= (1 - factor * 0.95 * mask)          # full desaturation
            hr_hsv[:, :, 2]  = (
                hr_hsv[:, :, 2] * (1 - factor * 0.70 * mask)
                + 200.0 * (factor * 0.70 * mask)                    # toward white-gray
            )
            hr_out = cv2.cvtColor(
                cv2.cvtColor(np.clip(hr_hsv, 0, 255).astype(np.uint8), cv2.COLOR_HSV2BGR),
                cv2.COLOR_BGR2RGB,
            )
            result[:hh] = hr_out.astype(np.float32)

            # 2. Wrinkle simulation via stronger Difference-of-Gaussians
            gray = cv2.cvtColor(result.astype(np.uint8), cv2.COLOR_RGB2GRAY).astype(np.float32)
            dog  = cv2.GaussianBlur(gray, (3, 3), 0.8) - cv2.GaussianBlur(gray, (11, 11), 3.0)
            for c in range(3):
                result[:, :, c] = np.clip(result[:, :, c] + dog * factor * 0.70, 0, 255)

            # 3. Fine skin texture noise (aged skin grain)
            rng  = np.random.default_rng(seed=42)
            noise = rng.normal(0, factor * 5.0, result.shape).astype(np.float32)
            result = np.clip(result + noise, 0, 255)

            # 4. Eye area darkening — under-eye bags / crow's feet shadow
            ey1, ey2 = int(h * 0.28), int(h * 0.52)
            result[ey1:ey2] = np.clip(result[ey1:ey2] * (1 - factor * 0.15), 0, 255)

            # 5. Saturation reduction + strong warm shift
            bgr = cv2.cvtColor(result.astype(np.uint8), cv2.COLOR_RGB2BGR)
            hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV).astype(np.float32)
            hsv[:, :, 1] = np.clip(hsv[:, :, 1] * (1 - factor * 0.38), 0, 255)
            result = cv2.cvtColor(
                cv2.cvtColor(np.clip(hsv, 0, 255).astype(np.uint8), cv2.COLOR_HSV2BGR),
                cv2.COLOR_BGR2RGB,
            ).astype(np.float32)
            result[:, :, 0] = np.clip(result[:, :, 0] + factor * 18, 0, 255)   # R ↑ warm
            result[:, :, 2] = np.clip(result[:, :, 2] - factor * 12, 0, 255)   # B ↓ warm
            result = result * (1 - factor * 0.08) + 128.0 * (factor * 0.08)    # slight fade

        else:
            # 1. Strong bilateral smooth (youth = smooth skin)
            rad    = 9 + int(factor * 6)
            rad    = rad | 1   # ensure odd
            result = cv2.bilateralFilter(result.astype(np.uint8), rad, 95, 95).astype(np.float32)

            # 2. Saturation + brightness boost (youth = vibrant)
            bgr = cv2.cvtColor(result.astype(np.uint8), cv2.COLOR_RGB2BGR)
            hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV).astype(np.float32)
            hsv[:, :, 1] = np.clip(hsv[:, :, 1] * (1 + factor * 0.40), 0, 255)
            hsv[:, :, 2] = np.clip(hsv[:, :, 2] * (1 + factor * 0.15), 0, 255)
            result = cv2.cvtColor(
                cv2.cvtColor(np.clip(hsv, 0, 255).astype(np.uint8), cv2.COLOR_HSV2BGR),
                cv2.COLOR_BGR2RGB,
            ).astype(np.float32)

            # 3. Cool tone shift (youth = slightly cooler / bluer skin)
            result[:, :, 2] = np.clip(result[:, :, 2] + factor * 10, 0, 255)  # B ↑
            result[:, :, 0] = np.clip(result[:, :, 0] - factor * 8,  0, 255)  # R ↓

            # 4. Hair darkening — more pigment when young
            hh     = int(h * 0.45)
            hr     = result[:hh].astype(np.uint8)
            hr_hsv = cv2.cvtColor(cv2.cvtColor(hr, cv2.COLOR_RGB2BGR), cv2.COLOR_BGR2HSV).astype(np.float32)
            dmask  = np.clip((200.0 - hr_hsv[:, :, 2]) / 200.0, 0, 1)
            hr_hsv[:, :, 1] = np.clip(hr_hsv[:, :, 1] * (1 + factor * 0.60 * dmask), 0, 255)
            hr_hsv[:, :, 2] = np.clip(hr_hsv[:, :, 2] * (1 - factor * 0.25 * dmask), 0, 255)
            hr_out = cv2.cvtColor(
                cv2.cvtColor(np.clip(hr_hsv, 0, 255).astype(np.uint8), cv2.COLOR_HSV2BGR),
                cv2.COLOR_BGR2RGB,
            )
            result[:hh] = hr_out.astype(np.float32)

        return np.clip(result, 0, 255).astype(np.uint8)

    async def _generate_opencv(self, image_bytes: bytes, age_steps: list[int]) -> list[dict]:
        bgr     = self._decode_bgr(image_bytes)
        img_rgb = cv2.cvtColor(cv2.resize(bgr, (TARGET_W, TARGET_H)), cv2.COLOR_BGR2RGB)
        variants = []
        for delta in age_steps:
            aged = self._apply_age_delta(img_rgb, delta)
            b64  = base64.b64encode(self._encode_png(aged)).decode()
            variants.append({"age_delta": delta, "image_b64": b64})
        return variants

    # ─────────────────────────────────────────────────────────────────────────
    # Recognition (shared — ArcFace embeddings, both backends)
    # ─────────────────────────────────────────────────────────────────────────

    def _extract_embedding(self, image_bytes: bytes) -> np.ndarray | None:
        app = self._get_face_app()
        if app is None:
            return None
        try:
            arr  = np.frombuffer(image_bytes, np.uint8)
            bgr  = cv2.imdecode(arr, cv2.IMREAD_COLOR)
            if bgr is None:
                return None
            faces = app.get(bgr)
            return faces[0].normed_embedding.astype(np.float32) if faces else None
        except Exception as exc:
            logger.debug("Embedding extraction: %s", exc)
            return None

    @staticmethod
    def _cosine(a: np.ndarray, b: np.ndarray) -> float:
        return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-8))

    def _rank_suspects(self, emb: np.ndarray, top_n: int) -> list[dict]:
        if not self._embeddings:
            return []
        scored = [
            {"suspect_id": sid, "cosine": self._cosine(emb, stored)}
            for sid, stored in self._embeddings.items()
        ]
        scored.sort(key=lambda x: x["cosine"], reverse=True)
        return scored[:top_n]

    # ─────────────────────────────────────────────────────────────────────────
    # Public API
    # ─────────────────────────────────────────────────────────────────────────

    async def generate_variants(
        self, image_bytes: bytes, age_steps: list[int]
    ) -> list[dict]:
        """Generate [{age_delta, image_b64}] for each step using best available backend."""
        if self._backend == "sam":
            return await self._generate_sam(image_bytes, age_steps)
        return await self._generate_opencv(image_bytes, age_steps)

    async def recognize_variants(
        self,
        image_bytes: bytes,
        age_steps:   list[int],
        max_faces:   int   = 10,
        threshold:   float = 30.0,
    ) -> dict:
        """
        Generate age variants → run ArcFace recognition on each →
        return best match across all variants with per-variant breakdown.
        """
        t0       = time.time()
        variants = await self.generate_variants(image_bytes, age_steps)
        all_flat: list[dict] = []
        variants_out: list[dict] = []

        for v in variants:
            delta   = v["age_delta"]
            v_bytes = base64.b64decode(v["image_b64"])
            emb     = self._extract_embedding(v_bytes)

            v_matches: list[dict] = []
            if emb is not None:
                for item in self._rank_suspects(emb, top_n=max_faces):
                    pct = max(item["cosine"] * 100.0, 0.0)
                    if pct < threshold:
                        continue
                    suspect = self._suspects.get(item["suspect_id"], {})
                    m = {
                        "suspect_id":      item["suspect_id"],
                        "name":            suspect.get("name", "Unknown"),
                        "age":             suspect.get("age"),
                        "gender":          suspect.get("gender"),
                        "crime_type":      suspect.get("crime_type", "Unknown"),
                        "description":     suspect.get("description", ""),
                        "embedding_score": round(pct, 2),
                        "final_score":     round(pct, 2),
                        "confidence":      round(pct / 100, 4),
                        "source_variant":  f"{delta:+d}",
                    }
                    v_matches.append(m)
                    all_flat.append(m)

            variants_out.append({
                "age_delta":  delta,
                "image_b64":  v["image_b64"],
                "matches":    v_matches,
                "face_found": emb is not None,
            })

        # De-dup per suspect — keep best score across any variant
        best_by_id: dict[str, dict] = {}
        for m in all_flat:
            sid = m["suspect_id"]
            if sid not in best_by_id or m["final_score"] > best_by_id[sid]["final_score"]:
                best_by_id[sid] = m

        top = sorted(best_by_id.values(), key=lambda x: x["final_score"], reverse=True)
        best = top[0] if top else None

        logger.info(
            "Age-invariant recognition done in %.2f s — backend=%s  candidates=%d  variants=%d",
            time.time() - t0, self._backend, len(top), len(age_steps),
        )

        return {
            "variants":       variants_out,
            "best_match":     best,
            "source_variant": best["source_variant"] if best else None,
            "all_results":    top,
            "total":          len(top),
            "backend":        self._backend,
        }

    @property
    def status(self) -> dict:
        return {
            "backend":   self._backend,
            "sam_ready": self._sam_loaded,
            "sam_available": _sam_available(),
            "suspects":  len(self._suspects),
            "embeddings": len(self._embeddings),
        }
