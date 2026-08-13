#!/usr/bin/env python3
"""Prepare the extracted UNO2D reference cards for browser delivery.

The source sheet contains a red registration frame and a white gutter around
each card.  The first extraction kept that frame, and the SVG wrappers loaded
the JPEG with a relative URL.  That combination is fragile in deployed
documents: some browsers leave the nested image blank and the frame becomes
visible as a red halo.  This script keeps the extracted artwork, trims the
registration frame, and embeds the optimized crop in each SVG so every card is
one self-contained asset.
"""

from __future__ import annotations

import base64
import io
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
CARD_DIR = ROOT / "web/public/assets/cards/reference"
SOURCE = CARD_DIR / "0.jpg"
CROP_DIR = CARD_DIR / "crops"
OUTPUT_SIZE = (414, 700)

# The sprite has three action cards followed by 0–9 in every color row.  The
# coordinates below are the *card interiors*, not the source registration
# frames.  Keeping the mapping here also fixes the previous extraction bug
# where the right side of 7–9 was cut off by a neighbouring sprite cell.
ROW_SPECS = {
    "red": {
        "y": (838, 1463),
        "x": [(45, 399), (498, 852), (966, 1320), (1453, 1807), (1925, 2279), (2375, 2728), (2850, 3203), (3358, 3712), (3842, 4196), (4345, 4699), (4857, 5211), (5360, 5714), (5833, 6187)],
    },
    "green": {
        "y": (1579, 2202),
        "x": [(37, 392), (490, 844), (958, 1312), (1453, 1807), (1925, 2279), (2375, 2729), (2849, 3203), (3359, 3713), (3843, 4197), (4345, 4699), (4857, 5211), (5360, 5714), (5833, 6187)],
    },
    "yellow": {
        "y": (2333, 2957),
        "x": [(31, 385), (483, 838), (952, 1306), (1453, 1807), (1925, 2279), (2374, 2729), (2849, 3203), (3358, 3712), (3842, 4196), (4345, 4699), (4857, 5211), (5360, 5714), (5833, 6187)],
    },
    "blue": {
        "y": (3081, 3705),
        "x": [(24, 378), (476, 830), (945, 1299), (1453, 1807), (1925, 2279), (2374, 2728), (2849, 3203), (3358, 3712), (3842, 4196), (4345, 4699), (4857, 5211), (5360, 5714), (5833, 6187)],
    },
}

TOP_SPECS = {
    "card-back.jpg": (2381, 25, 2736, 649),
    "wild-draw-four.jpg": (2849, 25, 3203, 649),
    "wild.jpg": (3341, 20, 3697, 657),
}


def optimized_crop(name: str, source: Image.Image) -> Image.Image:
    if name in TOP_SPECS:
        box = TOP_SPECS[name]
        crop = source.crop(box)
    else:
        color = name.split("-", 1)[0]
        row = ROW_SPECS[color]
        if name.endswith("-0.jpg"):
            index = 0
        elif name.endswith("-draw-two.jpg"):
            index = 1
        elif name.endswith("-reverse.jpg"):
            index = 2
        elif name.endswith("-zero.jpg"):
            index = 3
        else:
            index = 3 + int(name.removesuffix(".jpg").rsplit("-", 1)[1])
        x0, x1 = row["x"][index]
        y0, y1 = row["y"]
        crop = source.crop((x0, y0, x1, y1))
    # The source interior is a little narrower than the canonical web card
    # ratio.  Resizing (rather than fitting/cropping) preserves every corner
    # glyph while making all cards the same animation footprint.
    return crop.resize(OUTPUT_SIZE, Image.Resampling.LANCZOS)


def svg_name_for(crop_name: str) -> str:
    return crop_name.removesuffix(".jpg") + ".svg"


def write_svg(crop_name: str, image: Image.Image) -> None:
    encoded = io.BytesIO()
    image.save(encoded, format="JPEG", quality=94, subsampling=0, optimize=True)
    data_uri = "data:image/jpeg;base64," + base64.b64encode(encoded.getvalue()).decode("ascii")
    label = crop_name.removesuffix(".jpg").replace("-", " ")
    svg = (
        '<svg xmlns="http://www.w3.org/2000/svg" width="414" height="700" '
        'viewBox="0 0 414 700" role="img" aria-label="Reference UNO '
        f'{label} card">'
        f'<title>Reference UNO {label}</title>'
        f'<image href="{data_uri}" x="0" y="0" width="414" height="700" '
        'preserveAspectRatio="none"/>\n</svg>\n'
    )
    (CARD_DIR / svg_name_for(crop_name)).write_text(svg, encoding="utf-8")


def main() -> None:
    with Image.open(SOURCE) as sheet:
        source = sheet.convert("RGB")
        names = [
            f"{color}-{action}.jpg"
            for color in ROW_SPECS
            for action in ["0", "draw-two", "reverse", "zero", *map(str, range(1, 10))]
        ] + list(TOP_SPECS)
        for name in names:
            image = optimized_crop(name, source)
            crop_path = CROP_DIR / name
            # Keep the crop as a reviewable/provenance artifact as well as
            # embedding it in the SVG. Progressive JPEGs load quickly in the
            # asset gallery.
            image.save(crop_path, format="JPEG", quality=94, subsampling=0, optimize=True, progressive=True)
            write_svg(name, image)
    print(f"optimized {len(names)} reference cards")


if __name__ == "__main__":
    main()
