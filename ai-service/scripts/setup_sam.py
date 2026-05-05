"""
SAM Setup Script — run this ONCE before starting the AI service.

Downloads:
  1. SAM repository (cloned into ai-service/sam/)
  2. sam_ffhq_aging.pt checkpoint (~500 MB, from Google Drive)
  3. shape_predictor_68_face_landmarks.dat (~100 MB, for face alignment)

Usage:
  cd ai-service
  python scripts/setup_sam.py

On GPU laptop — also install CUDA PyTorch + torchvision first:
  pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121
"""

import os
import subprocess
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).parent.parent  # ai-service/

SAM_DIR        = ROOT / "sam"
MODELS_DIR     = ROOT / "pretrained_models"
CHECKPOINT     = MODELS_DIR / "sam_ffhq_aging.pt"
SHAPE_PRED     = ROOT / "shape_predictor_68_face_landmarks.dat"

CHECKPOINT_GDRIVE_ID = "1XyumF6_fdAxFmxpFcmPf-q84LU_22EMC"
SHAPE_PRED_URL = (
    "https://github.com/italojs/facial-landmarks-recognition"
    "/raw/master/shape_predictor_68_face_landmarks.dat"
)


def run(cmd: str, check: bool = True) -> int:
    print(f"\n>> {cmd}")
    ret = subprocess.run(cmd, shell=True)
    if check and ret.returncode != 0:
        print(f"[ERROR] Command failed (exit {ret.returncode})")
        sys.exit(1)
    return ret.returncode


def step(msg: str):
    print(f"\n{'─'*60}\n  {msg}\n{'─'*60}")


def setup():
    print("=" * 60)
    print("  SAM (Style-based Age Manipulation) Setup")
    print("=" * 60)

    # ── 0. Install SAM runtime dependencies ────────────────────
    step("Step 0/4 — SAM runtime dependencies (lpips, ninja)")
    run("pip install lpips ninja -q")
    print("  ✓ lpips and ninja installed")

    # ── 1. Clone SAM repo ───────────────────────────────────────
    step("Step 1/4 — SAM repository")
    if SAM_DIR.exists() and (SAM_DIR / "models" / "psp.py").exists():
        print(f"  ✓ SAM repo already present at {SAM_DIR}")
    else:
        if SAM_DIR.exists():
            import shutil
            shutil.rmtree(SAM_DIR)
        print(f"  Cloning into {SAM_DIR} ...")
        run(f'git clone https://github.com/yuval-alaluf/SAM.git "{SAM_DIR}"')
        print("  ✓ SAM repo cloned")

    # ── 1b. Patch StyleGAN2 custom CUDA ops ────────────────────
    step("Step 1b/4 — patching StyleGAN2 CUDA ops (Windows/CPU compatibility)")
    import shutil as _shutil
    patches_dir = ROOT / "sam_patches"
    op_dir      = SAM_DIR / "models" / "stylegan2" / "op"
    if patches_dir.exists() and op_dir.exists():
        for fname in ("fused_act.py", "upfirdn2d.py"):
            src = patches_dir / fname
            dst = op_dir / fname
            if src.exists():
                _shutil.copy2(src, dst)
                print(f"  ✓ Patched {fname}")
    else:
        print(f"  [WARN] patches_dir={patches_dir} or op_dir={op_dir} missing — skipping patch")

    # ── 2. Download SAM checkpoint ──────────────────────────────
    step("Step 2/4 — SAM checkpoint (~500 MB)")
    MODELS_DIR.mkdir(exist_ok=True)

    if CHECKPOINT.exists() and CHECKPOINT.stat().st_size > 100_000_000:
        print(f"  ✓ Checkpoint already at {CHECKPOINT}")
    else:
        print("  Installing gdown ...")
        run("pip install gdown -q")
        print(f"  Downloading checkpoint to {CHECKPOINT} ...")
        run(
            f'gdown "https://drive.google.com/u/0/uc?id={CHECKPOINT_GDRIVE_ID}&export=download"'
            f' -O "{CHECKPOINT}"'
        )
        if not CHECKPOINT.exists() or CHECKPOINT.stat().st_size < 100_000_000:
            print("  [ERROR] Checkpoint download appears incomplete. Try manually:")
            print(f"  gdown https://drive.google.com/u/0/uc?id={CHECKPOINT_GDRIVE_ID} -O pretrained_models/sam_ffhq_aging.pt")
            sys.exit(1)
        print(f"  ✓ Checkpoint downloaded ({CHECKPOINT.stat().st_size // 1_000_000} MB)")

    # ── 3. Download dlib shape predictor ────────────────────────
    step("Step 3/4 — dlib shape predictor (~100 MB)")
    if SHAPE_PRED.exists() and SHAPE_PRED.stat().st_size > 50_000_000:
        print(f"  ✓ Shape predictor already at {SHAPE_PRED}")
    else:
        print(f"  Downloading from {SHAPE_PRED_URL} ...")
        print("  (this may take a minute) ...")
        try:
            urllib.request.urlretrieve(SHAPE_PRED_URL, str(SHAPE_PRED))
            print(f"  ✓ Shape predictor downloaded ({SHAPE_PRED.stat().st_size // 1_000_000} MB)")
        except Exception as exc:
            print(f"  [WARN] Download failed: {exc}")
            print("  SAM will still work using InsightFace for face detection instead.")

    # ── Summary ──────────────────────────────────────────────────
    print("\n" + "=" * 60)
    print("  Setup complete!")
    print("=" * 60)
    print(f"  SAM repo:      {SAM_DIR}")
    print(f"  Checkpoint:    {CHECKPOINT}")
    print(f"  Shape pred:    {SHAPE_PRED}")
    print()
    print("  Restart the AI service:")
    print("  uvicorn main:app --port 8001 --reload")
    print()
    print("  NOTE: GPU laptop needs PyTorch CUDA installed separately:")
    print("  pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121")
    print("=" * 60)


if __name__ == "__main__":
    setup()
