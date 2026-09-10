"""
把客户素材按用途导入 miniapp/src/static/images/。

一次性脚本，跑完即可删。做三件事：
  1. model/    4 张人台（正/背 × 女/男）+ 1 张搭配展示台
  2. scene/    10 张空场景，文件名换成新的场景 key
  3. lookbook/ 60 张成套 look（平铺 + 模特上身正/背）

所有图统一转 JPEG 并压到规格上限（docs/图片素材清单.md：
单张 ≤200KB，人台图 ≤500KB），避免小程序主包超限。
"""

import io
import os
import re
import sys

from PIL import Image

SRC = r"E:\外包项目\云想衣裳app图片"
DST = r"E:\外包项目\ai服装\miniapp\src\static\images"

# 场景图源文件名（不含扩展名） → 新场景 key。顺序与 SCENE_DEFINITIONS 一致。
SCENE_MAP = {
    "1、地铁": "subway",
    "2、车站": "station",
    "3、工位": "desk",
    "4、会议室": "meeting",
    "5、西餐厅": "restaurant",
    "6、大厅": "lobby",
    "7、咖啡厅": "cafe",
    "8、露天餐厅": "terrace",
    "9、宴会厅": "banquet",
    "10、酒吧": "bar",
}

# 被新素材顶掉的旧占位图（.image-backup/ 里有备份）
SCENE_OBSOLETE = ["daily", "business", "date", "travel", "academy", "cosplay"]


def save(img: Image.Image, out_path: str, long_edge: int, max_kb: int) -> int:
    """等比缩到长边 long_edge，再降质量直到不超过 max_kb。返回落盘字节数。"""
    img = img.convert("RGB")
    w, h = img.size
    if max(w, h) > long_edge:
        scale = long_edge / max(w, h)
        img = img.resize((round(w * scale), round(h * scale)), Image.LANCZOS)

    for quality in (88, 82, 76, 70, 64, 58, 52):
        buf = io.BytesIO()
        img.save(buf, "JPEG", quality=quality, optimize=True, progressive=True)
        if buf.tell() <= max_kb * 1024 or quality == 52:
            os.makedirs(os.path.dirname(out_path), exist_ok=True)
            with open(out_path, "wb") as f:
                f.write(buf.getvalue())
            return buf.tell()
    raise AssertionError("unreachable")


def find(subdir: str, stem: str) -> str | None:
    """在源子目录里按主文件名找图，忽略扩展名大小写（源里 .jpg/.JPG 混着来）。"""
    d = os.path.join(SRC, subdir)
    for name in os.listdir(d):
        base, ext = os.path.splitext(name)
        if base == stem and ext.lower() in (".jpg", ".jpeg", ".png"):
            return os.path.join(d, name)
    return None


def main() -> int:
    done: list[tuple[str, int]] = []
    missing: list[str] = []

    def emit(src_path: str | None, rel_out: str, long_edge: int, max_kb: int, label: str):
        if not src_path:
            missing.append(label)
            return
        size = save(Image.open(src_path), os.path.join(DST, *rel_out.split("/")), long_edge, max_kb)
        done.append((rel_out, size))

    # ---------- 1. 人台 ----------
    # 人台图放宽到 500KB：AvatarViewer 会把它竖切成 24 片横向缩放，
    # 压太狠边缘会出现可见的阶梯。
    for stem, out in (
        ("女正", "front"),
        ("女背", "back"),
        ("男正", "front-male"),
        ("男背", "back-male"),
    ):
        emit(find("1、模特", stem), f"model/{out}.jpg", 1300, 500, f"1、模特/{stem}")

    # 搭配展示台：用第 1 套的模特上身正面图
    emit(find("3、模特着衣", "1、女正"), "model/outfit.jpg", 1300, 500, "3、模特着衣/1、女正")

    # ---------- 2. 场景 ----------
    for stem, key in SCENE_MAP.items():
        emit(find("2、场景", stem), f"scene/{key}.jpg", 1200, 200, f"2、场景/{stem}")

    # ---------- 3. lookbook ----------
    # 平铺图 1..30
    for n in range(1, 31):
        emit(find("4、衣橱衣物", str(n)), f"lookbook/look-{n:02d}-flat.jpg", 1200, 200, f"4、衣橱衣物/{n}")

    # 模特上身 1..15，女 1-7 / 男 8-15。
    # 源文件名是 `NN、性别朝向.JPG`，但 15 号背面漏了顿号（`15男背.JPG`），
    # 所以用正则扫目录建索引，而不是拼字符串。
    worn: dict[tuple[int, str], str] = {}
    worn_dir = os.path.join(SRC, "3、模特着衣")
    pattern = re.compile(r"^(\d+)、?[男女](正|背)$")
    for name in os.listdir(worn_dir):
        base, ext = os.path.splitext(name)
        if ext.lower() not in (".jpg", ".jpeg"):
            continue
        m = pattern.match(base)
        if m:
            worn[(int(m.group(1)), m.group(2))] = os.path.join(worn_dir, name)

    for n in range(1, 16):
        for zh, out in (("正", "front"), ("背", "back")):
            emit(worn.get((n, zh)), f"lookbook/look-{n:02d}-{out}.jpg", 1200, 200, f"3、模特着衣/{n}、*{zh}")

    # ---------- 4. 清掉被顶掉的旧场景图 ----------
    removed = []
    for key in SCENE_OBSOLETE:
        p = os.path.join(DST, "scene", f"{key}.jpg")
        if os.path.exists(p):
            os.remove(p)
            removed.append(f"scene/{key}.jpg")

    # ---------- 报告 ----------
    out = sys.stdout
    print(f"落盘 {len(done)} 张：", file=out)
    for group in ("model/", "scene/", "lookbook/"):
        rows = [(r, s) for r, s in done if r.startswith(group)]
        if not rows:
            continue
        biggest = max(rows, key=lambda x: x[1])
        print(
            f"  {group:10s} {len(rows):3d} 张 | 合计 {sum(s for _, s in rows) / 1024 / 1024:.1f}MB"
            f" | 最大 {biggest[0].split('/')[-1]} {biggest[1] // 1024}KB",
            file=out,
        )
    print(f"\n删除旧占位图 {len(removed)} 张: {', '.join(removed)}", file=out)
    if missing:
        print(f"\n!! 源文件没找到 {len(missing)} 个:", file=out)
        for m in missing:
            print("   ", m, file=out)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
