#!/usr/bin/env python3
"""
gen_features.py — draw custom forensic-sketch feature PNGs for professor's face.
Uses only Pillow (already installed). Run from repo root.

Generates:
  face/face_11.png       — Round face with visible ears + neck
  hair/hair_14.png       — Short side-part hair (left part)
  eyebrows/eyebrows_13   — Extra thick flat eyebrows
  nose/nose_13.png       — Wide broad Indian nose
  lips/lips_13.png       — Full lips with upward smile corners
  extras/extras_07.png   — Red bindi / tilak
"""
import os
from PIL import Image, ImageDraw

S = 4   # 4× supersampling → downscale with LANCZOS for AA
BASE = r'D:\suspectra_2_0\frontend\public\assets\features'

SIZES = {
    'face':      (320, 400),
    'hair':      (340, 200),
    'eyebrows':  (260,  55),
    'nose':      (110, 130),
    'lips':      (180,  75),
    'extras':    ( 60,  60),
}

BLACK = (0, 0, 0, 255)
DARK  = (40, 40, 40, 200)
RED   = (160, 15, 15, 240)
RED_O = (90, 0, 0, 255)


def cv(cat, alpha=255):
    w, h = SIZES[cat]
    return Image.new('RGBA', (w * S, h * S), (255, 255, 255, alpha))


def fin(img, cat):
    w, h = SIZES[cat]
    return img.resize((w, h), Image.LANCZOS)


def commit(img, cat, num, label):
    small = fin(img, cat)
    path  = os.path.join(BASE, cat, f'{cat}_{num:02d}.png')
    small.save(path, 'PNG')
    print(f'  OK  {cat}_{num:02d}.png   [{label}]')


