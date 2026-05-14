"""
enroll_demo_suspects.py — Add your friends' real photos as "demo suspects".

BEFORE RUNNING:
  1. Drop your friends' photos into  ai-service/dataset/demo_suspects/
     Name each file as:  firstname_lastname.jpg  (e.g.  soham_patil.jpg)
  2. Make sure suspects.json already exists (run setup_dataset.py first)

RUN:
    cd ai-service
    python scripts/enroll_demo_suspects.py

What it does:
- Reads every .jpg/.png from dataset/demo_suspects/
- Assigns each person a dramatic crime profile (for demo)
- Uploads photo to S3  →  indexes in Rekognition  →  appends to suspects.json
- Marks them with  "is_demo": true  so the UI can highlight "caught suspects"
"""

import os
import sys
import json
import time
import boto3
from pathlib import Path
from botocore.exceptions import ClientError
from dotenv import load_dotenv

ROOT = Path(__file__).parent.parent
load_dotenv(ROOT / ".env")

REGION     = os.getenv("AWS_REGION", "us-east-1")
KEY_ID     = os.getenv("AWS_ACCESS_KEY_ID")
SECRET     = os.getenv("AWS_SECRET_ACCESS_KEY")
BUCKET     = os.getenv("AWS_S3_BUCKET", "suspectra-facematch-somzee5")
COLLECTION = os.getenv("AWS_REKOGNITION_COLLECTION", "suspectra_collection")

DEMO_DIR      = ROOT / "dataset" / "demo_suspects"
SUSPECTS_FILE = ROOT / "dataset" / "suspects.json"

# ── Demo crime profiles — edit these to make the presentation more dramatic ──
# Keys match the filename stem (e.g.  soham_patil.jpg  →  key "soham_patil")
# If a photo isn't listed here, it gets a generic profile auto-assigned.
DEMO_PROFILES: dict[str, dict] = {
    "soham_patil": {
        "display_name": "Soham Patil",
        "age": 22,
        "gender": "Male",
        "crime_type": "Cybercrime",
        "description": (
            "Master hacker behind the 'Phantom Breach' — a coordinated cyberattack "
            "on three national banking networks. Evaded law enforcement for 18 months. "
            "Identified via forensic sketch submitted by a whistleblower."
        ),
    },
    "parag_yadav": {
        "display_name": "Parag Yadav",
        "age": 22,
        "gender": "Male",
        "crime_type": "Organised Crime",
        "description": (
            "Key operative in a cross-state organised crime syndicate. "
            "Wanted for extortion, illegal arms trade, and money laundering. "
            "Sketch match led to his identification after two years at large."
        ),
    },
    "swanand_mahabal": {
        "display_name": "Swanand Mahabal",
        "age": 22,
        "gender": "Male",
        "crime_type": "Bank Robbery",
        "description": (
            "Prime accused in the Sangli Central Bank heist — ₹4.2 crore stolen in broad daylight. "
            "Disguised identity foiled by Suspectra's sketch-to-face reconstruction. "
            "Apprehended within 72 hours of match."
        ),
    },
    "zaid_sharikmaslat": {
        "display_name": "Zaid Sharikmaslat",
        "age": 22,
        "gender": "Male",
        "crime_type": "Drug Trafficking",
        "description": (
            "Alleged kingpin of an international narcotics smuggling network. "
            "Operated under seven aliases. Sketch submitted by an informant enabled "
            "positive ID and subsequent arrest."
        ),
    },
    "faculty_sir": {
        "display_name": "Prof. R. Sharma",
        "age": 45,
        "gender": "Male",
        "crime_type": "Corporate Espionage",
        "description": (
            "High-profile suspect wanted for orchestrating a sophisticated academic data breach — "
            "leaking confidential research findings to rival institutions. "
            "Operated under the cover of a university position for over a decade. "
            "Identity confirmed via forensic sketch submitted by an anonymous informant. "
            "Apprehended live during field demonstration of the Suspectra system."
        ),
    },
    # Add more friends below — just copy the block and change the key + fields
    # "friend_name": {
    #     "display_name": "Friend Name",
    #     "age": 21,
    #     "gender": "Male",
    #     "crime_type": "Fraud",
    #     "description": "...",
    # },
}

GENERIC_CRIMES = [
    ("Armed Robbery",  "Suspect in a series of armed robberies. Identified through sketch reconstruction."),
    ("Fraud",          "Accused of large-scale financial fraud. Sketch match confirmed identity."),
    ("Kidnapping",     "Wanted for kidnapping. Forensic sketch submitted by a witness led to match."),
    ("Cybercrime",     "Under investigation for cybercrime. Identified via Suspectra sketch system."),
    ("Arson",          "Wanted in connection with arson attacks. Sketch match confirmed identity."),
]

