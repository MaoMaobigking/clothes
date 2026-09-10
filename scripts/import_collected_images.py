"""
把自己收集的图（E:\\外包项目\\图片）按用途导入 miniapp/src/static/images/。

一次性脚本。四类共 33 张：style 6 / face 6 / body 5 / custom 16。

为什么不能直接复制过去：收集的全是竖图（宽高比 0.5–0.9），而各处卡片的
显示框比例差很远 —— style/face 是竖框(0.78)，body 是正方形，custom 两处
都是横框(1.58 / 1.23)。组件统一用 aspectFill，直接丢进去会被裁掉大半，
比如 1080×2100 的图放进 1.23 横框，只剩垂直居中那一条（腰到大腿）。

所以这里按每个位置的真实比例先裁一次，裁的时候垂直方向偏上取 —— 人像
照片的信息都在上半部分（脸、上衣），居中裁会把脸和上衣裁掉。

比例来源（rpx 值就是显示框，2x 输出）：
  style/  OptionCard preview 280×360   pages/test/StyleStep.vue preview-height=360rpx
  face/   同上
  body/   .body-preview 88×88          pages/test/BodyStep.vue
  custom/ 封面 .category-image-wrap 332×210   pages/custom/index.vue
          案例 .case-image 190×155            pages/custom/category.vue
"""

import io
import os
import sys

from PIL import Image

SRC = r"E:\外包项目\图片"
DST = r"E:\外包项目\ai服装\miniapp\src\static\images"

# face/ 收集时用的中文名 → 代码里约定的文件名（constants/questions.ts）
FACE_RENAME = {
    "鹅蛋脸": "oval",
    "圆脸": "round",
    "方脸": "square",
    "长脸": "long",
    "心形脸": "heart",
    "菱形脸": "diamond",
}

# 每类的输出规格：(目标宽, 目标高, 垂直裁切偏移比例, 大小上限KB)
# 偏移 0=贴顶 0.5=居中。人像取 0.2 左右：留一点头顶余量，又不至于把脸裁掉。
SPECS = {
    "style": (560, 720, 0.20, 200),
    "face": (560, 720, 0.15, 200),
    "body": (400, 400, 0.12, 200),
}
# custom 封面和案例是不同比例，按文件名区分：带 -N 后缀的是案例
#
# 偏移比 style/face 大得多（0.40 vs 0.15~0.20）：这两处显示框是**横的**
# （1.58 / 1.23），竖图裁横条只能取一小段。取 0.18 的话 1200×2133 那种长条
# 竖图只会剩下头肩 —— taste.jpg 第一次跑出来就是一张纯面部特写，作为
# 「品味定制」封面完全看不出是服装。0.40 让裁切窗口中心落在原图 45% 高度，
# 也就是躯干（衣服）的位置。
CUSTOM_COVER = (664, 420, 0.40, 200)
CUSTOM_CASE = (380, 310, 0.40, 200)


