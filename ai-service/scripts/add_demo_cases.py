"""
add_demo_cases.py — Insert 15 realistic investigation cases into PostgreSQL.

Requires: pip install psycopg2-binary

Run ONCE (backend must NOT be running to avoid FK issues — or it's fine running):
    cd ai-service
    python scripts/add_demo_cases.py

Cases are attached to the FIRST registered user in the DB.
"""
import sys
try:
    import psycopg2
except ImportError:
    print("Install psycopg2:  pip install psycopg2-binary"); sys.exit(1)

import uuid
from datetime import datetime, timezone, timedelta
import random

DB_URL  = "postgresql://postgres:sohamxyz@localhost:5432/suspectra_db"

CASES = [
    {
        "title":       "Armed Robbery — MG Road, Pune",
        "description": "Suspect robbed a jewellery store at gunpoint. Eyewitness provided detailed facial description. CCTV footage shows partial face. Sketch being prepared for database comparison.",
        "status":      "ACTIVE",
        "days_ago":    2,
    },
    {
        "title":       "Bank Fraud — Sangli Co-operative Bank",
        "description": "₹4.2 crore siphoned through 47 fraudulent accounts over 6 months. Suspect used forged Aadhaar cards. Sketch submitted by bank employee who interacted with suspect.",
        "status":      "ACTIVE",
        "days_ago":    5,
    },
    {
        "title":       "Cybercrime — MPSC Data Breach",
        "description": "Confidential examination data leaked online before scheduled MPSC exam. Suspect accessed server remotely. Digital forensics traced access to a specific ISP node.",
        "status":      "ACTIVE",
        "days_ago":    1,
    },
    {
        "title":       "Drug Trafficking — NH-48 Seizure",
        "description": "₹18 lakh street value narcotics intercepted at checkpost. Driver arrested but named two others who escaped. Forensic sketch constructed from driver's description.",
        "status":      "UNDER_REVIEW",
        "days_ago":    8,
    },
    {
        "title":       "Kidnapping — Miraj Industrial Area",
        "description": "Factory owner's son held for ransom. Suspect communicated via encrypted app. Partial facial recognition from hospital CCTV where suspect sought treatment.",
        "status":      "ACTIVE",
        "days_ago":    3,
    },
    {
        "title":       "Hit and Run — Kolhapur Highway",
        "description": "Truck driver fled scene after collision killing two. Partial number plate noted. Bystander gave sketch of driver seen exiting truck before fleeing on foot.",
        "status":      "ACTIVE",
        "days_ago":    4,
    },
    {
        "title":       "Counterfeiting Ring — Solapur",
        "description": "High-quality fake ₹500 notes circulating in market. Three suspects identified via ATM footage. Sketch created for the fourth unidentified suspect.",
        "status":      "UNDER_REVIEW",
        "days_ago":    12,
    },
    {
        "title":       "Human Trafficking — Railway Station Alert",
        "description": "GRP officer flagged suspicious individual attempting to transport five minors across state. Suspect escaped when officer called for backup. Description filed immediately.",
        "status":      "ACTIVE",
        "days_ago":    1,
    },
    {
        "title":       "Corporate Espionage — Walchand Industries",
        "description": "Confidential R&D blueprints accessed from internal network. Suspect posed as an IT contractor. Badge photo quality insufficient for direct matching — sketch being used.",
        "status":      "ACTIVE",
        "days_ago":    7,
    },
    {
        "title":       "Extortion — Merchants Association",
        "description": "Series of extortion calls targeting members of the Sangli merchants association. Phone traced to a burner. Two witnesses independently produced similar sketches.",
        "status":      "ACTIVE",
        "days_ago":    6,
    },
    {
        "title":       "Arson — Warehouse District",
        "description": "Three warehouse fires in 30 days ruled arson. Security footage shows unidentified male near perimeter 45 minutes before each fire. Sketch from footage submitted.",
        "status":      "CLOSED",
        "days_ago":    20,
    },
    {
        "title":       "Identity Theft — Aadhar Fraud Syndicate",
        "description": "450 fraudulent Aadhar enrollments traced to a single biometric centre. Operator was a fake identity. Composite sketch created from coworkers' descriptions.",
        "status":      "UNDER_REVIEW",
        "days_ago":    15,
    },
    {
        "title":       "Organised Crime — Real Estate Racket",
        "description": "Gang selling non-existent properties to NRIs. ₹2.3 crore collected before victims realised. Primary suspect identified; two associates remain at large.",
        "status":      "ACTIVE",
        "days_ago":    9,
    },
    {
        "title":       "Murder Investigation — Hadapsar",
        "description": "Victim found near industrial zone. Last seen with unidentified male. Forensic team working with eyewitness. Sketch pipeline active — aging module in use.",
        "status":      "ACTIVE",
        "days_ago":    14,
    },
    {
        "title":       "Smuggling — Airport Cargo Terminal",
        "description": "Gold biscuits worth ₹1.4 crore found in false-bottom crates. Cargo manifest forged. Ground handler whistleblower provided description of the coordinator.",
        "status":      "ACTIVE",
        "days_ago":    11,
    },
]

STATUS_MAP = {
    "ACTIVE":       "ACTIVE",
    "UNDER_REVIEW": "UNDER_REVIEW",
    "CLOSED":       "CLOSED",
}

try:
    conn = psycopg2.connect(
        host="localhost", port=5432, dbname="suspectra_db",
        user="postgres", password="sohamxyz"
    )
    cur = conn.cursor()

    # Find first user
    cur.execute("SELECT id FROM users LIMIT 1")
    row = cur.fetchone()
    if not row:
        print("ERROR: No users in DB. Login once via the app first."); sys.exit(1)
    user_id = row[0]
    print(f"Attaching cases to user: {user_id}\n")

    # Get existing case titles to avoid duplicates
    cur.execute("SELECT title FROM cases")
    existing_titles = {r[0] for r in cur.fetchall()}

    added = 0
    for c in CASES:
        if c["title"] in existing_titles:
            print(f"  [=] Already exists: {c['title'][:55]}")
            continue

        created = datetime.now(timezone.utc) - timedelta(days=c["days_ago"])
        cid     = str(uuid.uuid4())

        cur.execute("""
            INSERT INTO cases (id, title, description, status, created_by, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, (cid, c["title"], c["description"], c["status"], user_id, created, created))

        added += 1
        print(f"  [+] {c['title'][:58]}  [{c['status']}]")

    conn.commit()
    cur.close()
    conn.close()
    print(f"\n✅  {added} cases added to PostgreSQL.")
    print("   Refresh the dashboard — cases will appear immediately.\n")

except psycopg2.OperationalError as e:
    print(f"DB connection failed: {e}")
    print("Is PostgreSQL running? Check: pg_ctl status")
    sys.exit(1)
