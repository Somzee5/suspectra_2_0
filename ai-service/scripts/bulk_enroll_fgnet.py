"""
bulk_enroll_fgnet.py — Upload FG-NET real face photos → AWS Rekognition + suspects.json

FG-NET has 82 subjects, 1002 real face photos (ages 0-69).
This script picks the BEST photo per person (age 20-35 = clearest adult face),
uploads to S3, indexes in Rekognition, extracts ArcFace embedding,
and adds to suspects.json — giving you 82+ realistic suspects.

Run ONCE on the demo laptop:
    cd ai-service
    python scripts/bulk_enroll_fgnet.py

Result: suspects.json grows from 15 → 90+ suspects, all indexed in AWS.
"""
import os, sys, re, json, time, random, itertools
from pathlib import Path
from collections import defaultdict
from dotenv import load_dotenv
import boto3
from botocore.exceptions import ClientError

ROOT     = Path(__file__).parent.parent
FGNET    = Path(r"D:\cufsf_test\FGNET\images")
load_dotenv(ROOT / ".env")

REGION     = os.getenv("AWS_REGION",                     "us-east-1")
KEY_ID     = os.getenv("AWS_ACCESS_KEY_ID")
SECRET     = os.getenv("AWS_SECRET_ACCESS_KEY")
BUCKET     = os.getenv("AWS_S3_BUCKET",                  "suspectra-facematch-somzee5")
COLLECTION = os.getenv("AWS_REKOGNITION_COLLECTION",      "suspectra_collection")
SUSPECTS   = ROOT / "dataset" / "suspects.json"

if not KEY_ID or not SECRET:
    print("ERROR: AWS credentials missing in .env"); sys.exit(1)
if not FGNET.exists():
    print(f"ERROR: FG-NET not found at {FGNET}"); sys.exit(1)

rek = boto3.client("rekognition", region_name=REGION,
                   aws_access_key_id=KEY_ID, aws_secret_access_key=SECRET)
s3  = boto3.client("s3", region_name=REGION,
                   aws_access_key_id=KEY_ID, aws_secret_access_key=SECRET)

# ── Indian names pool for realistic profiles ───────────────────────────────────
FIRST = ["Arjun","Rahul","Priya","Neha","Vikram","Sanjay","Anjali","Rohan",
         "Pooja","Amit","Suresh","Kavya","Deepak","Meera","Ravi","Sneha",
         "Kiran","Arun","Divya","Nikhil","Sunita","Manoj","Rekha","Sunil",
         "Geeta","Ashok","Nisha","Vijay","Lata","Rajesh","Shweta","Anil",
         "Seema","Mukesh","Kavita","Vinod","Anita","Ramesh","Usha","Dinesh",
         "Madhu","Hemant","Asha","Prakash","Suman","Girish","Sarita","Vivek",
         "Radha","Pankaj","Vandana","Yogesh","Manju","Ajay","Sundar","Preeti",
         "Ganesh","Rani","Naresh","Shanti","Mohan","Beena","Santosh","Jyoti",
         "Ratan","Veena","Satish","Archana","Bharat","Nalini","Dilip","Pushpa",
         "Harish","Malti","Sudhir","Nirmala","Gopal","Shobha","Sridhar","Uday"]
LAST  = ["Sharma","Patil","Gupta","Singh","Kumar","Verma","Mishra","Joshi",
         "Mehta","Shah","Nair","Rao","Iyer","Reddy","Patel","Jain","Dubey",
         "Tiwari","Yadav","Saxena","Chandra","Bose","Das","Chatterjee","Ghosh",
         "Kapoor","Malhotra","Chopra","Bhatia","Arora","Khanna","Choudhury",
         "Pillai","Menon","Murthy","Krishnan","Rajan","Subramaniam","Naidu",
         "Pandey","Shukla","Dwivedi","Tripathi","Chauhan","Rajput","Thakur"]

CRIME_POOL = [
    ("Armed Robbery",      "Suspect in a series of armed robberies across district borders."),
    ("Bank Fraud",         "Orchestrated fake loan schemes defrauding multiple banks."),
    ("Drug Trafficking",   "Alleged distributor in a cross-state narcotics network."),
    ("Cybercrime",         "Hacked government portals and sold citizen data."),
    ("Kidnapping",         "Wanted for ransom kidnapping. Last seen changing aliases."),
    ("Extortion",          "Ran a systematic extortion ring targeting small businesses."),
    ("Burglary",           "Career burglar with 11 prior entries. Currently at large."),
    ("Counterfeiting",     "Printed high-quality fake currency notes worth ₹40 lakh."),
    ("Human Trafficking",  "Key player in inter-state trafficking network."),
    ("Money Laundering",   "Laundered proceeds through shell companies."),
    ("Arson",              "Suspect in three deliberate fire incidents."),
    ("Identity Theft",     "Created fraudulent Aadhaar and PAN cards for criminal network."),
    ("Corporate Espionage","Stole IP from pharmaceutical companies."),
    ("Tax Evasion",        "Evaded ₹3.2 crore in GST through shell firms."),
    ("Smuggling",          "Operated illegal gold smuggling channel via airports."),
]
crime_cycle = itertools.cycle(CRIME_POOL)
name_pairs  = list(itertools.product(FIRST, LAST))
random.shuffle(name_pairs)
name_cycle  = itertools.cycle(name_pairs)