def trim_black_borders(img: Image.Image, threshold: int = 18) -> tuple[Image.Image, str]:
    """裁掉截图上下左右的纯黑边（korean.jpg 这类从手机截的图会有）。"""
    gray = img.convert("L")
    w, h = gray.size
    px = gray.load()

    def row_dark(y):
        return sum(px[x, y] for x in range(0, w, max(1, w // 40))) / len(range(0, w, max(1, w // 40))) < threshold

    def col_dark(x):
        return sum(px[x, y] for y in range(0, h, max(1, h // 40))) / len(range(0, h, max(1, h // 40))) < threshold

    top = 0
    while top < h // 3 and row_dark(top):
        top += 1
    bottom = h
    while bottom > h * 2 // 3 and row_dark(bottom - 1):
        bottom -= 1
    left = 0
    while left < w // 3 and col_dark(left):
        left += 1
    right = w
    while right > w * 2 // 3 and col_dark(right - 1):
        right -= 1

    if (top, left, bottom, right) == (0, 0, h, w):
        return img, ""
    note = f"去黑边 上{top} 下{h - bottom} 左{left} 右{w - right}"
    return img.crop((left, top, right, bottom)), note


def fit_to(img: Image.Image, tw: int, th: int, y_bias: float) -> Image.Image:
    """按目标比例裁切（垂直方向按 y_bias 偏上取），再缩到目标尺寸。"""
    img = img.convert("RGB")
    w, h = img.size
    target = tw / th
    current = w / h

    if current > target:
        # 原图更宽 —— 裁两侧，水平居中
        nw = round(h * target)
        x = (w - nw) // 2
        img = img.crop((x, 0, x + nw, h))
    elif current < target:
        # 原图更高 —— 裁上下，按 y_bias 偏上取
        nh = round(w / target)
        y = round((h - nh) * y_bias)
        img = img.crop((0, y, w, y + nh))

    return img.resize((tw, th), Image.LANCZOS)


def edge_color(img: Image.Image) -> tuple[int, int, int]:
    """取图片左右边缘的中位色，用来补边。比纯白/渐变底自然 —— 写真类图片
    两侧通常就是纯色背景，补上去看起来像原图本来就更宽。"""
    rgb = img.convert("RGB")
    w, h = rgb.size
    px = rgb.load()
    samples = []
    for y in range(0, h, max(1, h // 60)):
        for x in (0, 1, w - 2, w - 1):
            samples.append(px[x, y])
    samples.sort(key=lambda c: c[0] + c[1] + c[2])
    return samples[len(samples) // 2]


def pad_to(img: Image.Image, tw: int, th: int) -> Image.Image:
    """等比缩到完整放进目标框，两侧/上下用边缘色补满。

    给「显示框方向和图片方向相反」的位置用：custom 两处显示框是横的
    （1.58 / 1.23），而收集来的全是竖图。横条只能容纳长条竖图约 36% 的
    高度，裁切取哪一段都突兀 —— taste.jpg 试过取头肩（只剩一张脸）和取
    躯干（脸被切一半），都不能看。补边保完整。
    """
    img = img.convert("RGB")
    fill = edge_color(img)
    w, h = img.size
    scale = min(tw / w, th / h)
    nw, nh = max(1, round(w * scale)), max(1, round(h * scale))
    canvas = Image.new("RGB", (tw, th), fill)
    canvas.paste(img.resize((nw, nh), Image.LANCZOS), ((tw - nw) // 2, (th - nh) // 2))
    return canvas


def save_jpeg(img: Image.Image, path: str, max_kb: int) -> int:
    for q in (90, 85, 80, 74, 68, 62, 56):
        buf = io.BytesIO()
        img.save(buf, "JPEG", quality=q, optimize=True, progressive=True)
        if buf.tell() <= max_kb * 1024 or q == 56:
            os.makedirs(os.path.dirname(path), exist_ok=True)
            with open(path, "wb") as f:
                f.write(buf.getvalue())
            return buf.tell()
    raise AssertionError("unreachable")


def main() -> int:
    total, problems = 0, []

    for group in ("style", "face", "body", "custom"):
        src_dir = os.path.join(SRC, group)
        if not os.path.isdir(src_dir):
            problems.append(f"源目录不存在: {group}")
            continue

        print(f"=== {group}/ ===")
        for name in sorted(os.listdir(src_dir)):
            stem, ext = os.path.splitext(name)
            if ext.lower() not in (".jpg", ".jpeg", ".png", ".webp"):
                continue

            out_stem = FACE_RENAME.get(stem, stem) if group == "face" else stem
            if group == "face" and stem not in FACE_RENAME:
                problems.append(f"face/{name} 不在中文名映射表里，跳过")
                continue

            if group == "custom":
                tw, th, bias, cap = CUSTOM_CASE if out_stem[-2:-1] == "-" else CUSTOM_COVER
            else:
                tw, th, bias, cap = SPECS[group]

            img = Image.open(os.path.join(src_dir, name))
            w0, h0 = img.size
            img, note = trim_black_borders(img)
            w1, h1 = img.size
            out_path = os.path.join(DST, group, f"{out_stem}.jpg")
            # custom 的显示框是横的、图是竖的 —— 补边保完整；其余方向一致，裁切填满
            processed = pad_to(img, tw, th) if group == "custom" else fit_to(img, tw, th, bias)
            size = save_jpeg(processed, out_path, cap)
            total += 1

            mode = "补边" if group == "custom" else "裁切"
            renamed = f"  ←{stem}" if out_stem != stem else ""
            trimmed = f"  ({note})" if note else ""
            print(f"  {out_stem + '.jpg':26s} {w0}×{h0} → {tw}×{th} {mode}  {size // 1024:>3}KB{renamed}{trimmed}")

    print(f"\n合计落盘 {total} 张")
    if problems:
        print("\n!! 问题:")
        for p in problems:
            print("   ", p)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
