from pathlib import Path

from PIL import Image

project = Path(__file__).resolve().parents[1]
source = Path("/home/ubuntu/webdev-static-assets/amin-ka-master-icon.png")
targets = [
    project / "assets/images/icon.png",
    project / "assets/images/splash-icon.png",
    project / "assets/images/favicon.png",
    project / "assets/images/android-icon-foreground.png",
]

with Image.open(source) as original:
    icon = original.convert("RGBA")
    icon.thumbnail((512, 512), Image.Resampling.LANCZOS)
    for target in targets:
        icon.save(target, format="PNG", optimize=True, compress_level=9)
        print(f"Optimized {target.name}: {target.stat().st_size} bytes")
