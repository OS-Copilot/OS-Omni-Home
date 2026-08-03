"""Rebuild every favicon and brand mark from the source logo.

    python3 tools/build_brand_assets.py

Source : public/OS-Omni-V6.png            1024x1024 RGBA, transparent background

The whole composition is kept — robot, plinth, orbit ring and all six platform
cards. The source is wider than it is tall, so it is squared by padding, never
by cropping: the transparent margin is trimmed off, then equal strips are added
above and below. Nothing is cut at any size, and nothing is inset, so the art
spans the full width of every icon it is written into.

Everything stays transparent. An earlier pass put the small icons on a navy
plate, reasoning that the robot's white shell needs contrast against a light
tab strip. Rendered against Chrome's actual tab colours that was clearly wrong:
at 16 px the plate is the icon and the art inside it is eleven pixels tall, so
the tab just shows a black square. The composition carries its own contrast —
a blue monitor, a green phone, an orange laptop, a teal ring — and reads on a
white tab, a grey tab and a dark one alike.

The one exception is the iOS icon, which cannot be transparent: iOS fills the
alpha with black. It gets an opaque navy square, matching the page background.

Writes : public/favicon-512.png       512  transparent   nav, footer, 404 mark
         public/favicon-32.png         32  transparent   <link rel=icon>
         public/favicon-16.png         16  transparent   <link rel=icon>
         public/favicon.ico        16/32/48 transparent   legacy /favicon.ico
         public/apple-touch-icon.png  180  opaque navy   iOS home screen
                                                         (square: iOS masks it)
"""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "public" / "OS-Omni-V6.png"
OUT = ROOT / "public"

# Page background, --bg in static/css/main.css. Only the iOS icon uses it.
NAVY = (5, 12, 25, 255)


def squared(img):
    """Trim the transparent margin, then pad to a square. Padding, not cropping,
    so a composition that is not square keeps every part of itself. No extra
    margin: at 16 px every pixel of width counts."""
    art = img.crop(img.getbbox())
    side = max(art.size)
    out = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    out.paste(art, ((side - art.width) // 2, (side - art.height) // 2))
    return out


def build():
    if not SOURCE.exists():
        raise SystemExit(f"source logo not found: {SOURCE}")
    src = Image.open(SOURCE).convert("RGBA")
    art = squared(src)
    bb = src.getbbox()
    print(f"  source {src.size[0]}x{src.size[1]} -> content {bb[2]-bb[0]}x{bb[3]-bb[1]}"
          f" -> art {art.size[0]}x{art.size[1]} (squared by padding)")

    written = []

    def at(size):
        return art.resize((size, size), Image.LANCZOS)

    # in-page brand mark. Quantised: full RGBA is ~400 KB for something that
    # renders at 30 px in the nav and 104 px on the 404 page. FASTOCTREE is the
    # one PIL quantiser that keeps the alpha channel.
    p = OUT / "favicon-512.png"
    at(512).quantize(colors=256, method=Image.FASTOCTREE).save(p, optimize=True)
    written.append(p)

    for size in (32, 16):
        p = OUT / f"favicon-{size}.png"
        at(size).save(p, optimize=True)
        written.append(p)

    p = OUT / "favicon.ico"
    at(48).save(p, sizes=[(48, 48), (32, 32), (16, 16)])
    written.append(p)

    # iOS renders transparent pixels black, so this one gets a background
    p = OUT / "apple-touch-icon.png"
    ios = Image.new("RGBA", (180, 180), NAVY)
    ios.alpha_composite(at(180))
    ios.convert("RGB").save(p, optimize=True)
    written.append(p)

    for p in written:
        print(f"  wrote {p.relative_to(ROOT).as_posix():30s} {p.stat().st_size // 1024:>4d} KB")


if __name__ == "__main__":
    build()
