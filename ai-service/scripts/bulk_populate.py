"""
bulk_populate.py — Complete demo dataset setup in one command.

Run this ONCE on the demo laptop:
    cd ai-service
    python scripts/bulk_populate.py

Steps it runs automatically:
    1. setup_dataset.py  — 200 random passport-style suspects from randomuser.me
    2. enroll_demo_suspects.py — your friends' photos from dataset/demo_suspects/

After this, suspects.json will have 200+ regular suspects + your demo friends.
Restart the AI service once done.
"""

import subprocess
import sys
from pathlib import Path

SCRIPTS = Path(__file__).parent

def run(script: str):
    print(f"\n{'='*60}")
    print(f"  RUNNING: {script}")
    print(f"{'='*60}\n")
    result = subprocess.run(
        [sys.executable, str(SCRIPTS / script)],
        check=False,
    )
    if result.returncode != 0:
        print(f"\n[!] {script} exited with code {result.returncode}")
        print("    Fix the error above and re-run bulk_populate.py")
        sys.exit(result.returncode)
    print(f"\n[✓] {script} completed")

if __name__ == "__main__":
    run("setup_dataset.py")
    run("enroll_demo_suspects.py")
    print("\n" + "="*60)
    print("  ALL DONE — Demo dataset is ready!")
    print("  Restart the AI service:  uvicorn main:app --reload")
    print("="*60)
