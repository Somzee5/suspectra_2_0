import cv2
import numpy as np
import logging

logger = logging.getLogger(__name__)

TARGET_SIZE = (200, 200)


def read_image_bytes(image_bytes: bytes) -> np.ndarray:
    """Decode image bytes to BGR numpy array."""
    arr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Failed to decode image — invalid or corrupted file")
    return img


def preprocess_image(image_bytes: bytes) -> np.ndarray:
    """
    Full preprocessing pipeline:
    1. Decode to BGR numpy array
    2. Resize to TARGET_SIZE
    3. Apply CLAHE contrast enhancement
    4. Align to frontal orientation (placeholder — MTCNN in Phase 4)
    """
    img = read_image_bytes(image_bytes)
    img = cv2.resize(img, TARGET_SIZE, interpolation=cv2.INTER_AREA)
    img = _enhance_contrast(img)
    return img


def _enhance_contrast(img: np.ndarray) -> np.ndarray:
    """Apply CLAHE on L-channel in LAB color space for better edge visibility."""
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    l_channel, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    l_channel = clahe.apply(l_channel)
    enhanced = cv2.merge([l_channel, a, b])
    return cv2.cvtColor(enhanced, cv2.COLOR_LAB2BGR)


def image_to_grayscale(image_bytes: bytes) -> np.ndarray:
    """Convert image to normalized grayscale float array."""
    img = read_image_bytes(image_bytes)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    return gray.astype(np.float32) / 255.0
