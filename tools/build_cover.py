"""Rebuild the hero key art from the source cover.

    python3 tools/build_cover.py

Source : public/os-omni-cover-v2.png       1254x1254 RGB
Writes : public/cover.webp                  900x900, q85 — served first
         public/cover.png                   900x900, quantised — fallback

900 px for a slot that is about 350 px wide on a desktop looks generous, but the
same file serves the mobile layout, where `.hero-art` grows to 420 px; 900 is
2x there. The `<picture>` in index.html lists the WebP first, so the PNG is only
fetched by a browser without WebP support, which in practice means almost none.

This art is dense — a full starfield over gold filigree — so it does not
compress like the previous cover did. Rendered at display size, q85 and q80 are
indistinguishable from the source; at 1:1 q85 holds the small stars that q80
starts to smooth away. Palette-quantising the PNG keeps that detail but bands
the smooth blue, which is why the PNG is the fallback and not the other way
round.
"""
from pathlib import Path
import subprocess

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "public" / "os-omni-cover-v2.png"
OUT = ROOT / "public"

SIZE = 900
WEBP_Q = 85
PNG_COLORS = 256


def build():
    if not SOURCE.exists():
        raise SystemExit(f"source cover not found: {SOURCE}")
    src = Image.open(SOURCE).convert("RGB")
    if src.width != src.height:
        print(f"  ! source is {src.width}x{src.height}, not square — centre-cropping")
        s = min(src.size)
        src = src.crop(((src.width - s) // 2, (src.height - s) // 2,
                        (src.width - s) // 2 + s, (src.height - s) // 2 + s))
    cover = src.resize((SIZE, SIZE), Image.LANCZOS)

    png = OUT / "cover.png"
    (cover.quantize(colors=PNG_COLORS, method=Image.MEDIANCUT,
                    dither=Image.FLOYDSTEINBERG)
          .save(png, optimize=True))

    webp = OUT / "cover.webp"
    tmp = OUT / "cover.tmp.png"
    cover.save(tmp)
    try:
        subprocess.run(["cwebp", "-quiet", "-q", str(WEBP_Q), "-m", "6",
                        str(tmp), "-o", str(webp)], check=True)
    except (FileNotFoundError, subprocess.CalledProcessError):
        cover.save(webp, format="WEBP", quality=WEBP_Q, method=6)
    finally:
        tmp.unlink(missing_ok=True)

    print(f"  source {SOURCE.name}  {SOURCE.stat().st_size // 1024} KB  "
          f"{src.width}x{src.height}\n")
    for p in (webp, png):
        print(f"  wrote {p.relative_to(ROOT).as_posix():24s} {SIZE}x{SIZE} "
              f"{p.stat().st_size // 1024:>5d} KB")


if __name__ == "__main__":
    build()