# ── Parse FG-NET filenames ─────────────────────────────────────────────────────
def parse(fname):
    m = re.match(r"(\d+)A(\d+)\.JPG", fname.upper())
    return (int(m.group(1)), int(m.group(2))) if m else (None, None)

# ── Group by person, pick best photo (age 20-40 preferred) ────────────────────
person_data = defaultdict(list)
for f in FGNET.iterdir():
    pid, age = parse(f.name)
    if pid: person_data[pid].append((age, f))

def pick_best(photos):
    adult = [(a, p) for a, p in photos if 18 <= a <= 40]
    if adult: return sorted(adult, key=lambda x: abs(x[0]-28))[0][1]
    return sorted(photos, key=lambda x: x[0])[len(photos)//2][1]

# ── Load existing suspects ─────────────────────────────────────────────────────
existing = json.loads(SUSPECTS.read_text(encoding="utf-8")) if SUSPECTS.exists() else []
already  = {s["id"] for s in existing}

# ── ArcFace loader ─────────────────────────────────────────────────────────────
def load_arcface():
    try:
        from insightface.app import FaceAnalysis
        app = FaceAnalysis(name="buffalo_sc", providers=["CPUExecutionProvider"])
        app.prepare(ctx_id=-1, det_size=(640, 640))
        return app
    except Exception as e:
        print(f"  [!] InsightFace not available: {e}")
        return None

def get_embedding(app, img_path):
    if not app: return None
    try:
        import cv2
        img   = cv2.imread(str(img_path))
        faces = app.get(img)
        return faces[0].normed_embedding.tolist() if faces else None
    except: return None

# ── Main ──────────────────────────────────────────────────────────────────────
print(f"\nFG-NET bulk enroll — {len(person_data)} subjects found")
print(f"Existing suspects: {len(existing)}")
print(f"Loading ArcFace...\n")
arcface = load_arcface()

added = 0
for pid, photos in sorted(person_data.items()):
    sid = f"fgnet_{pid:03d}"
    if sid in already:
        print(f"  [=] {sid} already enrolled — skip")
        continue

    best_photo = pick_best(photos)
    fn, ln     = next(name_cycle)
    name       = f"{fn} {ln}"
    crime, desc = next(crime_cycle)
    age         = random.randint(28, 55)

    s3_key = f"suspects/fgnet/{best_photo.name}"
    print(f"  [→] {sid}  {name:25s}  {crime}")

    # S3 upload
    try:
        s3.upload_file(str(best_photo), BUCKET, s3_key,
                       ExtraArgs={"ContentType": "image/jpeg"})
    except ClientError as e:
        print(f"       S3 failed: {e}"); continue

    # Rekognition index
    try:
        resp  = rek.index_faces(
            CollectionId=COLLECTION,
            Image={"S3Object": {"Bucket": BUCKET, "Name": s3_key}},
            ExternalImageId=sid,
            DetectionAttributes=[],
            MaxFaces=1,
        )
        faces = resp.get("FaceRecords", [])
        face_id = faces[0]["Face"]["FaceId"] if faces else None
        if not face_id:
            print(f"       No face detected — skip"); continue
    except ClientError as e:
        print(f"       Rekognition failed: {e}"); continue

    embedding = get_embedding(arcface, best_photo)

    existing.append({
        "id":          sid,
        "name":        name,
        "age":         age,
        "gender":      random.choice(["Male", "Female"]),
        "crime_type":  crime,
        "description": desc,
        "s3_key":      s3_key,
        "face_id":     face_id,
        "embedding":   embedding,
    })
    already.add(sid)
    added += 1
    print(f"       ✓  face_id={face_id[:8]}…  emb={'yes' if embedding else 'no'}")
    time.sleep(0.25)  # be gentle with AWS rate limits

SUSPECTS.write_text(json.dumps(existing, indent=2, ensure_ascii=False))
print(f"\n✅  {added} FG-NET suspects enrolled.")
print(f"   Total in suspects.json: {len(existing)}")
print(f"   Restart the AI service to reload.\n")
