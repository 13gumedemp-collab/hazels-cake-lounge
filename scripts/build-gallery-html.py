#!/usr/bin/env python3
"""Regenerate the My Work gallery markup from scripts/gallery.json.

The gallery is 62 photographs, so hand-maintaining 62 blocks of <picture> markup is
how width/height attributes drift and layout shift creeps back in. This writes the
whole thing from the manifest instead, between the two markers in work.html:

    <!-- GALLERY:START -->  ... generated ...  <!-- GALLERY:END -->
    <!-- GALLERYFILTER:START --> ... generated ... <!-- GALLERYFILTER:END -->

Run from the repo root, after scripts/optimise-gallery-images.py:
    python scripts/build-gallery-html.py
"""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MANIFEST = ROOT / "scripts" / "gallery.json"
BUILT = ROOT / "scripts" / "gallery-built.json"
WORK = ROOT / "work.html"

# The gallery is a CSS multi-column masonry: one column under 520px, two under 900px,
# three above. These match the padding and gap in the .workgallery rules in styles.css,
# so the browser picks the smallest file that still covers the rendered column.
SIZES = (
    "(max-width: 520px) calc(100vw - 2.8rem), "
    "(max-width: 900px) calc((100vw - 6rem) / 2), "
    "calc((100vw - 10rem) / 3)"
)


def srcset(slug: str, widths: list[int], ext: str) -> str:
    return ", ".join(f"/images/gallery/{slug}-{w}.{ext} {w}w" for w in widths)


def figure(item: dict, built: dict, index: int, eager: bool) -> str:
    slug = item["slug"]
    widths = built["widths"]
    largest = widths[-1]
    cap = item["caption"]
    # An eager first row stops the top of the gallery flashing empty; everything
    # below the fold waits until it is near the viewport.
    loading = 'fetchpriority="high"' if eager else 'loading="lazy"'
    return f"""      <figure class="work-item reveal-card" data-slug="{slug}" data-max="{largest}"
              data-caption="{cap}" data-kicker="{item['kicker']}" data-alt="{item['alt']}">
        <picture>
          <source type="image/avif" srcset="{srcset(slug, widths, 'avif')}" sizes="{SIZES}" />
          <source type="image/webp" srcset="{srcset(slug, widths, 'webp')}" sizes="{SIZES}" />
          <img src="/images/gallery/{slug}-720.jpg" width="{built['width']}" height="{built['height']}"
               alt="{item['alt']}" decoding="async" {loading} />
        </picture>
        <button class="work-item__open" type="button" data-work-open="{index}"
                aria-label="View {cap} larger"></button>
        <figcaption><span>{cap}</span><em>{item['kicker']}</em></figcaption>
      </figure>
"""


def main() -> int:
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    built = {b["slug"]: b for b in json.loads(BUILT.read_text(encoding="utf-8"))}

    filters = ['      <button class="workfilter__btn is-active" data-cat="all" data-cursor="link">Everything</button>']
    groups = []
    index = 0

    for cat in manifest["categories"]:
        filters.append(
            f'      <button class="workfilter__btn" data-cat="{cat["id"]}" '
            f'data-cursor="link">{cat["filter"]}</button>'
        )
        figures = []
        for item in cat["items"]:
            b = built.get(item["slug"])
            if b is None:
                raise SystemExit(
                    f"{item['slug']} has no derivatives. "
                    "Run scripts/optimise-gallery-images.py first."
                )
            # Only the very first few images are worth fetching eagerly.
            figures.append(figure(item, b, index, eager=index < 3))
            index += 1

        groups.append(
            f"""    <div class="workgroup" data-cat="{cat['id']}">
    <div class="workcat reveal-up">
      <h2 class="workcat__title">{cat['title']}</h2>
      <p class="workcat__sub">{cat['sub']}</p>
      <span class="workcat__rule"></span>
    </div>
    <section class="workgallery">
{''.join(figures)}    </section>
    </div>
"""
        )

    html = WORK.read_text(encoding="utf-8")

    def replace(marker: str, body: str, indent: int, source: str) -> str:
        pattern = re.compile(
            rf"(<!-- {marker}:START -->\n).*?(<!-- {marker}:END -->)",
            re.S,
        )
        if not pattern.search(source):
            raise SystemExit(f"markers for {marker} not found in work.html")
        tail = "\n" + " " * indent
        return pattern.sub(lambda m: m.group(1) + body + tail + m.group(2), source)

    html = replace("GALLERYFILTER", "\n".join(filters), 6, html)
    html = replace("GALLERY", "".join(groups).rstrip("\n"), 4, html)
    WORK.write_text(html, encoding="utf-8")

    print(f"work.html rebuilt: {index} photographs in {len(manifest['categories'])} categories")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
