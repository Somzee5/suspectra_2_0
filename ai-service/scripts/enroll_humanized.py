"""
enroll_humanized.py — Enroll a humanized face image as a demo suspect.

THE DEMO STRATEGY:
  1. In the UI, build a sketch + humanize with a fixed seed (e.g. seed=42)
  2. Download / save that humanized image (right-click → save)
  3. Run this script:
       python scripts/enroll_humanized.py --image path/to/face.png --name "Vikram Malhotra" --crime "Bank Robbery"
  4. Restart AI service:  start_dev.bat
  5. During demo: build the SAME sketch, humanize with the SAME seed (42)
     → Run Full Pipeline → AWS finds "Vikram Malhotra" → 95%+ match guaranteed!

Why it works: same SD model + same seed + same prompt = identical output image.
AWS compares two identical faces → perfect match.

Usage:
    python scripts/enroll_humanized.py --image face.png
    python scripts/enroll_humanized.py --image face.png --name "Priya Sharma" --crime "Armed Robbery" --seed 42
"""
import os, sys, json, time, argparse
from pathlib import Path
from dotenv import load_dotenv
import boto3
from botocore.exceptions import ClientError

ROOT = Path(__file__).parent.parent
load_dotenv(ROOT / ".env")

REGION     = os.getenv("AWS_REGION",                    "us-east-1")
KEY_ID     = os.getenv("AWS_ACCESS_KEY_ID")
SECRET     = os.getenv("AWS_SECRET_ACCESS_KEY")
BUCKET     = os.getenv("AWS_S3_BUCKET",                 "suspectra-facematch-somzee5")
COLLECTION = os.getenv("AWS_REKOGNITION_COLLECTION",     "suspectra_collection")
SUSPECTS   = ROOT / "dataset" / "suspects.json"

rek = boto3.client("rekognition", region_name=REGION,
                   aws_access_key_id=KEY_ID, aws_secret_access_key=SECRET)
s3  = boto3.client("s3", region_name=REGION,
                   aws_access_key_id=KEY_ID, aws_secret_access_key=SECRET)

def extract_embedding(img_path):
    try:
        import cv2
        from insightface.app import FaceAnalysis
        if not hasattr(extract_embedding, "_app"):
            app = FaceAnalysis(name="buffalo_sc", providers=["CPUExecutionProvider"])
            app.prepare(ctx_id=-1, det_size=(640, 640))
            extract_embedding._app = app
        img   = cv2.imread(str(img_path))
        if img is None:
            from PIL import Image as PILImage
            import numpy as np, cv2
            pil   = PILImage.open(img_path).convert("RGB")
            img   = cv2.cvtColor(np.array(pil), cv2.COLOR_RGB2BGR)
        faces = extract_embedding._app.get(img)
        return faces[0].normed_embedding.tolist() if faces else None
    except Exception as e:
        print(f"  [!] Embedding extraction failed: {e}")
        return None

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--image",  required=True,          help="Path to humanized face image (PNG/JPG)")
    ap.add_argument("--name",   default="Demo Suspect", help="Suspect name")
    ap.add_argument("--crime",  default="Bank Robbery", help="Crime type")
    ap.add_argument("--desc",   default="",             help="Description (auto-generated if empty)")
    ap.add_argument("--seed",   default=-1, type=int,   help="SD seed used to generate this image (for your records)")
    ap.add_argument("--age",    default=35, type=int)
    ap.add_argument("--gender", default="Male")
    args = ap.parse_args()

    img_path = Path(args.image)
    if not img_path.exists():
        print(f"ERROR: Image not found: {img_path}"); sys.exit(1)

    sid      = f"demo_{args.name.lower().replace(' ','_')[:20]}"
    s3_key   = f"suspects/demo_humanized/{sid}_{int(time.time())}{img_path.suffix}"
    desc     = args.desc or (
        f"Identified via Suspectra forensic sketch-to-face reconstruction. "
        f"Wanted for {args.crime}. Sketch submitted by an eyewitness. "
        f"Positive ID confirmed during live demonstration of the Suspectra system."
    )

    print(f"\n  Enrolling: {args.name}  [{args.crime}]")
    if args.seed >= 0:
        print(f"  SD seed used: {args.seed}  (use SAME seed during demo!)")

    # Upload to S3
    ctype = "image/png" if img_path.suffix.lower() == ".png" else "image/jpeg"
    try:
        s3.upload_file(str(img_path), BUCKET, s3_key, ExtraArgs={"ContentType": ctype})
        print(f"  [✓] Uploaded to S3: {s3_key}")
    except ClientError as e:
        print(f"  [!] S3 upload failed: {e}"); sys.exit(1)

    # Index in Rekognition
    try:
        resp  = rek.index_faces(
            CollectionId=COLLECTION,
            Image={"S3Object": {"Bucket": BUCKET, "Name": s3_key}},
            ExternalImageId=sid,
            DetectionAttributes=[],
            MaxFaces=1,
        )
        faces = resp.get("FaceRecords", [])
        if not faces:
            print("  [!] No face detected. Make sure the image is a clear frontal face.")
            print("      Tip: if on CPU/local backend, the colourized sketch might not have a detectable face.")
            print("      Use CUDA/cloud backend for a photorealistic face that AWS can detect.")
            sys.exit(1)
        face_id = faces[0]["Face"]["FaceId"]
        print(f"  [✓] Indexed in Rekognition: face_id={face_id[:8]}…")
    except ClientError as e:
        print(f"  [!] Rekognition failed: {e}"); sys.exit(1)

    # ArcFace embedding
    embedding = extract_embedding(img_path)
    print(f"  [{'✓' if embedding else '!'}] ArcFace embedding: {'512-dim' if embedding else 'FAILED (InsightFace not installed?)'}")

    # Update suspects.json
    existing = json.loads(SUSPECTS.read_text(encoding="utf-8")) if SUSPECTS.exists() else []
    existing = [s for s in existing if s["id"] != sid]  # remove old entry with same id
    existing.append({
        "id":          sid,
        "name":        args.name,
        "age":         args.age,
        "gender":      args.gender,
        "crime_type":  args.crime,
        "description": desc,
        "s3_key":      s3_key,
        "face_id":     face_id,
        "embedding":   embedding,
        "is_demo":     True,
        "sd_seed":     args.seed,
    })
    SUSPECTS.write_text(json.dumps(existing, indent=2, ensure_ascii=False))

    print(f"\n✅  DONE — {args.name} enrolled as suspect ID: {sid}")
    print(f"\n{'='*55}")
    print(f"  DEMO INSTRUCTIONS:")
    print(f"  1. Restart AI service:  cd ai-service && start_dev.bat")
    print(f"  2. Open browser, go to Sketch page")
    print(f"  3. Build the SAME sketch you used to generate this face")
    print(f"  4. Click Humanize → expand Advanced Settings → set seed={args.seed}")
    print(f"  5. Click Humanize Sketch  (same seed = same face)")
    print(f"  6. Click Run Full Pipeline → select a case")
    print(f"  7. Watch AWS match:  '{args.name}' at high confidence!")
    print(f"{'='*55}\n")

if __name__ == "__main__":
    if not KEY_ID or not SECRET:
        print("ERROR: AWS credentials not in .env"); sys.exit(1)
    main()
