"""Export the logo in the sizes and formats other things need.

    python3 tools/export_logo.py

Source : public/OS-Omni-V6.png       1024x1024 RGBA, 1.7 MB
Writes : exports/                    local only, gitignored

Nothing on the site reads these — the page's own icons come from
tools/build_brand_assets.py. This is the folder to pull from when the logo has
to go into a slide, a paper, a README or an organisation avatar.

Every file is trimmed of the source's transparent margin, so placing one in a
document does not come with invisible padding around it. The `-square` file is
the exception: it is padded back out to a square for avatars, which are cropped
to a circle or a rounded square by whatever is displaying them.

On formats. The lossless WebP is the one to reach for: same pixels as the PNG,
about half the file. Where WebP is not accepted — LaTeX, older Office, some
journal systems — use the PNG. The JPEG is flattened onto white, for the places
that render an alpha channel as black.
"""
from pathlib import Path
import subprocess

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "public" / "OS-Omni-V6.png"
OUT = ROOT / "exports"

WIDTHS = (512, 256)      # long edge of the scaled-down copies
SQUARE = 512             # avatar size
JPEG_Q = 92


def webp(img, path, lossless=True, quality=92):
    """cwebp beats Pillow's encoder on both size and alpha handling, so shell
    out when it is available and fall back to Pillow when it is not."""
    tmp = path.with_suffix(".tmp.png")
    img.save(tmp)
    try:
        subprocess.run(
            ["cwebp", "-quiet", "-m", "6", "-alpha_q", "100"]
            + (["-lossless", "-z", "9"] if lossless else ["-q", str(quality)])
            + [str(tmp), "-o", str(path)],
            check=True)
    except (FileNotFoundError, subprocess.CalledProcessError):
        img.save(path, format="WEBP", lossless=lossless, quality=quality, method=6)
    finally:
        tmp.unlink(missing_ok=True)


def build():
    if not SOURCE.exists():
        raise SystemExit(f"source logo not found: {SOURCE}")
    OUT.mkdir(exist_ok=True)

    src = Image.open(SOURCE).convert("RGBA")
    art = src.crop(src.getbbox())          # native resolution, no resampling
    w, h = art.size
    written = []

    def scaled(long_edge):
        return art.resize((long_edge, round(h * long_edge / w)), Image.LANCZOS)

    # master, at the resolution the source actually carries
    p = OUT / "os-omni-logo.png"
    art.save(p, optimize=True); written.append(p)
    p = OUT / "os-omni-logo.webp"
    webp(art, p); written.append(p)

    # scaled copies
    for edge in WIDTHS:
        s = scaled(edge)
        p = OUT / f"os-omni-logo-{edge}.png"
        s.save(p, optimize=True); written.append(p)
        p = OUT / f"os-omni-logo-{edge}.webp"
        webp(s, p); written.append(p)

    # square, for avatars
    s = scaled(SQUARE)
    sq = Image.new("RGBA", (SQUARE, SQUARE), (0, 0, 0, 0))
    sq.paste(s, (0, (SQUARE - s.height) // 2))
    p = OUT / f"os-omni-logo-square-{SQUARE}.png"
    sq.save(p, optimize=True); written.append(p)

    # flattened onto white, for anything that paints alpha black
    flat = Image.new("RGB", art.size, (255, 255, 255))
    flat.paste(art, mask=art.split()[3])
    p = OUT / "os-omni-logo-white.jpg"
    flat.save(p, quality=JPEG_Q, optimize=True, progressive=True); written.append(p)

    src_kb = SOURCE.stat().st_size / 1024
    print(f"  source {SOURCE.name}  {src_kb:.0f} KB  {src.size[0]}x{src.size[1]}"
          f"  (content {w}x{h})\n")
    for p in written:
        im = Image.open(p)
        print(f"  {p.name:28s} {str(im.size):11s} {p.stat().st_size / 1024:>7.0f} KB"
              f"  {p.stat().st_size / SOURCE.stat().st_size * 100:>5.1f}% of source")


if __name__ == "__main__":
    build()
