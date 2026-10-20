from pathlib import Path
from PIL import Image

for p in Path("assets/projects").rglob("*.jpg"):
    img = Image.open(p)
    img.save(p.with_suffix(".webp"), "WEBP", quality=80)
    print(p, "->", p.with_suffix(".webp").name)