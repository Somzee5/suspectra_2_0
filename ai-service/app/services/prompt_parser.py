"""
Prompt Parser — converts natural language into sketch layer property changes.

Phase 3: structural edits (instant, no AI).
Phase 4: unrecognised instructions get forwarded to SD as img2img refinement.

Example:
  "make eyes bigger and nose wider"
  → [
      {"type": "eyes",  "changes": {"width": 312, "height": 96}},
      {"type": "nose",  "changes": {"width": 132}},
    ]
"""
import re
import logging
from typing import Any

logger = logging.getLogger(__name__)

# ── Keyword maps ──────────────────────────────────────────────

FEATURE_KEYWORDS: dict[str, str] = {
    "eye": "eyes", "eyes": "eyes",
    "eyebrow": "eyebrows", "eyebrows": "eyebrows", "brow": "eyebrows",
    "nose": "nose", "nostril": "nose",
    "lip": "lips", "lips": "lips", "mouth": "lips",
    "hair": "hair",
    "beard": "mustache", "mustache": "mustache", "facial hair": "mustache",
    "face": "face", "head": "face", "jaw": "face", "chin": "face",
}

SCALE_KEYWORDS: dict[str, float] = {
    "bigger": 1.25, "larger": 1.25, "wider": 1.2, "taller": 1.2,
    "huge": 1.5,  "much bigger": 1.5, "very big": 1.5,
    "smaller": 0.8, "shorter": 0.8, "narrower": 0.8,
    "tiny": 0.6, "much smaller": 0.6,
    "slightly bigger": 1.1, "slightly larger": 1.1,
    "slightly smaller": 0.9, "slightly narrower": 0.9,
}

WIDTH_ONLY  = {"wider", "narrower"}
HEIGHT_ONLY = {"taller", "shorter"}

OPACITY_KEYWORDS: dict[str, float] = {
    "faint": 0.4, "light": 0.6, "subtle": 0.7,
    "dark": 1.0,  "bold": 1.0, "strong": 1.0,
}

ROTATION_KEYWORDS: dict[str, float] = {
    "tilt left": -8, "tilt right": 8,
    "rotate left": -15, "rotate right": 15,
}

# ── Parser ────────────────────────────────────────────────────

def parse_prompt(prompt: str, current_layers: list[dict]) -> dict[str, Any]:
    """
    Parse a natural language prompt and return:
    {
        "layer_changes": [{"type": str, "changes": {prop: value}}, ...],
        "sd_prompt":     str | None,   # remainder forwarded to SD
        "actions":       [str],         # human-readable description
    }
    """
    text    = prompt.lower().strip()
    actions = []
    changes: list[dict] = []

    # Build a quick lookup of current layers by type
    layer_map = {l["type"]: l for l in current_layers}

    # ── Scale modifiers ───────────────────────────────────────
    for scale_kw, factor in SCALE_KEYWORDS.items():
        if scale_kw not in text:
            continue
        for feat_kw, feat_type in FEATURE_KEYWORDS.items():
            if feat_kw not in text:
                continue
            layer = layer_map.get(feat_type)
            if not layer:
                continue

            update: dict = {}
            if scale_kw in WIDTH_ONLY:
                update["width"] = max(20, round(layer["width"] * factor))
            elif scale_kw in HEIGHT_ONLY:
                update["height"] = max(20, round(layer["height"] * factor))
            else:
                update["width"]  = max(20, round(layer["width"]  * factor))
                update["height"] = max(20, round(layer["height"] * factor))

            if update:
                changes.append({"type": feat_type, "changes": update})
                actions.append(f"Scale {feat_type} {scale_kw} (×{factor})")

    # ── Opacity ───────────────────────────────────────────────
    for op_kw, opacity in OPACITY_KEYWORDS.items():
        if op_kw not in text:
            continue
        for feat_kw, feat_type in FEATURE_KEYWORDS.items():
            if feat_kw not in text:
                continue
            if layer_map.get(feat_type):
                changes.append({"type": feat_type, "changes": {"opacity": opacity}})
                actions.append(f"Set {feat_type} opacity to {int(opacity * 100)}%")

    # ── Rotation ──────────────────────────────────────────────
    for rot_kw, degrees in ROTATION_KEYWORDS.items():
        if rot_kw not in text:
            continue
        for feat_kw, feat_type in FEATURE_KEYWORDS.items():
            if feat_kw not in text:
                continue
            if layer_map.get(feat_type):
                changes.append({"type": feat_type, "changes": {"rotation": degrees}})
                actions.append(f"Rotate {feat_type} {degrees}°")

    # ── SD pass-through — instructions we couldn't parse structurally ──
    # Strip parsed keywords from text; remainder goes to SD
    sd_remainder = text
    for kw in list(SCALE_KEYWORDS) + list(OPACITY_KEYWORDS) + list(ROTATION_KEYWORDS) + list(FEATURE_KEYWORDS):
        sd_remainder = sd_remainder.replace(kw, "")
    sd_remainder = re.sub(r"\s+", " ", sd_remainder).strip(" ,and")

    sd_prompt = sd_remainder if len(sd_remainder) > 3 else None

    if not actions:
        logger.info("No structural changes parsed from prompt; full prompt forwarded to SD")
        sd_prompt = prompt    # forward everything to SD

    return {
        "layer_changes": changes,
        "sd_prompt": sd_prompt,
        "actions": actions,
    }
