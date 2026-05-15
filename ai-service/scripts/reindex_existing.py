"""
reindex_existing.py — Index the 15 existing suspects in AWS Rekognition.

They are already in suspects.json with S3 keys and ArcFace embeddings,
but face_id is empty → AWS path is completely disabled for them.
Run this once to fix it.

    cd ai-service
    python scripts/reindex_existing.py
"""
import os, sys, json, time
from pathlib import Path
from dotenv import load_dotenv
import boto3
from botocore.exceptions import ClientError

ROOT = Path(__file__).parent.parent
load_dotenv(ROOT / ".env")

REGION     = os.getenv("AWS_REGION", "us-east-1")
KEY_ID     = os.getenv("AWS_ACCESS_KEY_ID")
SECRET     = os.getenv("AWS_SECRET_ACCESS_KEY")
BUCKET     = os.getenv("AWS_S3_BUCKET",                  "suspectra-facematch-somzee5")
COLLECTION = os.getenv("AWS_REKOGNITION_COLLECTION",      "suspectra_collection")
SUSPECTS   = ROOT / "dataset" / "suspects.json"

rek = boto3.client("rekognition", region_name=REGION,
                   aws_access_key_id=KEY_ID, aws_secret_access_key=SECRET)
s3  = boto3.client("s3", region_name=REGION,
                   aws_access_key_id=KEY_ID, aws_secret_access_key=SECRET)

data = json.loads(SUSPECTS.read_text(encoding="utf-8"))
fixed = 0

for s in data:
    if s.get("face_id"):
        print(f"  [=] {s['name']:30s} already indexed — skip")
        continue

    s3_key = s.get("s3_key", "")
    if not s3_key:
        print(f"  [!] {s['name']:30s} has no s3_key — skip")
        continue

    # Check S3 key exists
    try:
        s3.head_object(Bucket=BUCKET, Key=s3_key)
    except ClientError:
        print(f"  [!] {s['name']:30s} s3_key not found in S3 — skip")
        continue

    # Index in Rekognition
    try:
        resp  = rek.index_faces(
            CollectionId=COLLECTION,
            Image={"S3Object": {"Bucket": BUCKET, "Name": s3_key}},
            ExternalImageId=s["id"],
            DetectionAttributes=[],
            MaxFaces=1,
        )
        faces = resp.get("FaceRecords", [])
        if faces:
            s["face_id"] = faces[0]["Face"]["FaceId"]
            fixed += 1
            print(f"  [✓] {s['name']:30s}  face_id={s['face_id'][:8]}…")
        else:
            print(f"  [!] {s['name']:30s}  no face detected in image")
    except ClientError as e:
        print(f"  [!] {s['name']:30s}  Rekognition error: {e}")

    time.sleep(0.2)  # rate limit

SUSPECTS.write_text(json.dumps(data, indent=2, ensure_ascii=False))
print(f"\n✅  {fixed} suspects re-indexed in AWS. Restart the AI service.")
