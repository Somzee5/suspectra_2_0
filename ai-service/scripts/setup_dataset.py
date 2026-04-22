"""
setup_dataset.py — One-time script to populate the Rekognition suspect collection.

Run once:
    cd ai-service
    python scripts/setup_dataset.py

What it does:
1. Creates the Rekognition collection if it doesn't exist
2. Fetches 15 synthetic suspect profiles (name + photo) from randomuser.me
3. Uploads each photo to S3
4. Indexes each face in Rekognition (ExternalImageId = suspect_001, etc.)
5. Writes suspects.json so the recognition service can map IDs to metadata

After running, restart the AI service so it reloads suspects.json.
"""

import os
import sys
import json
import time
import requests
import boto3
from pathlib import Path
from botocore.exceptions import ClientError
from dotenv import load_dotenv

# ── Config ────────────────────────────────────────────────────────────────────
ROOT = Path(__file__).parent.parent
load_dotenv(ROOT / ".env")

REGION     = os.getenv("AWS_REGION", "us-east-1")
KEY_ID     = os.getenv("AWS_ACCESS_KEY_ID")
SECRET     = os.getenv("AWS_SECRET_ACCESS_KEY")
BUCKET     = os.getenv("AWS_S3_BUCKET", "suspectra-facematch-somzee5")
COLLECTION = os.getenv("AWS_REKOGNITION_COLLECTION", "suspectra_collection")

IMG_DIR       = ROOT / "dataset" / "images"
SUSPECTS_FILE = ROOT / "dataset" / "suspects.json"
TOTAL         = 15   # bump to 50+ later for a richer demo

CRIME_TYPES = [
    "Armed Robbery", "Burglary", "Fraud", "Vehicle Theft",
    "Assault", "Drug Trafficking", "Cybercrime", "Kidnapping",
    "Extortion", "Counterfeiting", "Smuggling", "Vandalism",
    "Identity Theft", "Arson", "Organised Crime",
]

DESCRIPTIONS = [
    "Suspect linked to a series of armed robberies in the city centre. Last seen near the financial district.",
    "Wanted for repeated residential burglary. Known to operate in pairs.",
    "Accused of large-scale financial fraud targeting senior citizens.",
    "Suspected of orchestrating a vehicle theft ring operating across multiple districts.",
    "Charged with aggravated assault. Previous record includes petty theft.",
    "Under investigation for narcotics distribution. Associated with known syndicate.",
    "Wanted for ransomware attacks on municipal infrastructure.",
    "Suspect in a kidnapping case currently under investigation.",
    "Accused of running an extortion racket targeting local businesses.",
    "Implicated in currency counterfeiting operation.",
    "Under investigation for cross-border smuggling of prohibited goods.",
    "Repeat vandalism and property damage offences across commercial areas.",
    "Accused of identity theft targeting online banking customers.",
    "Wanted in connection with a warehouse arson incident causing major losses.",
    "Known associate of an organised crime network. Multiple pending warrants.",
]

# ── AWS clients ───────────────────────────────────────────────────────────────
rek = boto3.client("rekognition", region_name=REGION,
                   aws_access_key_id=KEY_ID, aws_secret_access_key=SECRET)
s3  = boto3.client("s3", region_name=REGION,
                   aws_access_key_id=KEY_ID, aws_secret_access_key=SECRET)


# ── Helpers ───────────────────────────────────────────────────────────────────
def ensure_collection():
    try:
        rek.describe_collection(CollectionId=COLLECTION)
        print(f"[✓] Collection '{COLLECTION}' already exists")
    except rek.exceptions.ResourceNotFoundException:
        rek.create_collection(CollectionId=COLLECTION)
        print(f"[+] Created collection '{COLLECTION}'")


def fetch_profiles(n: int) -> list[dict]:
    print(f"[→] Fetching {n} profiles from randomuser.me …")
    url = f"https://randomuser.me/api/?results={n}&inc=name,picture,dob,gender&nat=in,gb,us,au"
    resp = requests.get(url, timeout=15)
    resp.raise_for_status()
    return resp.json()["results"]


def download_image(url: str, dest: Path) -> bool:
    try:
        r = requests.get(url, timeout=10)
        r.raise_for_status()
        dest.write_bytes(r.content)
        return True
    except Exception as e:
        print(f"  [!] Download failed: {e}")
        return False


