#!/usr/bin/env python3
"""Generate the web wallpaper without changing its dimensions or source PNG.

Requires Pillow. Run: python3 duo/source/prepare-wallpaper.py
"""

from pathlib import Path

from PIL import Image


assets = Path(__file__).resolve().parent.parent / "assets"
source = assets / "wallpaper-raccoon.png"
output = assets / "wallpaper-raccoon.webp"

with Image.open(source) as image:
    image.convert("RGB").save(output, "WEBP", quality=94, method=6)

print(f"Saved {output.name}: {output.stat().st_size:,} bytes")
