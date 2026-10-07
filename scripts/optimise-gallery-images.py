#!/usr/bin/env python3
"""Build the responsive derivatives every product photograph on the site is served from.

Hazel supplies ~2.7 MB RGBA PNGs, around 165 MB across the whole gallery, which is
why /work used to crawl. None of them actually carries any transparency, so dropping
the alpha channel is lossless and modern codecs handle the rest.

Sources live in       media/gallery/<category>/<slug>.png   (not shipped)
Derivatives land in   public/images/gallery/<slug>-<w>.<ext> (shipped)

For every photograph this writes:

  <slug>-<width>.avif   the primary format (Chrome 85+, Firefox 93+, Safari 16.4+)
  <slug>-<width>.webp   the fallback (Safari 14+, and everything else modern)
  <slug>-720.jpg        the last-resort <img src> for genuinely old browsers
  <slug>-1080.jpg       the same, and what social preview scrapers are pointed at
                        (Facebook and WhatsApp do not reliably read AVIF or WebP)

Widths are capped at the native width so nothing is ever upscaled.

Run from the repo root:
    python scripts/optimise-gallery-images.py

It is idempotent: a derivative newer than its source is skipped. Requires Pillow 11.3
or newer, for AVIF. After running it, regenerate the markup with
scripts/build-gallery-html.py.
"""

from __future__ import annotations

import json
import os
import sys
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

from PIL import Image, features

ROOT = Path(__file__).resolve().parent.parent
SRC_DIR = ROOT / "media" / "gallery"
OUT_DIR = ROOT / "public" / "images" / "gallery"
MANIFEST = ROOT / "scripts" / "gallery.json"
BUILT = ROOT / "scripts" / "gallery-built.json"

WIDTHS = (480, 720, 1080, 1440)
JPEG_WIDTHS = (720, 1080)

# Checked against a magnified crop of the caramel chocolate cake: at these settings
# the AVIF is indistinguishable from a Lanczos reference at roughly one sixteenth of
# the bytes. The largest width gets a little extra because that is what the lightbox
# shows full screen.
AVIF_QUALITY = 65
AVIF_QUALITY_LARGEST = 72
WEBP_QUALITY = 84
JPEG_QUALITY = 86

# Encoder effort. AVIF speed 6 and WebP method 4 land within a couple of percent of
# the slowest settings while finishing the whole gallery in minutes rather than hours,
# which matters because this runs on the user's laptop.
AVIF_SPEED = 6
WEBP_METHOD = 4


def stale(out: Path, src: Path) -> bool:
    return not out.exists() or out.stat().st_mtime < src.stat().st_mtime


def build(category: str, slug: str) -> dict:
    src = SRC_DIR / category / f"{slug}.png"
    if not src.exists():
        raise SystemExit(f"missing source: {src.relative_to(ROOT)}")

    im = Image.open(src)
    native_w, native_h = im.size
    im = im.convert("RGB")

    widths = sorted({min(w, native_w) for w in WIDTHS})
    largest = widths[-1]

    for w in widths:
        h = round(native_h * w / native_w)
        resized = im if w == native_w else im.resize((w, h), Image.LANCZOS)

        avif = OUT_DIR / f"{slug}-{w}.avif"
        if stale(avif, src):
            resized.save(
                avif, "AVIF",
                quality=AVIF_QUALITY_LARGEST if w == largest else AVIF_QUALITY,
                speed=AVIF_SPEED,
            )

        webp = OUT_DIR / f"{slug}-{w}.webp"
        if stale(webp, src):
            resized.save(webp, "WEBP", quality=WEBP_QUALITY, method=WEBP_METHOD)

        if w in JPEG_WIDTHS:
            jpg = OUT_DIR / f"{slug}-{w}.jpg"
            if stale(jpg, src):
                resized.save(
                    jpg, "JPEG",
                    quality=JPEG_QUALITY, progressive=True, optimize=True, subsampling=1,
                )

    return {
        "slug": slug,
        "category": category,
        "width": native_w,
        "height": native_h,
        "widths": widths,
    }


def _build_one(job: tuple[str, str]) -> dict:
    return build(*job)


def main() -> int:
    if not features.check("avif"):
        print("Pillow has no AVIF support. Install Pillow 11.3 or newer.", file=sys.stderr)
        return 1

    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    wanted: list[tuple[str, str]] = []
    for cat in manifest["categories"]:
        for item in cat["items"]:
            wanted.append((cat["id"], item["slug"]))

    seen = [s for _, s in wanted]
    dupes = {s for s in seen if seen.count(s) > 1}
    if dupes:
        print(f"duplicate slugs in gallery.json: {sorted(dupes)}", file=sys.stderr)
        return 1

    on_disk = {
        (p.parent.name, p.stem)
        for p in SRC_DIR.glob("*/*.png")
    }
    missing = on_disk - set(wanted)
    if missing:
        print("sources present but not listed in gallery.json:", file=sys.stderr)
        for cat, slug in sorted(missing):
            print(f"  {cat}/{slug}", file=sys.stderr)
        return 1

    # Each photograph is independent, and encoding is entirely CPU bound.
    built = []
    workers = max(1, (os.cpu_count() or 2) - 1)
    with ProcessPoolExecutor(max_workers=workers) as pool:
        for i, rec in enumerate(pool.map(_build_one, wanted), 1):
            built.append(rec)
            print(f"  [{i:2d}/{len(wanted)}] {rec['category']}/{rec['slug']}", flush=True)

    BUILT.write_text(json.dumps(built, indent=1) + "\n", encoding="utf-8")

    before = sum((SRC_DIR / c / f"{s}.png").stat().st_size for c, s in wanted)
    files = [p for p in OUT_DIR.iterdir() if p.is_file()]
    after = sum(p.stat().st_size for p in files)
    print(f"\n{len(built)} photographs")
    print(f"  originals   {before / 1048576:8.1f} MB  (media/gallery, not deployed)")
    print(f"  derivatives {after / 1048576:8.1f} MB across {len(files)} files")
    print(f"  built       {BUILT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
