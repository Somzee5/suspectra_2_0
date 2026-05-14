DROP YOUR FRIENDS' PHOTOS HERE
==============================

File naming convention:
  firstname_lastname.jpg
  e.g.  soham_patil.jpg
        parag_yadav.jpg
        swanand_mahabal.jpg
        zaid_sharikmaslat.jpg

Requirements:
  - Clear frontal face photo (passport-style or selfie works)
  - JPG or PNG format
  - File size under 5 MB

Crime profiles are pre-configured in:
  ai-service/scripts/enroll_demo_suspects.py
  (edit DEMO_PROFILES dict to change names/crimes/descriptions)

After adding photos, run:
  cd ai-service
  python scripts/enroll_demo_suspects.py
