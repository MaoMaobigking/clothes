from pathlib import Path
import re
import time
from urllib.request import Request, urlopen

from PIL import Image, ImageDraw, ImageFont, ImageOps


ROOT = Path(__file__).resolve().parents[1]
STATIC = ROOT / "miniapp" / "src" / "static" / "images"


def read_bytes(url: str, timeout: int = 30) -> bytes:
    req = Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urlopen(req, timeout=timeout) as resp:
        return resp.read()


def save_image(dest: Path, data: bytes, size: tuple[int, int], *, contain: bool = False) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_suffix(dest.suffix + ".tmp")
    tmp.write_bytes(data)
    try:
        with Image.open(tmp) as img:
            img = ImageOps.exif_transpose(img)
            has_alpha = img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info)
            if contain:
                canvas = Image.new("RGBA", size, (0, 0, 0, 0))
                img = img.convert("RGBA")
                img.thumbnail(size, Image.Resampling.LANCZOS)
                x = (size[0] - img.width) // 2
                y = (size[1] - img.height) // 2
                canvas.paste(img, (x, y), img)
                canvas.save(dest, format="PNG", optimize=True)
            else:
                if img.mode not in ("RGB", "RGBA"):
                    img = img.convert("RGB")
                img = ImageOps.fit(img, size, method=Image.Resampling.LANCZOS)
                if dest.suffix.lower() in (".jpg", ".jpeg"):
                    img = img.convert("RGB")
                    img.save(dest, format="JPEG", quality=82, optimize=True)
                else:
                    if not has_alpha:
                        img = img.convert("RGB")
                    img.save(dest, format="PNG", optimize=True)
    finally:
        tmp.unlink(missing_ok=True)
    print(f"saved {dest.relative_to(ROOT)} {size}")


def loremflickr(dest: Path, size: tuple[int, int], keywords: str, index: int) -> None:
    w, h = size
    url = f"https://loremflickr.com/{w}/{h}/{keywords}?random={index}"
    try:
        data = read_bytes(url)
        save_image(dest, data, size)
    except Exception as exc:
        print(f"loremflickr fail {dest}: {exc}")
        time.sleep(0.4)
        data = read_bytes(f"https://loremflickr.com/{w}/{h}/fashion,clothing?random={index + 1000}")
        save_image(dest, data, size)


def pngimg_urls(gallery_slug: str, upload_slug: str) -> list[str]:
    url = f"https://pngimg.com/images/{gallery_slug}"
    html = read_bytes(url).decode("utf-8", errors="ignore")
    pattern = rf"https://pngimg\.com/uploads/{re.escape(upload_slug)}/([A-Za-z0-9_\-]+\.png)"
    files = list(dict.fromkeys(re.findall(pattern, html)))
    return [f"https://pngimg.com/uploads/{upload_slug}/{name}" for name in files if "/small/" not in name]


def pngimg_batch(
    dest_prefix: str,
    count: int,
    gallery_slug: str,
    upload_slug: str,
    size: tuple[int, int],
    start: int = 0,
) -> None:
    urls = pngimg_urls(gallery_slug, upload_slug)
    if not urls:
        raise RuntimeError(f"pngimg no images for {gallery_slug}")
    for i in range(count):
        dest = STATIC / "accessory" / f"{dest_prefix}-{i + 1}.png"
        url = urls[(start + i) % len(urls)]
        for attempt in range(3):
            try:
                data = read_bytes(url)
                save_image(dest, data, size, contain=True)
                break
            except Exception as exc:
                if attempt == 2:
                    print(f"pngimg fail {dest}: {exc}")
                time.sleep(0.5)


def ensure_logo() -> None:
    dest = STATIC / "logo.png"
    if dest.exists():
        return
    dest.parent.mkdir(parents=True, exist_ok=True)
    img = Image.new("RGBA", (512, 512), (255, 255, 255, 0))
    draw = ImageDraw.Draw(img)
    draw.rounded_rectangle((64, 64, 448, 448), radius=96, fill=(255, 92, 157, 255))
    draw.rounded_rectangle((128, 128, 384, 384), radius=72, fill=(214, 160, 255, 255))
    draw.text((180, 194), "灵", fill=(255, 255, 255, 255))
    img.save(dest, format="PNG")
    print(f"saved {dest.relative_to(ROOT)} logo")


