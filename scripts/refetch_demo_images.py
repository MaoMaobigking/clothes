from __future__ import annotations

import re
import subprocess
import sys
import time
from pathlib import Path
from urllib.parse import quote_plus

import cv2
import numpy as np
from bs4 import BeautifulSoup
from PIL import Image, ImageOps


ROOT = Path(__file__).resolve().parents[1]
STATIC = ROOT / "miniapp" / "src" / "static" / "images"
TMP = ROOT / ".tmp"
COOKIE = TMP / "amazon-cookies.txt"
UA = (
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) "
    "AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1"
)


def curl_bytes(url: str, *, referer: str | None = None, timeout: int = 45) -> bytes:
    cmd = [
        "curl.exe",
        "--compressed",
        "-L",
        "--max-time",
        str(timeout),
        "-A",
        UA,
        "-H",
        "Accept-Language: en-US,en;q=0.9",
        "-b",
        str(COOKIE),
        "-c",
        str(COOKIE),
    ]
    if referer:
        cmd += ["-H", f"Referer: {referer}"]
    cmd += [url]
    proc = subprocess.run(cmd, cwd=ROOT, capture_output=True)
    if proc.returncode != 0:
        raise RuntimeError(f"curl failed for {url}: {proc.stderr.decode(errors='ignore')}")
    return proc.stdout