# ── AWS clients ───────────────────────────────────────────────────────────────
rek = boto3.client("rekognition", region_name=REGION,
                   aws_access_key_id=KEY_ID, aws_secret_access_key=SECRET)
s3  = boto3.client("s3", region_name=REGION,
                   aws_access_key_id=KEY_ID, aws_secret_access_key=SECRET)


def upload_to_s3(local_path: Path, s3_key: str) -> bool:
    suffix = local_path.suffix.lower()
    ctype  = "image/jpeg" if suffix in (".jpg", ".jpeg") else "image/png"
    try:
        s3.upload_file(str(local_path), BUCKET, s3_key, ExtraArgs={"ContentType": ctype})
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
        print(f"  [!] No face detected in {s3_key} — make sure the photo is a clear frontal face")
        return None
    except ClientError as e:
        print(f"  [!] Rekognition index failed: {e}")
        return None


def extract_embedding(image_path: Path) -> list[float] | None:
    try:
        import cv2
        from insightface.app import FaceAnalysis

        if not hasattr(extract_embedding, "_app"):
            app = FaceAnalysis(name="buffalo_sc", providers=["CPUExecutionProvider"])
            app.prepare(ctx_id=-1, det_size=(640, 640))
            extract_embedding._app = app

        img   = cv2.imread(str(image_path))
        faces = extract_embedding._app.get(img)
        if not faces:
            return None
        return faces[0].normed_embedding.tolist()
    except Exception as e:
        print(f"  [!] Embedding extraction failed: {e}")
        return None


def next_demo_id(existing: list[dict]) -> str:
    demo_ids = [s["id"] for s in existing if s["id"].startswith("demo_")]
    if not demo_ids:
        return "demo_001"
    nums = [int(d.split("_")[1]) for d in demo_ids if d.split("_")[1].isdigit()]
    return f"demo_{(max(nums) + 1):03d}"


def main():
    if not DEMO_DIR.exists():
        DEMO_DIR.mkdir(parents=True)
        print(f"[+] Created {DEMO_DIR}")
        print("    Drop your friends' photos in there and re-run this script.")
        return

    photos = sorted(DEMO_DIR.glob("*.jpg")) + sorted(DEMO_DIR.glob("*.jpeg")) + sorted(DEMO_DIR.glob("*.png"))
    if not photos:
        print(f"[!] No images found in {DEMO_DIR}")
        print("    Add .jpg/.png files named  firstname_lastname.jpg  and re-run.")
        return

    # Load existing suspects.json
    if SUSPECTS_FILE.exists():
        existing: list[dict] = json.loads(SUSPECTS_FILE.read_text(encoding="utf-8"))
    else:
        existing = []

    already_enrolled = {s["id"] for s in existing}

    print(f"[→] Found {len(photos)} demo suspect photo(s)")
    import itertools
    generic_cycle = itertools.cycle(GENERIC_CRIMES)
    added = 0

    for photo in photos:
        stem    = photo.stem.lower().replace(" ", "_")
        profile = DEMO_PROFILES.get(stem)

        if profile:
            display_name = profile["display_name"]
            age          = profile["age"]
            gender       = profile["gender"]
            crime_type   = profile["crime_type"]
            description  = profile["description"]
        else:
            # Auto-generate from filename
            display_name = photo.stem.replace("_", " ").title()
            age          = 24
            gender       = "Unknown"
            crime_type, description = next(generic_cycle)

        # Derive stable ID from stem so re-running is idempotent
        sid = f"demo_{stem[:20]}"
        if sid in already_enrolled:
            print(f"[=] {display_name} already enrolled as {sid} — skipping")
            continue

        s3_key = f"suspects/demo/{photo.name}"
        print(f"\n[+] Enrolling: {display_name}  ({crime_type})")

        if not upload_to_s3(photo, s3_key):
            continue

        face_id = index_face(s3_key, sid)
        if not face_id:
            continue

        embedding = extract_embedding(photo)
        if embedding:
            print(f"  [✓] ArcFace embedding ({len(embedding)}-dim)")

        existing.append({
            "id":          sid,
            "name":        display_name,
            "age":         age,
            "gender":      gender,
            "crime_type":  crime_type,
            "description": description,
            "s3_key":      s3_key,
            "face_id":     face_id,
            "embedding":   embedding,
            "is_demo":     True,
        })
        already_enrolled.add(sid)
        added += 1
        print(f"  [✓] Done — FaceId: {face_id[:8]}… | ID: {sid}")
        time.sleep(0.3)

    SUSPECTS_FILE.write_text(json.dumps(existing, indent=2, ensure_ascii=False))
    print(f"\n✅  {added} demo suspect(s) enrolled — suspects.json updated")
    print("   Restart the AI service to reload the dataset.")


if __name__ == "__main__":
    if not KEY_ID or not SECRET:
        print("ERROR: AWS credentials not found. Copy .env.example → .env and fill in credentials.")
        sys.exit(1)
    main()