def upload_to_s3(local_path: Path, s3_key: str) -> bool:
    try:
        s3.upload_file(str(local_path), BUCKET, s3_key, ExtraArgs={"ContentType": "image/jpeg"})
        return True
    except ClientError as e:
        print(f"  [!] S3 upload failed: {e}")
        return False


def index_face(s3_key: str, external_id: str) -> str | None:
    try:
        resp = rek.index_faces(
            CollectionId=COLLECTION,
            Image={"S3Object": {"Bucket": BUCKET, "Name": s3_key}},
            ExternalImageId=external_id,
            DetectionAttributes=[],
            MaxFaces=1,
        )
        faces = resp.get("FaceRecords", [])
        if faces:
            return faces[0]["Face"]["FaceId"]
        print(f"  [!] No face detected in {s3_key}")
        return None
    except ClientError as e:
        print(f"  [!] Rekognition index failed: {e}")
        return None


# ── Main ──────────────────────────────────────────────────────────────────────
def extract_embedding(image_path: Path) -> list[float] | None:
    """Extract ArcFace embedding using InsightFace (CPU)."""
    try:
        import cv2
        import insightface
        from insightface.app import FaceAnalysis

        if not hasattr(extract_embedding, "_app"):
            print("  [→] Loading InsightFace ArcFace model (first time ~100 MB download)…")
            app = FaceAnalysis(name="buffalo_sc", providers=["CPUExecutionProvider"])
            app.prepare(ctx_id=-1, det_size=(640, 640))
            extract_embedding._app = app   # cache it

        img   = cv2.imread(str(image_path))
        faces = extract_embedding._app.get(img)
        if not faces:
            return None
        return faces[0].normed_embedding.tolist()
    except Exception as e:
        print(f"  [!] Embedding extraction failed: {e}")
        return None


def main():
    IMG_DIR.mkdir(parents=True, exist_ok=True)
    ensure_collection()

    profiles = fetch_profiles(TOTAL)
    suspects = []

    for i, profile in enumerate(profiles, start=1):
        sid         = f"suspect_{i:03d}"
        first       = profile["name"]["first"]
        last        = profile["name"]["last"]
        full_name   = f"{first} {last}"
        age         = profile["dob"]["age"]
        gender      = profile["gender"].title()
        photo_url   = profile["picture"]["large"]
        crime       = CRIME_TYPES[i - 1]
        description = DESCRIPTIONS[i - 1]
        s3_key      = f"suspects/{sid}.jpg"
        local_img   = IMG_DIR / f"{sid}.jpg"

        print(f"\n[{i:02d}/{TOTAL}] {full_name} — {crime}")

        if not download_image(photo_url, local_img):
            print("  [skip] Could not download image")
            continue

        if not upload_to_s3(local_img, s3_key):
            print("  [skip] Could not upload to S3")
            continue

        face_id = index_face(s3_key, sid)
        if not face_id:
            print("  [skip] Face not indexed in Rekognition")
            continue

        # ── Extract ArcFace embedding (Path B) ──
        embedding = extract_embedding(local_img)
        if embedding:
            print(f"  [✓] ArcFace embedding extracted ({len(embedding)}-dim)")
        else:
            print("  [!] Embedding skipped (no face detected by InsightFace)")

        suspects.append({
            "id":          sid,
            "name":        full_name,
            "age":         age,
            "gender":      gender,
            "crime_type":  crime,
            "description": description,
            "s3_key":      s3_key,
            "face_id":     face_id,
            "embedding":   embedding,   # None if not extracted
        })
        print(f"  [✓] Done — FaceId: {face_id[:8]}…")
        time.sleep(0.5)

    SUSPECTS_FILE.write_text(json.dumps(suspects, indent=2, ensure_ascii=False))
    print(f"\n✅  Done — {len(suspects)}/{TOTAL} suspects indexed")
    print(f"   suspects.json written to {SUSPECTS_FILE}")
    print("   Restart the AI service to reload the dataset.")


if __name__ == "__main__":
    if not KEY_ID or not SECRET:
        print("ERROR: AWS credentials not found. Copy .env.example → .env and fill in credentials.")
        sys.exit(1)
    main()
