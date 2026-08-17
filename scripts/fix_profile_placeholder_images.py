from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageOps


ROOT = Path(__file__).resolve().parents[1]
STATIC = ROOT / "miniapp" / "src" / "static" / "images"


def save_jpg(img: Image.Image, dest: Path, size: tuple[int, int]) -> None:
    img = img.convert("RGB")
    img = ImageOps.fit(img, size, Image.Resampling.LANCZOS)
    dest.parent.mkdir(parents=True, exist_ok=True)
    img.save(dest, format="JPEG", quality=88, optimize=True)


def copy_from(src_name: str, dest_name: str) -> None:
    src = STATIC / src_name
    dest = STATIC / dest_name
    save_jpg(Image.open(src), dest, (360, 270))
    print(f"saved {dest.relative_to(ROOT)}")


def make_swatch(hex_color: str, dest_name: str) -> None:
    dest = STATIC / "skin" / dest_name
    dest.parent.mkdir(parents=True, exist_ok=True)
    base = Image.new("RGB", (360, 270), hex_color)
    draw = ImageDraw.Draw(base)
    for y in range(270):
        shade = int(14 * (y / 270))
        draw.line((0, y, 360, y), fill=tuple(max(0, c - shade) for c in ImageColor(hex_color)))
    base.save(dest, format="JPEG", quality=92, optimize=True)
    print(f"saved {dest.relative_to(ROOT)}")


def ImageColor(hex_color: str) -> tuple[int, int, int]:
    return tuple(int(hex_color[i : i + 2], 16) for i in (1, 3, 5))


def make_face_shape(dest_name: str, kind: str, color: str) -> None:
    dest = STATIC / "face" / dest_name
    dest.parent.mkdir(parents=True, exist_ok=True)
    img = Image.new("RGB", (360, 270), "#f7f7f8")
    draw = ImageDraw.Draw(img)
    cx, cy = 180, 135
    if kind == "oval":
        draw.ellipse((100, 55, 260, 215), fill=color)
    elif kind == "round":
        draw.ellipse((80, 35, 280, 235), fill=color)
    elif kind == "square":
        draw.rounded_rectangle((100, 55, 260, 215), radius=42, fill=color)
    elif kind == "long":
        draw.ellipse((120, 25, 240, 245), fill=color)
    elif kind == "heart":
        draw.polygon(
            [
                (180, 245),
                (75, 135),
                (90, 55),
                (180, 110),
                (270, 55),
                (285, 135),
            ],
            fill=color,
        )
        draw.ellipse((78, 48, 168, 138), fill=color)
        draw.ellipse((192, 48, 282, 138), fill=color)
    elif kind == "diamond":
        draw.polygon([(180, 45), (285, 135), (180, 245), (75, 135)], fill=color)
    img.save(dest, format="JPEG", quality=92, optimize=True)
    print(f"saved {dest.relative_to(ROOT)}")


def make_body_shape(dest_name: str, kind: str, color: str) -> None:
    dest = STATIC / "body" / dest_name
    dest.parent.mkdir(parents=True, exist_ok=True)
    img = Image.new("RGB", (200, 200), "#f7f7f8")
    draw = ImageDraw.Draw(img)
    cx = 100
    if kind == "hourglass":
        draw.ellipse((55, 25, 145, 90), fill=color)
        draw.ellipse((55, 70, 145, 175), fill=color)
        draw.rectangle((82, 75, 118, 100), fill=color)
    elif kind == "pear":
        draw.ellipse((65, 25, 135, 80), fill=color)
        draw.ellipse((40, 65, 160, 180), fill=color)
    elif kind == "rectangle":
        draw.rounded_rectangle((65, 25, 135, 180), radius=22, fill=color)
    elif kind == "apple":
        draw.ellipse((45, 55, 155, 175), fill=color)
        draw.ellipse((55, 30, 145, 95), fill=color)
    elif kind == "inverted-triangle":
        draw.polygon([(30, 25), (170, 25), (135, 180), (65, 180)], fill=color)
        draw.ellipse((70, 35, 130, 95), fill=color)
    img.save(dest, format="JPEG", quality=92, optimize=True)
    print(f"saved {dest.relative_to(ROOT)}")


def main() -> None:
    style_map = {
        "street.jpg": "closet/g1.png",
        "commute.jpg": "catalog/sc-business-1.png",
        "french.jpg": "catalog/sc-date-1.png",
        "korean.jpg": "closet/g8.png",
        "vintage.jpg": "catalog/sc-academy-2.png",
        "sport.jpg": "closet/g10.png",
    }
    for dest_name, src_name in style_map.items():
        copy_from(src_name, f"style/{dest_name}")

    skin_colors = {
        "cool-fair.jpg": "#fbe6df",
        "warm-fair.jpg": "#f7dcc4",
        "natural.jpg": "#e8c3a0",
        "wheat.jpg": "#cd9f74",
        "olive.jpg": "#b48a5f",
        "deep.jpg": "#8a5c3b",
    }
    for dest_name, color in skin_colors.items():
        make_swatch(color, dest_name)

    face_shapes = {
        "oval.jpg": ("oval", "#f5c6d0"),
        "round.jpg": ("round", "#f5c6d0"),
        "square.jpg": ("square", "#b7d3f0"),
        "long.jpg": ("long", "#b7d3f0"),
        "heart.jpg": ("heart", "#f5c6d0"),
        "diamond.jpg": ("diamond", "#d9c9f5"),
    }
    for dest_name, (kind, color) in face_shapes.items():
        make_face_shape(dest_name, kind, color)

    body_shapes = {
        "hourglass.jpg": ("hourglass", "#f5b8cf"),
        "pear.jpg": ("pear", "#b8d8ad"),
        "rectangle.jpg": ("rectangle", "#a9c8ee"),
        "apple.jpg": ("apple", "#f5c69b"),
        "inverted-triangle.jpg": ("inverted-triangle", "#c9bdf0"),
    }
    for dest_name, (kind, color) in body_shapes.items():
        make_body_shape(dest_name, kind, color)


if __name__ == "__main__":
    main()
