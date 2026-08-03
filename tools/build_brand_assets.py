"""Rebuild every favicon and brand mark from the source logo.

    python3 tools/build_brand_assets.py

Source : public/os-omni-logo-v2.png       1024x1024 RGBA, transparent background

The source is a wide composition — the robot stands centre-left with platform
icons orbiting it — so nothing here uses it whole. Scaled to 32 px the full
scene is unreadable, and the two places the mark actually appears small (the
nav at 30 px, the footer at 34 px) would show mush. Everything is therefore cut
from ROBOT_BOX, the robot and its plinth, which stays legible down to 16 px.

Two treatments, by where the file is used:

  in-page mark   transparent, so it sits on the page's own background in both
                 the light and the dark theme
  browser chrome navy rounded plate, because the robot's shell is white and
                 would otherwise disappear against a light tab strip

Writes : public/favicon-512.png       512  transparent   nav, footer, 404 mark
         public/favicon-32.png         32  navy plate    <link rel=icon>
         public/favicon-16.png         16  navy plate    <link rel=icon>
         public/favicon.ico        16/32/48 navy plate    legacy /favicon.ico
         public/apple-touch-icon.png  180  navy, opaque  iOS home screen
                                                         (square: iOS masks it)
"""
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "public" / "os-omni-logo-v2.png"
OUT = ROOT / "public"

# The robot and its plinth, in source pixels, measured off the alpha channel.
# Widen this to let more of the orbiting icons in; the crop is squared around
# its centre afterwards, so the box does not have to be square itself.
ROBOT_BOX = (365, 232, 700, 700)
CROP_PAD = 0.03          # breathing room around the box, as a fraction

# One step lighter than --bg (#050c19) in static/css/main.css, so the robot's
# dark blue face does not merge into the plate at small sizes.
PLATE = (8, 17, 36, 255)
PLATE_RADIUS = 0.18      # corner radius as a fraction of the icon's side
PLATE_INSET = 0.08       # margin between the plate edge and the art


def squared_crop(img, box, pad=CROP_PAD):
    x0, y0, x1, y1 = box
    side = int(max(x1 - x0, y1 - y0) * (1 + 2 * pad))
    cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
    return img.crop((cx - side // 2, cy - side // 2, cx + side // 2, cy + side // 2))


def plated(art, size, radius=PLATE_RADIUS, opaque=False):
    """The mark on a navy plate. Rounded corners are drawn at 4x and downsampled
    because PIL's rounded_rectangle has no antialiasing of its own."""
    out = Image.new("RGBA", (size, size), PLATE if opaque else (0, 0, 0, 0))
    if not opaque:
        mask = Image.new("L", (size * 4, size * 4), 0)
        ImageDraw.Draw(mask).rounded_rectangle(
            [0, 0, size * 4 - 1, size * 4 - 1], radius=int(size * 4 * radius), fill=255)
        out.paste(Image.new("RGBA", (size, size), PLATE), (0, 0),
                  mask.resize((size, size), Image.LANCZOS))
    inset = round(size * PLATE_INSET)
    out.alpha_composite(art.resize((size - 2 * inset,) * 2, Image.LANCZOS), (inset, inset))
    return out


def build():
    if not SOURCE.exists():
        raise SystemExit(f"source logo not found: {SOURCE}")
    art = squared_crop(Image.open(SOURCE).convert("RGBA"), ROBOT_BOX)

    written = []

    # in-page brand mark — transparent. Quantised: full RGBA is 418 KB for
    # something that renders at 30 px in the nav and 104 px on the 404 page.
    # FASTOCTREE is the one PIL quantiser that keeps the alpha channel.
    p = OUT / "favicon-512.png"
    (art.resize((512, 512), Image.LANCZOS)
        .quantize(colors=256, method=Image.FASTOCTREE)
        .save(p, optimize=True))
    written.append(p)

    # browser chrome — plated
    for size in (32, 16):
        p = OUT / f"favicon-{size}.png"
        plated(art, size).save(p, optimize=True)
        written.append(p)

    p = OUT / "favicon.ico"
    plated(art, 48).save(p, sizes=[(48, 48), (32, 32), (16, 16)])
    written.append(p)

    # iOS wants an opaque square and applies its own rounding
    p = OUT / "apple-touch-icon.png"
    plated(art, 180, opaque=True).convert("RGB").save(p, optimize=True)
    written.append(p)

    for p in written:
        print(f"  wrote {p.relative_to(ROOT).as_posix():30s} {p.stat().st_size // 1024:>4d} KB")


if __name__ == "__main__":
    build()
