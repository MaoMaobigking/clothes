"""
工具执行服务
- TOOLS 定义（OpenAI function calling 格式）
- execute_tool(name, args, context) — 工具执行器
- 支持三个工具：search_garments, get_weather, get_user_profile
"""

from typing import Any

# ── 工具定义 ──────────────────────────────────────────────

TOOLS: list[dict[str, Any]] = [
    {
        "type": "function",
        "function": {
            "name": "search_garments",
            "description": "搜索用户的衣橱，根据关键词、分类、颜色等条件查找衣物",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "搜索关键词（可选，如'白色衬衫'）",
                    },
                    "category": {
                        "type": "string",
                        "enum": [
                            "top", "pants", "skirt", "dress",
                            "shoes", "bag", "hat", "jewelry", "accessory",
                        ],
                    },
                    "color": {
                        "type": "string",
                        "description": "颜色偏好（可选）",
                    },
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "查询指定城市的天气信息",
            "parameters": {
                "type": "object",
                "properties": {
                    "city": {
                        "type": "string",
                        "description": "城市名，如'北京'、'上海'、'重庆'",
                    },
                },
                "required": ["city"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_user_profile",
            "description": "获取当前用户的身形数据、风格偏好等信息",
            "parameters": {
                "type": "object",
                "properties": {},
            },
        },
    },
]


# ── Mock 天气数据 ─────────────────────────────────────────

_MOCK_WEATHER: dict[str, dict[str, Any]] = {
    "北京": {"temp": 25, "condition": "晴", "icon": "☀️"},
    "上海": {"temp": 28, "condition": "多云", "icon": "⛅"},
    "重庆": {"temp": 23, "condition": "暴雨", "icon": "🌧️"},
    "广州": {"temp": 30, "condition": "雷阵雨", "icon": "⛈️"},
}


# ── 工具执行器 ────────────────────────────────────────────

async def execute_tool(
    name: str,
    args: dict[str, Any],
    context: dict[str, Any] | None = None,
) -> str:
    """
    执行指定工具并返回文本结果。

    Args:
        name: 工具名称
        args: 工具参数
        context: 上下文（garments 列表, profile 字典等）

    Returns:
        工具执行结果的文本描述
    """
    if context is None:
        context = {}

    if name == "search_garments":
        return _search_garments(args, context)

    if name == "get_weather":
        return _get_weather(args)

    if name == "get_user_profile":
        return _get_user_profile(context)

    return f"未知工具: {name}"


def _search_garments(args: dict, context: dict) -> str:
    """搜索衣橱"""
    query: str = (args.get("query") or "").strip()
    category: str | None = args.get("category")
    color: str | None = args.get("color")

    items: list[dict] = list(context.get("garments", []))

    if category:
        items = [g for g in items if g.get("category") == category]

    if query:
        q = query.lower()
        items = [
            g
            for g in items
            if q in (g.get("name") or "").lower()
            or any(q in (t or "").lower() for t in (g.get("tags") or []))
        ]

    if color:
        items = [g for g in items if color in (g.get("color") or "")]

    if not items:
        return "衣橱中没有找到匹配的衣物。"

    lines = ["衣橱中找到以下衣物："]
    for g in items[:8]:
        emoji = g.get("emoji") or "👕"
        name = g.get("name", "")
        cat = g.get("category", "")
        brand = g.get("brand", "")
        price = g.get("price", "?")
        lines.append(f"- {emoji} {name}（{cat}，{brand}，¥{price}）")

    return "\n".join(lines)


def _get_weather(args: dict) -> str:
    """查询天气（Mock）"""
    city: str = args.get("city", "")
    w = _MOCK_WEATHER.get(city, {"temp": 22, "condition": "多云", "icon": "☁️"})
    return f'{city}天气：{w["icon"]} {w["condition"]}，气温 {w["temp"]}°C'


def _get_user_profile(context: dict) -> str:
    """获取用户画像"""
    profile: dict = context.get("profile", {}) or {}
    styles: list[str] = profile.get("styles") or []
    if not styles:
        return "用户尚未完成风格测试，没有画像数据。"
    skin = profile.get("skin", "未知")
    face = profile.get("face", "未知")
    bmi = profile.get("bmi", "未知")
    return (
        f"用户画像：风格偏好 {'、'.join(styles)}，"
        f"肤色 {skin}，脸型 {face}，BMI {bmi}"
    )