def save_source(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_bytes(data)
    tmp.replace(path)


def best_image_url(img) -> str:
    srcset = img.get("srcset") or ""
    parts = re.findall(r"(\S+?)\s+(\d+)w", srcset)
    if parts:
        return max(parts, key=lambda pair: int(pair[1]))[0]
    return img.get("src") or ""


def title_of(block) -> str:
    texts = []
    for selector in (
        "h2",
        ".a-size-base-plus.a-text-normal",
        ".a-size-medium.a-text-normal",
        ".a-size-mini.a-spacing-none.a-color-base.s-line-clamp-2",
        "img.s-image",
    ):
        for node in block.select(selector):
            text = (node.get("alt") or node.get_text(" ", strip=True))
            if text:
                texts.append(text)
    return " ".join(texts)


def amazon_search(query: str, filters: list[str]) -> tuple[str, str]:
    candidates: list[tuple[str, str, str]] = []
    for attempt in range(3):
        url = f"https://www.amazon.com/s?k={quote_plus(query)}"
        html = curl_bytes(url, referer="https://www.amazon.com/")
        soup = BeautifulSoup(html, "html.parser")
        candidates = []
        for block in soup.select("div[data-asin]"):
            asin = (block.get("data-asin") or "").strip()
            if not asin:
                continue
            img = block.select_one("img.s-image")
            if not img:
                continue
            src = best_image_url(img)
            if "m.media-amazon.com/images/I/" not in src:
                continue
            text = title_of(block).lower()
            candidates.append((text, src, asin))
        if candidates:
            break
        time.sleep(3.0 * (attempt + 1))
    if not candidates:
        raise RuntimeError(f"no Amazon results for {query}")
    if filters:
        lowered = [f.lower() for f in filters]
        for text, src, asin in candidates:
            if all(f in text for f in lowered):
                return src, text[:160]
    return candidates[0][1], candidates[0][0]


def make_transparent(path: Path) -> Image.Image:
    bgr = cv2.imdecode(np.fromfile(str(path), dtype=np.uint8), cv2.IMREAD_COLOR)
    if bgr is None:
        raise RuntimeError(f"cannot read {path}")
    max_edge = max(bgr.shape[:2])
    if max_edge > 1100:
        scale = 1100 / max_edge
        bgr = cv2.resize(bgr, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
    h, w = bgr.shape[:2]
    mask = np.zeros((h, w), np.uint8)
    rect = (int(w * 0.03), int(h * 0.03), int(w * 0.94), int(h * 0.94))
    bgd = np.zeros((1, 65), np.float64)
    fgd = np.zeros((1, 65), np.float64)
    cv2.grabCut(bgr, mask, rect, bgd, fgd, 5, cv2.GC_INIT_WITH_RECT)
    alpha = np.where((mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD), 255, 0).astype("uint8")
    alpha = cv2.erode(alpha, np.ones((3, 3), np.uint8), iterations=1)
    rgba = cv2.cvtColor(bgr, cv2.COLOR_BGR2BGRA)
    rgba[:, :, 3] = alpha
    return Image.fromarray(rgba, "RGBA")


def save_final(dest: Path, data: bytes, size: tuple[int, int], *, transparent: bool = False) -> None:
    raw = dest.with_suffix(dest.suffix + ".source")
    raw.parent.mkdir(parents=True, exist_ok=True)
    raw.write_bytes(data)
    if transparent:
        img = make_transparent(raw)
        img = ImageOps.contain(img, size, Image.Resampling.LANCZOS)
        canvas = Image.new("RGBA", size, (0, 0, 0, 0))
        canvas.paste(img, ((size[0] - img.width) // 2, (size[1] - img.height) // 2), img)
        canvas.save(dest, format="PNG", optimize=True)
    else:
        with Image.open(raw) as src:
            src = ImageOps.exif_transpose(src)
            src = ImageOps.fit(src, size, Image.Resampling.LANCZOS)
            if src.mode not in ("RGB", "RGBA"):
                src = src.convert("RGB")
            if dest.suffix.lower() in (".jpg", ".jpeg"):
                src = src.convert("RGB")
                src.save(dest, format="JPEG", quality=88, optimize=True)
            else:
                src.save(dest, format="PNG", optimize=True)
    raw.unlink(missing_ok=True)
    print(f"saved {dest.relative_to(ROOT)}")


def run_job(
    dest_rel: str,
    query: str,
    size: tuple[int, int],
    *,
    filters: list[str] | None = None,
    transparent: bool = False,
) -> None:
    dest = STATIC / dest_rel
    src, matched_title = amazon_search(query, filters or [])
    print(f"matched {dest_rel}: {matched_title}")
    data = curl_bytes(src, referer="https://www.amazon.com/", timeout=45)
    save_final(dest, data, size, transparent=transparent)
    time.sleep(1.2)


CATALOG = [
    ("catalog/sc-daily-1.png", "women's knit sweater basic", (400, 400)),
    ("catalog/sc-daily-2.png", "women's straight leg jeans", (400, 400)),
    ("catalog/sc-daily-3.png", "retro running sneakers", (400, 400)),
    ("catalog/sc-daily-4.png", "colorblock tote bag", (400, 400)),
    ("catalog/sc-daily-5.png", "tweed baseball cap", (400, 400)),
    ("catalog/sc-business-1.png", "women's tailored blazer", (400, 400)),
    ("catalog/sc-business-2.png", "women's cropped ankle trousers", (400, 400)),
    ("catalog/sc-business-3.png", "women's pointed toe low heel pumps", (400, 400)),
    ("catalog/sc-business-4.png", "minimalist work tote bag", (400, 400)),
    ("catalog/sc-business-5.png", "thin metal buckle belt women", (400, 400)),
    ("catalog/sc-date-1.png", "floral tea dress", (400, 400)),
    ("catalog/sc-date-2.png", "pearl mary jane shoes", (400, 400)),
    ("catalog/sc-date-3.png", "vintage chain handbag", (400, 400)),
    ("catalog/sc-date-4.png", "pearl earrings", (400, 400)),
    ("catalog/sc-date-5.png", "sheer silk scarf", (400, 400)),
    ("catalog/sc-travel-1.png", "women's lightweight UPF shirt", (400, 400)),
    ("catalog/sc-travel-2.png", "women's wide leg palazzo pants", (400, 400)),
    ("catalog/sc-travel-3.png", "straw sun hat", (400, 400)),
    ("catalog/sc-travel-4.png", "waterproof lightweight shoes women", (400, 400)),
    ("catalog/sc-travel-5.png", "foldable travel duffel bag", (400, 400)),
    ("catalog/sc-academy-1.png", "women's knit vest preppy", (400, 400)),
    ("catalog/sc-academy-2.png", "plaid pleated skirt", (400, 400)),
    ("catalog/sc-academy-3.png", "women's loafers", (400, 400)),
    ("catalog/sc-academy-4.png", "plaid wool scarf", (400, 400)),
    ("catalog/sc-academy-5.png", "messenger bag", (400, 400)),
    ("catalog/sc-cosplay-1.png", "gothic mesh skirt", (400, 400)),
    ("catalog/sc-cosplay-2.png", "women's leather corset vest", (400, 400)),
    ("catalog/sc-cosplay-3.png", "knee high riding boots women", (400, 400)),
    ("catalog/sc-cosplay-4.png", "gothic choker necklace", (400, 400)),
    ("catalog/sc-cosplay-5.png", "lace gloves women", (400, 400)),
]

CLOSET = [
    ("closet/g1.png", "women's oversized workwear jacket", (400, 400)),
    ("closet/g2.png", "fur hood parka coat women", (400, 400)),
    ("closet/g3.png", "white t-shirt", (400, 400)),
    ("closet/g4.png", "puff sleeve blouse women", (400, 400)),
    ("closet/g5.png", "women's straight leg dress pants", (400, 400)),
    ("closet/g6.png", "washed denim jeans", (400, 400)),
    ("closet/g7.png", "corduroy skirt women", (400, 400)),
    ("closet/g8.png", "pleated mini skirt", (400, 400)),
    ("closet/g9.png", "floral dress", (400, 400)),
    ("closet/g10.png", "techwear jumpsuit women", (400, 400)),
    ("closet/g11.png", "platform sneakers", (400, 400)),
    ("closet/g12.png", "mary jane shoes women", (400, 400)),
    ("closet/g13.png", "work tote bag", (400, 400)),
    ("closet/g14.png", "red chain bag", (400, 400)),
    ("closet/g15.png", "knit beanie", (400, 400)),
    ("closet/g16.png", "silver earrings", (400, 400)),
    ("closet/g17.png", "plaid wool scarf", (400, 400)),
    ("closet/g18.png", "sherpa jacket women", (400, 400)),
]

OUTFIT = [
    ("outfit/o1-1.png", "knit cardigan", (400, 400)),
    ("outfit/o1-2.png", "vest top", (400, 400)),
    ("outfit/o1-3.png", "plaid shirt", (400, 400)),
    ("outfit/o1-4.png", "red handbag", (400, 400)),
    ("outfit/o1-5.png", "beanie hat", (400, 400)),
    ("outfit/o1-6.png", "chelsea boots", (400, 400)),
    ("outfit/o2-1.png", "denim jacket", (400, 400)),
    ("outfit/o2-2.png", "white hoodie", (400, 400)),
    ("outfit/o2-3.png", "cargo skirt", (400, 400)),
    ("outfit/o2-4.png", "canvas tote bag", (400, 400)),
    ("outfit/o2-5.png", "sneakers", (400, 400)),
    ("outfit/o3-1.png", "puff sleeve blouse", (400, 400)),
    ("outfit/o3-2.png", "floral skirt", (400, 400)),
    ("outfit/o3-3.png", "mary jane shoes", (400, 400)),
    ("outfit/o3-4.png", "pearl earrings", (400, 400)),
]

COMMUNITY = [
    ("community/p1.png", "petite winter outfit street style", (400, 400)),
    ("community/p2.png", "upcycled sweater vest", (400, 400)),
    ("community/p3.png", "workwear commute outfit", (400, 400)),
    ("community/p4.png", "vintage plaid leather outfit", (400, 400)),
    ("community/p5.png", "women street style fashion outfit", (400, 400)),
    ("community/p6.png", "neutral minimalist outfit", (400, 400)),
]

CUSTOM = [
    ("custom/body.jpg", "pregnant woman fashion dress", (440, 500)),
    ("custom/body-1.jpg", "pregnant woman maternity dress", (380, 310)),
    ("custom/body-2.jpg", "inclusive women's blazer", (380, 310)),
    ("custom/body-3.jpg", "wheelchair friendly long dress", (380, 310)),
    ("custom/occasion.jpg", "formal evening gown", (440, 500)),
    ("custom/occasion-1.jpg", "evening gown formal", (380, 310)),
    ("custom/occasion-2.jpg", "school uniform suit", (380, 310)),
    ("custom/occasion-3.jpg", "stage performance costume", (380, 310)),
    ("custom/specific.jpg", "cosplay costume", (440, 500)),
    ("custom/specific-1.jpg", "cosplay costume", (380, 310)),
    ("custom/specific-2.jpg", "doll clothes", (380, 310)),
    ("custom/specific-3.jpg", "limited edition fashion jacket", (380, 310)),
    ("custom/taste.jpg", "designer fashion outfit", (440, 500)),
    ("custom/taste-1.jpg", "red carpet fashion dress", (380, 310)),
    ("custom/taste-2.jpg", "hand embroidery dress", (380, 310)),
    ("custom/taste-3.jpg", "designer blazer jacket", (380, 310)),
]

ACCESSORIES = [
    ("accessory/ac-jewelry-1.png", "pearl stud earrings", (400, 400), ["pearl", "earrings"]),
    ("accessory/ac-jewelry-2.png", "geometric silver necklace", (400, 400), ["necklace"]),
    ("accessory/ac-jewelry-3.png", "hoop earrings women", (400, 400), ["earrings"]),
    ("accessory/ac-jewelry-4.png", "pearl hair clip", (400, 400), ["pearl"]),
    ("accessory/ac-hat-1.png", "knit beanie", (400, 400), ["beanie"]),
    ("accessory/ac-hat-2.png", "beret", (400, 400), ["beret"]),
    ("accessory/ac-hat-3.png", "basic baseball cap", (400, 400), ["cap"]),
    ("accessory/ac-hat-4.png", "bucket hat", (400, 400), ["bucket"]),
    ("accessory/ac-scarf-1.png", "plaid wool scarf", (400, 400), ["scarf"]),
    ("accessory/ac-scarf-2.png", "sheer silk scarf", (400, 400), ["scarf"]),
    ("accessory/ac-scarf-3.png", "cashmere shawl", (400, 400), ["shawl"]),
    ("accessory/ac-belt-1.png", "thin women's belt", (400, 400), ["belt"]),
    ("accessory/ac-belt-2.png", "metal buckle belt women", (400, 400), ["belt"]),
    ("accessory/ac-belt-3.png", "braided belt women", (400, 400), ["belt"]),
    ("accessory/ac-shoes-1.png", "white platform sneakers", (400, 400), ["sneakers"]),
    ("accessory/ac-shoes-2.png", "mary jane flats women", (400, 400), ["mary jane"]),
    ("accessory/ac-shoes-3.png", "chelsea boots women", (400, 400), ["chelsea"]),
    ("accessory/ac-shoes-4.png", "square toe loafers women", (400, 400), ["loafers"]),
]


def main() -> None:
    group = sys.argv[1] if len(sys.argv) > 1 else "all"
    start = int(sys.argv[2]) if len(sys.argv) > 2 else 0
    end = int(sys.argv[3]) if len(sys.argv) > 3 else 10**6
    jobs: list[tuple] = []
    if group in ("all", "catalog"):
        jobs += CATALOG
    if group in ("all", "closet"):
        jobs += CLOSET
    if group in ("all", "outfit"):
        jobs += OUTFIT
    if group in ("all", "community"):
        jobs += COMMUNITY
    if group in ("all", "custom"):
        jobs += CUSTOM
    if group in ("all", "accessory"):
        jobs += [
            (path, query, size, filters)
            for path, query, size, filters in ACCESSORIES
        ]
    for i, job in enumerate(jobs[start:end], start=start):
        if len(job) == 4:
            path, query, size, filters = job
            run_job(path, query, size, filters=filters, transparent=True)
        else:
            path, query, size = job
            run_job(path, query, size)
        print(f"progress {i + 1}/{len(jobs)}")


if __name__ == "__main__":
    main()
