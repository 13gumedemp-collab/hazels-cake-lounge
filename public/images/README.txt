Do not drop new photographs into this folder.

Everything in images/gallery/ is generated. Those .avif, .webp and .jpg files are
built from the originals and will be overwritten, so an edit made here is lost on
the next build.

To add, remove or reorder a photograph:

  1. Put the original PNG or JPEG in            media/gallery/<category>/<slug>.png
     Categories are: cakes, cupcakes, scones, biscuits.
     Use a lowercase-hyphenated file name, for example  pink-ring-cake.png

  2. Add it to                                  scripts/gallery.json
     with its caption, kicker and alt text, in the position it should appear.

  3. From the repo root, run both of these:

        python scripts/optimise-gallery-images.py
        python scripts/build-gallery-html.py

     The first writes the responsive AVIF, WebP and JPEG sizes into
     images/gallery/. The second rewrites the My Work gallery in work.html.

The originals in media/gallery/ are deliberately outside public/, because they are
roughly 2.7 MB each and would otherwise all be uploaded with every deployment.

The only hand-maintained images left in this folder are Hazel's portraits.
