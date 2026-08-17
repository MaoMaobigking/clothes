from pathlib import Path
from urllib.request import Request, urlopen

from PIL import Image, ImageOps


ROOT = Path(__file__).resolve().parents[1]
STATIC = ROOT / "miniapp" / "src" / "static" / "images"


def download(url: str, dest: Path, size: tuple[int, int]) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_suffix(dest.suffix + ".tmp")
    req = Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urlopen(req, timeout=30) as resp, tmp.open("wb") as fh:
        fh.write(resp.read())
    with Image.open(tmp) as img:
        img = ImageOps.exif_transpose(img)
        if img.mode not in ("RGB", "RGBA"):
            img = img.convert("RGB")
        img = ImageOps.fit(img, size, method=Image.Resampling.LANCZOS)
        if dest.suffix.lower() in (".jpg", ".jpeg"):
            img = img.convert("RGB")
            img.save(dest, format="JPEG", quality=88, optimize=True)
        else:
            img.save(dest, format="PNG", optimize=True)
    tmp.unlink(missing_ok=True)
    print(f"saved {dest.relative_to(ROOT)} {size}")


def main() -> None:
    jobs = [
        (
            "https://images.pexels.com/photos/35345380/pexels-photo-35345380.jpeg?auto=compress&cs=tinysrgb&w=800",
            STATIC / "style" / "street.jpg",
            (360, 270),
        ),
        (
            "https://images.pexels.com/photos/29636807/pexels-photo-29636807.jpeg?auto=compress&cs=tinysrgb&w=800",
            STATIC / "style" / "commute.jpg",
            (360, 270),
        ),
        (
            "https://images.pexels.com/photos/32645913/pexels-photo-32645913.jpeg?auto=compress&cs=tinysrgb&w=800",
            STATIC / "style" / "french.jpg",
            (360, 270),
        ),
        (
            "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=900&q=80",
            STATIC / "model" / "front.png",
            (360, 560),
        ),
        (
            "https://images.pexels.com/photos/34789136/pexels-photo-34789136.jpeg?auto=compress&cs=tinysrgb&w=800",
            STATIC / "model" / "front-male.png",
            (360, 560),
        ),
        (
            "https://images.pexels.com/photos/29636807/pexels-photo-29636807.jpeg?auto=compress&cs=tinysrgb&w=900",
            STATIC / "model" / "outfit.png",
            (360, 560),
        ),
        (
            "https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=1200&q=80",
            STATIC / "scene" / "daily.png",
            (750, 560),
        ),
    ]

    for url, dest, size in jobs:
        download(url, dest, size)


if __name__ == "__main__":
    main()