def main() -> None:
    style_jobs = {
        "korean.jpg": ("korean,fashion,soft", (360, 270)),
        "vintage.jpg": ("vintage,fashion,retro", (360, 270)),
        "sport.jpg": ("sportswear,athleisure,outfit", (360, 270)),
    }
    for i, (name, (kw, size)) in enumerate(style_jobs.items(), 1):
        loremflickr(STATIC / "style" / name, size, kw, i)

    skin_jobs = [
        ("cool-fair.jpg", "fair skin portrait arm"),
        ("warm-fair.jpg", "warm skin portrait arm"),
        ("natural.jpg", "natural skin portrait arm"),
        ("wheat.jpg", "tan skin portrait arm"),
        ("olive.jpg", "olive skin portrait arm"),
        ("deep.jpg", "deep skin portrait arm"),
    ]
    for i, (name, kw) in enumerate(skin_jobs, 10):
        loremflickr(STATIC / "skin" / name, (360, 270), kw, i)

    face_jobs = [
        ("oval.jpg", "oval face portrait"),
        ("round.jpg", "round face portrait"),
        ("square.jpg", "square face portrait"),
        ("long.jpg", "long face portrait"),
        ("heart.jpg", "heart shaped face portrait"),
        ("diamond.jpg", "diamond face portrait"),
    ]
    for i, (name, kw) in enumerate(face_jobs, 20):
        loremflickr(STATIC / "face" / name, (360, 270), kw, i)

    body_jobs = [
        ("hourglass.jpg", "hourglass figure woman"),
        ("pear.jpg", "pear body shape woman"),
        ("rectangle.jpg", "rectangle body shape woman"),
        ("apple.jpg", "apple body shape woman"),
        ("inverted-triangle.jpg", "inverted triangle body shape woman"),
    ]
    for i, (name, kw) in enumerate(body_jobs, 30):
        loremflickr(STATIC / "body" / name, (200, 200), kw, i)

    model_jobs = [
        ("back.png", "woman fashion model back full body", (360, 560)),
        ("back-male.png", "man fashion model back full body", (360, 560)),
    ]
    for i, (name, kw, size) in enumerate(model_jobs, 40):
        loremflickr(STATIC / "model" / name, size, kw, i)

    scene_jobs = [
        ("business.png", "business formal office background", (750, 560)),
        ("date.png", "romantic dinner date background", (750, 560)),
        ("travel.png", "travel vacation beach background", (750, 560)),
        ("academy.png", "college campus academy background", (750, 560)),
        ("cosplay.png", "cosplay fantasy costume background", (750, 560)),
    ]
    for i, (name, kw, size) in enumerate(scene_jobs, 50):
        loremflickr(STATIC / "scene" / name, size, kw, i)

    catalog_jobs = {
        "sc-daily-1": "knitwear top fashion",
        "sc-daily-2": "jeans fashion",
        "sc-daily-3": "sneakers shoes",
        "sc-daily-4": "tote bag",
        "sc-daily-5": "baseball cap",
        "sc-business-1": "women blazer",
        "sc-business-2": "trousers pants",
        "sc-business-3": "heels shoes",
        "sc-business-4": "leather bag",
        "sc-business-5": "leather belt",
        "sc-date-1": "floral dress",
        "sc-date-2": "mary jane shoes",
        "sc-date-3": "chain bag",
        "sc-date-4": "pearl earrings",
        "sc-date-5": "silk scarf",
        "sc-travel-1": "linen shirt",
        "sc-travel-2": "wide leg pants",
        "sc-travel-3": "straw hat",
        "sc-travel-4": "waterproof sneakers",
        "sc-travel-5": "travel bag",
        "sc-academy-1": "knit vest",
        "sc-academy-2": "plaid skirt",
        "sc-academy-3": "loafers shoes",
        "sc-academy-4": "wool scarf",
        "sc-academy-5": "satchel bag",
        "sc-cosplay-1": "gothic skirt",
        "sc-cosplay-2": "leather vest",
        "sc-cosplay-3": "knight boots",
        "sc-cosplay-4": "choker necklace",
        "sc-cosplay-5": "lace gloves",
    }
    for i, (name, kw) in enumerate(catalog_jobs.items(), 60):
        loremflickr(STATIC / "catalog" / f"{name}.png", (400, 400), kw, i)

    closet_jobs = [
        ("g1", "oversized workwear jacket"),
        ("g2", "fur parka coat"),
        ("g3", "white t-shirt"),
        ("g4", "puff sleeve blouse"),
        ("g5", "straight trousers"),
        ("g6", "denim jeans"),
        ("g7", "corduroy skirt"),
        ("g8", "pleated skirt"),
        ("g9", "floral dress"),
        ("g10", "techwear jumpsuit"),
        ("g11", "platform sneakers"),
        ("g12", "mary jane shoes"),
        ("g13", "tote bag"),
        ("g14", "red chain bag"),
        ("g15", "knit beanie"),
        ("g16", "silver earrings"),
        ("g17", "plaid wool scarf"),
        ("g18", "shearling jacket"),
    ]
    for i, (name, kw) in enumerate(closet_jobs, 100):
        loremflickr(STATIC / "closet" / f"{name}.png", (400, 400), kw, i)

    community_jobs = [
        ("p1", "street style winter"),
        ("p2", "old clothes upcycling"),
        ("p3", "commute outfit"),
        ("p4", "vintage fashion outfit"),
        ("p5", "sweet fashion outfit"),
        ("p6", "minimalist neutral outfit"),
    ]
    for i, (name, kw) in enumerate(community_jobs, 120):
        loremflickr(STATIC / "community" / f"{name}.png", (400, 400), kw, i)

    outfit_jobs = {
        "o1-1": "knit cardigan",
        "o1-2": "vest top",
        "o1-3": "plaid shirt",
        "o1-4": "red handbag",
        "o1-5": "beanie hat",
        "o1-6": "chelsea boots",
        "o2-1": "denim jacket",
        "o2-2": "white hoodie",
        "o2-3": "cargo skirt",
        "o2-4": "canvas bag",
        "o2-5": "sneakers",
        "o3-1": "puff sleeve blouse",
        "o3-2": "floral skirt",
        "o3-3": "mary jane shoes",
        "o3-4": "pearl earrings",
    }
    for i, (name, kw) in enumerate(outfit_jobs.items(), 140):
        loremflickr(STATIC / "outfit" / f"{name}.png", (400, 400), kw, i)

    custom_jobs = {
        "body.jpg": "pregnant woman fashion dress",
        "body-1.jpg": "pregnant woman dress",
        "body-2.jpg": "inclusive blazer fashion",
        "body-3.jpg": "wheelchair friendly dress",
        "occasion.jpg": "formal event dress",
        "occasion-1.jpg": "evening gown",
        "occasion-2.jpg": "school uniform suit",
        "occasion-3.jpg": "stage performance costume",
        "specific.jpg": "cosplay costume",
        "specific-1.jpg": "cosplay costume",
        "specific-2.jpg": "doll clothes miniature",
        "specific-3.jpg": "limited fabric jacket",
        "taste.jpg": "designer fashion",
        "taste-1.jpg": "celebrity style fashion",
        "taste-2.jpg": "hand embroidery dress",
        "taste-3.jpg": "designer jacket",
    }
    for i, (name, kw) in enumerate(custom_jobs.items(), 160):
        size = (440, 500) if not name.startswith(("body-", "occasion-", "specific-", "taste-")) else (380, 310)
        loremflickr(STATIC / "custom" / name, size, kw, i)

    pngimg_batch("ac-hat", 4, "objects/hat", "hat", (400, 400))
    pngimg_batch("ac-scarf", 3, "objects/scarf", "scarf", (400, 400))
    pngimg_batch("ac-belt", 3, "objects/belt", "belt", (400, 400))
    pngimg_batch("ac-jewelry", 4, "jewelry/necklace", "necklace", (400, 400))
    pngimg_batch("ac-shoes", 4, "clothing/men_shoes", "men_shoes", (400, 400))

    ensure_logo()


if __name__ == "__main__":
    main()
