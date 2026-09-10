"""
把 scene_catalog 的 30 件新品从旧的六场景重新分组到新的十场景。

一次性脚本，跑完即可删。改两处：
  1. server/seeds/scene-catalog.json —— id / sceneKey / imageUrl
  2. miniapp/src/static/images/catalog/ —— 文件名跟着新 id 改

商品本身不动：name / price / taobaoUrl / taokouling / season / keywords /
from / to / emoji 全部原样保留。淘口令属于商品不属于场景，换了分组也不该改。

分组原则：每件商品归到「slots 包含它的 category、且语义最近」的那个场景。
不强求每场景件数相同 —— planner 的 catalogPool 按 category 过滤后用
pickWithRotation 轮转，池子里有几件都行，多几件反而让三套方案有变化。
"""

import json
import os
import sys

ROOT = r"E:\外包项目\ai服装"
SEED = os.path.join(ROOT, "server", "seeds", "scene-catalog.json")
IMG_DIR = os.path.join(ROOT, "miniapp", "src", "static", "images", "catalog")

# 新场景 → 该场景的商品（按旧 id 列出，顺序即新序号）。
# 注释里标的是 category，必须落在 server/constants/scene.mjs 里该场景的 slots 内。
REGROUP = {
    # slots: top, pants, shoes
    "subway": ["sc-daily-2", "sc-daily-3"],  # pants 牛仔裤 / shoes 跑鞋
    # slots: top, pants, bag
    "station": ["sc-travel-1", "sc-travel-2", "sc-travel-5"],  # top 衬衫 / pants 阔腿裤 / bag 行李包
    # slots: top, pants, shoes
    "desk": ["sc-academy-1", "sc-business-2", "sc-academy-3"],  # top 针织背心 / pants 烟管裤 / shoes 乐福鞋
    # slots: top, bag, shoes
    "meeting": ["sc-business-1", "sc-business-4", "sc-business-3"],  # top 西装 / bag 通勤包 / shoes 低跟鞋
    # slots: dress, bag, accessory
    "restaurant": ["sc-date-3", "sc-date-5", "sc-cosplay-5"],  # bag 链条包 / accessory 围巾 / accessory 手袖
    # slots: top, shoes, bag
    "lobby": ["sc-academy-5", "sc-daily-4"],  # bag 邮差包 / bag 托特包
    # slots: top, shoes, accessory
    "cafe": ["sc-daily-1", "sc-business-5", "sc-academy-4"],  # top 针织衫 / accessory 腰带 / accessory 围巾
    # slots: skirt, shoes, hat
    "terrace": ["sc-academy-2", "sc-travel-4", "sc-travel-3", "sc-daily-5"],  # skirt / shoes / hat×2
    # slots: dress, shoes, jewelry
    "banquet": ["sc-date-1", "sc-date-2", "sc-date-4", "sc-cosplay-4"],  # dress / shoes / jewelry×2
    # slots: top, skirt, shoes
    "bar": ["sc-cosplay-2", "sc-cosplay-1", "sc-cosplay-3"],  # top 皮革马甲 / skirt 哥特短裙 / shoes 骑士靴
}

# 与 server/constants/scene.mjs 保持一致，用来自检 category 落在 slots 里
SLOTS = {
    "subway": ["top", "pants", "shoes"],
    "station": ["top", "pants", "bag"],
    "desk": ["top", "pants", "shoes"],
    "meeting": ["top", "bag", "shoes"],
    "restaurant": ["dress", "bag", "accessory"],
    "lobby": ["top", "shoes", "bag"],
    "cafe": ["top", "shoes", "accessory"],
    "terrace": ["skirt", "shoes", "hat"],
    "banquet": ["dress", "shoes", "jewelry"],
    "bar": ["top", "skirt", "shoes"],
}


def main() -> int:
    with open(SEED, encoding="utf-8") as f:
        items = json.load(f)
    by_id = {it["id"]: it for it in items}

    listed = [old for ids in REGROUP.values() for old in ids]
    if len(listed) != len(set(listed)):
        print("!! 映射表里有重复的旧 id", file=sys.stderr)
        return 1
    if set(listed) != set(by_id):
        print(f"!! 映射表和 seed 对不上\n   只在 seed: {sorted(set(by_id) - set(listed))}"
              f"\n   只在映射: {sorted(set(listed) - set(by_id))}", file=sys.stderr)
        return 1

    renames: list[tuple[str, str]] = []
    out: list[dict] = []
    problems: list[str] = []

    for key, old_ids in REGROUP.items():
        for i, old_id in enumerate(old_ids, start=1):
            it = dict(by_id[old_id])
            new_id = f"sc-{key}-{i}"

            if it["category"] not in SLOTS[key]:
                problems.append(f"{new_id} ({it['name']}) 的 category={it['category']} 不在 {key} 的 slots {SLOTS[key]} 里")

            it["id"] = new_id
            it["sceneKey"] = key
            it["imageUrl"] = f"/static/images/catalog/{new_id}.jpg"
            out.append(it)
            renames.append((f"{old_id}.jpg", f"{new_id}.jpg"))

    if problems:
        print("!! category 和 slots 不匹配：", file=sys.stderr)
        for p in problems:
            print("   ", p, file=sys.stderr)
        return 1

    # 旧前缀（daily/business/...）和新前缀（subway/station/...）完全不重叠，
    # 所以直接改名不会撞上还没处理的文件，不需要两阶段。
    old_names = {o for o, _ in renames}
    new_names = {n for _, n in renames}
    if old_names & new_names:
        print(f"!! 新旧文件名有重叠，需要两阶段改名: {sorted(old_names & new_names)}", file=sys.stderr)
        return 1

    moved, missing = 0, []
    for old_name, new_name in renames:
        src = os.path.join(IMG_DIR, old_name)
        if not os.path.exists(src):
            missing.append(old_name)
            continue
        os.replace(src, os.path.join(IMG_DIR, new_name))
        moved += 1

    with open(SEED, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
        f.write("\n")

    print(f"seed 重写 {len(out)} 条，图片改名 {moved} 个")
    for key, ids in REGROUP.items():
        cats = [by_id[o]["category"] for o in ids]
        print(f"  {key:11s} {len(ids)} 件  {'/'.join(cats):28s} slots={'/'.join(SLOTS[key])}")
    if missing:
        print(f"\n!! 这些图片文件没找到（seed 已改，图需要补）: {missing}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