# ─────────────────────────────────────────────────────────────────────────────
#  FACE 11 — round face, wider at cheeks, visible ears, neck stub
# ─────────────────────────────────────────────────────────────────────────────
def make_face_11():
    img = cv('face')
    d   = ImageDraw.Draw(img)
    W, H = img.size
    lw   = 9

    cx = W // 2
    cy = int(H * 0.48)
    rx = int(W * 0.40)
    ry = int(H * 0.43)

    # Main oval
    d.ellipse([cx-rx, cy-ry, cx+rx, cy+ry], outline=BLACK, width=lw)

    # Left ear
    ew, eh = int(W*0.09), int(H*0.11)
    ey = cy - eh//2
    d.arc([cx-rx-ew, ey, cx-rx+ew//2, ey+eh],
          start=90, end=270, fill=BLACK, width=lw-2)

    # Right ear
    d.arc([cx+rx-ew//2, ey, cx+rx+ew, ey+eh],
          start=270, end=90, fill=BLACK, width=lw-2)

    # Neck (two lines below chin)
    nw  = int(W * 0.16)
    ny0 = cy + ry - lw
    ny1 = cy + ry + int(H * 0.09)
    d.line([(cx-nw, ny0), (cx-nw, ny1)], fill=BLACK, width=lw-2)
    d.line([(cx+nw, ny0), (cx+nw, ny1)], fill=BLACK, width=lw-2)

    return img


# ─────────────────────────────────────────────────────────────────────────────
#  HAIR 14 — short, left-side part, strokes sweeping outward
# ─────────────────────────────────────────────────────────────────────────────
def make_hair_14():
    img = cv('hair')
    d   = ImageDraw.Draw(img)
    W, H = img.size
    lw   = 7
    sw   = 4    # stroke width

    part_x = int(W * 0.40)

    # Outer silhouette
    sil = [
        (int(W*0.11), int(H*0.90)),
        (int(W*0.06), int(H*0.50)),
        (int(W*0.08), int(H*0.24)),
        (int(W*0.22), int(H*0.07)),
        (part_x,      int(H*0.04)),
        (int(W*0.58), int(H*0.03)),
        (int(W*0.80), int(H*0.10)),
        (int(W*0.93), int(H*0.30)),
        (int(W*0.93), int(H*0.60)),
        (int(W*0.89), int(H*0.90)),
    ]
    d.line(sil, fill=BLACK, width=lw)

    # Part line
    d.line([(part_x, int(H*0.04)),
            (part_x + int(W*0.02), int(H*0.40))],
           fill=BLACK, width=lw-1)

    # Left-side hair strokes (sweep from part → left)
    for i in range(10):
        y  = int(H * (0.09 + i * 0.08))
        x0 = part_x - int(W * 0.02 * (i + 1))
        x1 = int(W * 0.09)
        d.line([(x0, y), (x1, y + int(H*0.09))], fill=BLACK, width=sw)

    # Right-side hair strokes (sweep from part → right)
    for i in range(10):
        y  = int(H * (0.07 + i * 0.08))
        x0 = part_x + int(W * 0.02 * (i + 1))
        x1 = int(W * 0.90)
        d.line([(x0, y), (x1, y + int(H*0.05))], fill=BLACK, width=sw)

    return img


# ─────────────────────────────────────────────────────────────────────────────
#  EYEBROWS 13 — extra thick, almost flat, dark filled
# ─────────────────────────────────────────────────────────────────────────────
def make_eyebrows_13():
    img = cv('eyebrows')
    d   = ImageDraw.Draw(img)
    W, H = img.size

    # Thickness bands
    ty = int(H * 0.14)
    by = int(H * 0.86)
    a  = int(H * 0.10)   # slight inner arch

    # Left eyebrow
    lx1, lx2 = int(W*0.03), int(W*0.44)
    lm        = (lx1 + lx2) // 2
    left_pts  = [
        (lx1, by),
        (lx1, ty + a),
        (lm,  ty),
        (lx2, ty + int(H*0.14)),
        (lx2, by - int(H*0.12)),
        (lm,  by),
    ]
    d.polygon(left_pts, fill=BLACK, outline=BLACK)

    # Right eyebrow (mirror)
    rx1, rx2 = int(W*0.56), int(W*0.97)
    rm        = (rx1 + rx2) // 2
    right_pts = [
        (rx1, ty + int(H*0.14)),
        (rm,  ty),
        (rx2, ty + a),
        (rx2, by),
        (rm,  by),
        (rx1, by - int(H*0.12)),
    ]
    d.polygon(right_pts, fill=BLACK, outline=BLACK)

    return img


# ─────────────────────────────────────────────────────────────────────────────
#  NOSE 13 — wide, broad, flat bridge, prominent nostrils
# ─────────────────────────────────────────────────────────────────────────────
def make_nose_13():
    img = cv('nose')
    d   = ImageDraw.Draw(img)
    W, H = img.size
    lw   = 7

    cx = W // 2

    # Wide bridge
    bw = int(W * 0.17)
    d.line([(cx-bw, int(H*0.02)), (cx-bw, int(H*0.50))], fill=BLACK, width=lw)
    d.line([(cx+bw, int(H*0.02)), (cx+bw, int(H*0.50))], fill=BLACK, width=lw)

    # Wide nose tip ellipse
    tw = int(W * 0.45)
    d.ellipse([cx-tw, int(H*0.48), cx+tw, int(H*0.86)],
              outline=BLACK, width=lw)

    # Left nostril
    nlx, nly = cx - int(W*0.27), int(H*0.68)
    nw, nh   = int(W*0.16), int(H*0.13)
    d.ellipse([nlx-nw, nly-nh, nlx+nw, nly+nh], outline=BLACK, width=5)
    d.ellipse([nlx-nw+6, nly-nh+6, nlx+nw-6, nly+nh-6], fill=DARK)

    # Right nostril
    nrx = cx + int(W*0.27)
    d.ellipse([nrx-nw, nly-nh, nrx+nw, nly+nh], outline=BLACK, width=5)
    d.ellipse([nrx-nw+6, nly-nh+6, nrx+nw-6, nly+nh-6], fill=DARK)

    # Base line
    d.line([(cx-tw+int(W*0.06), int(H*0.85)),
            (cx+tw-int(W*0.06), int(H*0.85))], fill=BLACK, width=lw)

    return img


# ─────────────────────────────────────────────────────────────────────────────
#  LIPS 13 — full, slightly upturned corners (gentle smile)
# ─────────────────────────────────────────────────────────────────────────────
def make_lips_13():
    img = cv('lips')
    d   = ImageDraw.Draw(img)
    W, H = img.size
    lw   = 7

    cx = W // 2
    my = int(H * 0.50)    # mouth line
    hw = int(W * 0.44)    # half-width

    # Upper lip — cupid's bow
    ul = [
        (cx-hw, my),
        (cx - int(W*0.30), my - int(H*0.20)),
        (cx - int(W*0.13), my - int(H*0.40)),
        (cx,               my - int(H*0.20)),
        (cx + int(W*0.13), my - int(H*0.40)),
        (cx + int(W*0.30), my - int(H*0.20)),
        (cx+hw, my),
    ]
    d.line(ul, fill=BLACK, width=lw)

    # Lower lip — fuller single arc
    ll = [
        (cx-hw, my),
        (cx - int(W*0.26), my + int(H*0.32)),
        (cx,               my + int(H*0.44)),
        (cx + int(W*0.26), my + int(H*0.32)),
        (cx+hw, my),
    ]
    d.line(ll, fill=BLACK, width=lw)

    # Mouth line (center)
    d.line([(cx-hw+int(W*0.06), my),
            (cx+hw-int(W*0.06), my)], fill=BLACK, width=lw-1)

    # Corner upturn hints
    d.line([(cx-hw, my),
            (cx-hw-int(W*0.01), my-int(H*0.10))], fill=BLACK, width=lw-1)
    d.line([(cx+hw, my),
            (cx+hw+int(W*0.01), my-int(H*0.10))], fill=BLACK, width=lw-1)

    return img


# ─────────────────────────────────────────────────────────────────────────────
#  EXTRAS 07 — red bindi / tilak
# ─────────────────────────────────────────────────────────────────────────────
def make_extras_07():
    W, H = 60*S, 60*S
    img  = Image.new('RGBA', (W, H), (255, 255, 255, 0))   # transparent bg
    d    = ImageDraw.Draw(img)
    cx, cy = W//2, H//2
    r = int(W * 0.40)

    # Main red circle
    d.ellipse([cx-r, cy-r, cx+r, cy+r], fill=RED, outline=RED_O, width=4)

    # Subtle highlight
    hr = r // 3
    d.ellipse([cx-hr, cy-r+int(r*0.28), cx, cy-int(r*0.12)],
              fill=(215, 75, 75, 80))

    path = os.path.join(BASE, 'extras', 'extras_07.png')
    img.resize((60, 60), Image.LANCZOS).save(path, 'PNG')
    print(f'  OK  extras_07.png   [Red Bindi/Tilak]')


# ─────────────────────────────────────────────────────────────────────────────
if __name__ == '__main__':
    print('Generating custom feature PNGs…\n')
    commit(make_face_11(),      'face',     11, 'Round face + ears + neck')
    commit(make_hair_14(),      'hair',     14, 'Short left-side-part hair')
    commit(make_eyebrows_13(),  'eyebrows', 13, 'Extra thick flat eyebrows')
    commit(make_nose_13(),      'nose',     13, 'Wide broad Indian nose')
    commit(make_lips_13(),      'lips',     13, 'Full lips + gentle smile')
    make_extras_07()
    print('\nAll done.')
