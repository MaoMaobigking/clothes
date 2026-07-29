"""
AI 核心服务层（Python 版）
- 结构化输出：使用 JSON Schema 约束模型输出，支持 OpenAI/Anthropic 双 provider
- 兜底机制：手写 JSON 提取 + Schema 校验

环境变量：AI_PROVIDER / AI_API_KEY / AI_MODEL / AI_BASE_URL
使用 httpx (async) 作为 HTTP 客户端。
"""

import os
import json
import logging
from typing import Any, Optional, AsyncGenerator

import httpx

logger = logging.getLogger(__name__)

# ── 环境变量 ──────────────────────────────────────────────

PROVIDER = os.getenv("AI_PROVIDER", "openai").lower()
API_KEY = os.getenv("AI_API_KEY", "")
MODEL = os.getenv(
    "AI_MODEL",
    "claude-haiku-4-5-20251001" if PROVIDER == "anthropic" else "gpt-4o-mini",
)
BASE_URL = os.getenv(
    "AI_BASE_URL",
    "https://api.anthropic.com" if PROVIDER == "anthropic" else "https://api.openai.com/v1",
)

# ── JSON Schema 定义 ──────────────────────────────────────

STYLE_REPORT_SCHEMA = {
    "name": "style_report",
    "strict": True,
    "schema": {
        "type": "object",
        "properties": {
            "summary": {"type": "string", "description": "一句话风格总结，20字以内"},
            "radar": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "name": {
                            "type": "string",
                            "enum": ["风格", "肤色", "脸型", "体型", "偏好"],
                        },
                        "value": {"type": "number", "minimum": 0, "maximum": 100},
                    },
                    "required": ["name", "value"],
                    "additionalProperties": False,
                },
                "minItems": 5,
                "maxItems": 5,
            },
            "palette": {
                "type": "array",
                "items": {"type": "string"},
                "minItems": 4,
                "maxItems": 6,
            },
            "recommendations": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "title": {"type": "string"},
                        "scene": {"type": "string"},
                        "pieces": {
                            "type": "array",
                            "items": {"type": "string"},
                            "minItems": 2,
                        },
                        "reason": {"type": "string"},
                    },
                    "required": ["title", "scene", "pieces", "reason"],
                    "additionalProperties": False,
                },
                "minItems": 1,
                "maxItems": 5,
            },
            "tips": {
                "type": "array",
                "items": {"type": "string"},
                "minItems": 2,
                "maxItems": 5,
            },
        },
        "required": ["summary", "radar", "palette", "recommendations", "tips"],
        "additionalProperties": False,
    },
}

SCENE_OUTFIT_SCHEMA = {
    "name": "scene_outfits",
    "strict": True,
    "schema": {
        "type": "object",
        "properties": {
            "outfits": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "title": {"type": "string"},
                        "scene": {"type": "string"},
                        "reason": {"type": "string"},
                        "pieces": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "name": {"type": "string"},
                                    "emoji": {"type": "string"},
                                },
                                "required": ["name", "emoji"],
                                "additionalProperties": False,
                            },
                            "minItems": 3,
                            "maxItems": 8,
                        },
                    },
                    "required": ["title", "scene", "reason", "pieces"],
                    "additionalProperties": False,
                },
                "minItems": 1,
                "maxItems": 5,
            },
        },
        "required": ["outfits"],
        "additionalProperties": False,
    },
}


# ── Schema 校验 ───────────────────────────────────────────

def validate_schema(data: Any, schema: dict) -> dict:
    """手写 JSON Schema 校验，返回 {"valid": bool, "errors": [str]}"""
    errors: list[str] = []
    s = schema.get("schema", schema)

    # 检查 required
    for key in s.get("required", []):
        if key not in data:
            errors.append(f"缺少必填字段: {key}")

    # 检查 properties
    for key, prop in s.get("properties", {}).items():
        if key not in data:
            continue
        val = data[key]

        if prop.get("type") == "array":
            if not isinstance(val, list):
                errors.append(f"字段 {key} 应为数组")
                continue
        if prop.get("type") == "string" and not isinstance(val, str):
            errors.append(f"字段 {key} 应为字符串")
        if prop.get("type") == "number" and not isinstance(val, (int, float)):
            errors.append(f"字段 {key} 应为数字")

        # 枚举检查
        if "enum" in prop and val not in prop["enum"]:
            errors.append(f'字段 {key} 值 "{val}" 不在允许范围内')

        # 数组长度
        if "minItems" in prop and isinstance(val, list) and len(val) < prop["minItems"]:
            errors.append(
                f"字段 {key} 至少需要 {prop['minItems']} 项，当前 {len(val)} 项"
            )
        if "maxItems" in prop and isinstance(val, list) and len(val) > prop["maxItems"]:
            errors.append(
                f"字段 {key} 最多 {prop['maxItems']} 项，当前 {len(val)} 项"
            )

    # 禁止额外字段
    if s.get("additionalProperties") is False and s.get("properties"):
        known = set(s["properties"].keys())
        for key in data:
            if key not in known:
                errors.append(f"未知字段: {key}")

    return {"valid": len(errors) == 0, "errors": errors}


# ── JSON 解析 ─────────────────────────────────────────────

def parse_json(text: Optional[str], json_schema: Optional[dict] = None) -> Any:
    """手写 JSON 提取 + Schema 校验"""
    if not text:
        raise ValueError("模型返回为空")

    s = str(text).strip()
    # 去掉 code fence
    for prefix in ("```json", "```"):
        if s.lower().startswith(prefix):
            s = s[len(prefix):].strip()
    if s.endswith("```"):
        s = s[:-3].strip()

    a = s.find("{")
    b = s.rfind("}")
    if a == -1 or b == -1:
        raise ValueError(f"模型没返回 JSON：{s[:200]}")

    try:
        parsed = json.loads(s[a:b + 1])
    except json.JSONDecodeError as e:
        raise ValueError(f"JSON 解析失败: {e}\n原始片段: {s[:300]}")

    if json_schema:
        result = validate_schema(parsed, json_schema)
        if not result["valid"]:
            logger.warning(
                "[ai_service] JSON Schema 校验失败: %s", "; ".join(result["errors"])
            )

    return parsed


# ── 底层 HTTP 调用 ────────────────────────────────────────

async def _httpx_client() -> httpx.AsyncClient:
    """获取共享的 httpx AsyncClient（可按需扩展超时等）"""
    return httpx.AsyncClient(timeout=httpx.Timeout(60.0))


async def call_openai(
    system: str, messages: list[dict], *, tools: Optional[list[dict]] = None
) -> dict:
    """调用 OpenAI 兼容接口，返回完整 JSON 响应"""
    body: dict = {
        "model": MODEL,
        "temperature": 0.8,
        "messages": [{"role": "system", "content": system}, *messages],
    }
    if tools:
        body["tools"] = tools
        body["tool_choice"] = "auto"

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {API_KEY}",
    }

    async with await _httpx_client() as client:
        r = await client.post(
            f"{BASE_URL}/chat/completions",
            headers=headers,
            json=body,
        )

    if r.status_code != 200:
        raise RuntimeError(f"OpenAI 兼容接口 {r.status_code}: {r.text}")

    return r.json()


async def call_anthropic(system: str, messages: list[dict]) -> str:
    """调用 Anthropic API，返回纯文本"""
    body: dict = {
        "model": MODEL,
        "max_tokens": 1200,
        "system": system,
        "messages": messages,
    }

    headers = {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
        "anthropic-version": "2023-06-01",
    }

    async with await _httpx_client() as client:
        r = await client.post(
            f"{BASE_URL}/v1/messages",
            headers=headers,
            json=body,
        )

    if r.status_code != 200:
        raise RuntimeError(f"Anthropic 接口 {r.status_code}: {r.text}")

    data = r.json()
    return (data.get("content") or [{}])[0].get("text", "")


# ── 结构化输出 ────────────────────────────────────────────

async def structured_openai(
    system: str, prompt: str, json_schema: dict
) -> Any:
    """OpenAI: 使用 response_format { type: "json_schema" }"""
    body = {
        "model": MODEL,
        "temperature": 0.7,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": prompt},
        ],
        "response_format": {
            "type": "json_schema",
            "json_schema": json_schema,
        },
    }

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {API_KEY}",
    }

    async with await _httpx_client() as client:
        r = await client.post(
            f"{BASE_URL}/chat/completions",
            headers=headers,
            json=body,
        )

    if r.status_code != 200:
        err_text = r.text
        # 如果不支持 json_schema，回退
        if r.status_code == 400 and "json_schema" in err_text:
            logger.warning(
                "[ai_service] Provider 不支持 json_schema，回退到 prompt 约束 + 手动解析"
            )
            return await fallback_json_call(system, prompt, json_schema)
        raise RuntimeError(f"OpenAI 接口 {r.status_code}: {err_text}")

    data = r.json()
    content = ((data.get("choices") or [{}])[0].get("message") or {}).get("content", "")
    return parse_json(content, json_schema)


async def structured_anthropic(
    system: str, prompt: str, json_schema: dict
) -> Any:
    """Anthropic: 使用 tool_use 模拟 structured output"""
    body = {
        "model": MODEL,
        "max_tokens": 2000,
        "system": system,
        "messages": [{"role": "user", "content": prompt}],
        "tools": [
            {
                "name": json_schema["name"],
                "description": f"返回符合 schema 的 JSON: {json.dumps(json_schema['schema'], ensure_ascii=False)}",
                "input_schema": json_schema["schema"],
            }
        ],
        "tool_choice": {"type": "tool", "name": json_schema["name"]},
    }

    headers = {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
        "anthropic-version": "2023-06-01",
    }

    async with await _httpx_client() as client:
        r = await client.post(
            f"{BASE_URL}/v1/messages",
            headers=headers,
            json=body,
        )

    if r.status_code != 200:
        raise RuntimeError(f"Anthropic 接口 {r.status_code}: {r.text}")

    data = r.json()

    # 从 tool_use 块提取 JSON
    for block in data.get("content", []):
        if block.get("type") == "tool_use" and block.get("name") == json_schema["name"]:
            return block.get("input", {})

    # 回退：从文本中提取
    text = ""
    for block in data.get("content", []):
        if block.get("type") == "text":
            text = block.get("text", "")
            break
    return parse_json(text, json_schema)


async def structured_complete(
    *, system: str, prompt: str, json_schema: dict
) -> Any:
    """带 JSON Schema 的结构化调用"""
    if PROVIDER == "anthropic":
        return await structured_anthropic(system, prompt, json_schema)
    return await structured_openai(system, prompt, json_schema)


async def ai_complete_text(system: str, prompt: str) -> str:
    """普通文本补全（无 structured output）"""
    return await ai_complete(
        system=system,
        messages=[{"role": "user", "content": prompt}],
    )


async def fallback_json_call(
    system: str, prompt: str, json_schema: dict
) -> Any:
    """兜底：普通调用 + 手动 JSON 提取 + Schema 校验"""
    text = await ai_complete_text(system, prompt)
    return parse_json(text, json_schema)


async def ai_complete(*, system: str, messages: list[dict]) -> str:
    """底层 provider 适配 — 返回纯文本"""
    if PROVIDER == "anthropic":
        return await call_anthropic(system, messages)
    data = await call_openai(system, messages)
    return ((data.get("choices") or [{}])[0].get("message") or {}).get("content", "")


# ── 对外接口 ──────────────────────────────────────────────


async def generate_report(profile: dict) -> dict:
    """生成风格报告（JSON Schema 约束）"""
    p = profile or {}
    b = p.get("body", {}) or {}

    info_lines = [
        f"喜欢的风格：{'、'.join(p.get('styles', [])) or '未填'}",
        f"肤色：{p.get('skin', '未填')}；脸型：{p.get('face', '未填')}",
        f"身高{b.get('height', '?')}cm 体重{b.get('weight', '?')}kg BMI{p.get('bmi', '?')}",
        f"围度：胸{b.get('bust', '?')} 腰{b.get('waist', '?')} 大腿{b.get('thigh', '?')} 小腿{b.get('calf', '?')}",
        f"偏好：{json.dumps(p.get('preferences', {}), ensure_ascii=False)}",
    ]
    info = "\n".join(info_lines)

    prompt = f"""根据以下用户画像，生成专属穿搭风格报告：
{info}

要求：
- summary：20字内风格总结
- radar：5个维度评分(风格/肤色/脸型/体型/偏好)，0-100分
- palette：4-6个推荐色号（#RRGGBB格式）
- recommendations：3套穿搭推荐，每套含标题、场合、单品列表、推荐理由
- tips：3条实用造型建议"""

    result = None
    last_error = None

    try:
        result = await structured_complete(
            system="你是专业中文时尚穿搭顾问。",
            prompt=prompt,
            json_schema=STYLE_REPORT_SCHEMA,
        )
    except Exception as e:
        last_error = e
        logger.warning("[ai_service] 结构化输出失败，尝试兜底: %s", e)

    if result is None:
        try:
            text = await ai_complete_text(
                "你是专业中文时尚穿搭顾问。只输出一个 JSON 对象。", prompt
            )
            result = parse_json(text, STYLE_REPORT_SCHEMA)
        except Exception as e2:
            raise last_error or e2

    # Schema 校验
    v = validate_schema(result, STYLE_REPORT_SCHEMA)
    if not v["valid"]:
        logger.warning("[ai_service] Schema 校验警告: %s", "; ".join(v["errors"]))

    return result


async def generate_scene_outfits(payload: dict) -> dict:
    """生成情景搭配推荐（JSON Schema 约束）"""
    scene = payload.get("scene", "日常")
    weather = payload.get("weather", {}) or {}
    profile = payload.get("profile", {}) or {}
    w = f"{weather.get('city', '')} {weather.get('temp', '')}° {weather.get('condition', '')}".strip()

    prompt = f"""场景：{scene}
天气：{w or '未知'}
用户偏好风格：{'、'.join(profile.get('styles', [])) or '不限'}

根据场景和天气，生成3套完整穿搭。每套4-6件单品，每件配一个 emoji。"""

    result = None
    last_error = None

    try:
        result = await structured_complete(
            system="你是专业中文穿搭顾问。",
            prompt=prompt,
            json_schema=SCENE_OUTFIT_SCHEMA,
        )
    except Exception as e:
        last_error = e

    if result is None:
        try:
            text = await ai_complete_text(
                "你是专业中文穿搭顾问。只输出一个 JSON 对象。", prompt
            )
            result = parse_json(text, SCENE_OUTFIT_SCHEMA)
        except Exception as e2:
            raise last_error or e2

    v = validate_schema(result, SCENE_OUTFIT_SCHEMA)
    if not v["valid"]:
        logger.warning(
            "[ai_service] Scene Schema 校验警告: %s", "; ".join(v["errors"])
        )

    return result


# ── AI 对话 ───────────────────────────────────────────────

DEFAULT_SYSTEM_PROMPT = (
    "你是「灵犀」——一个亲切专业的中文穿搭顾问。"
    "回答简洁口语化，多给具体、可执行的单品和搭配建议，必要时分点。不要超过 200 字。"
)


async def ai_chat(
    messages: list[dict], system: Optional[str] = None
) -> str:
    """AI 穿搭顾问对话（非流式）"""
    sys = system or DEFAULT_SYSTEM_PROMPT
    normalized = [
        {
            "role": "assistant" if m.get("role") == "assistant" else "user",
            "content": str(m.get("content", "")),
        }
        for m in messages
    ]
    return await ai_complete(system=sys, messages=normalized)


async def ai_chat_stream(
    messages: list[dict], system: Optional[str] = None
) -> AsyncGenerator[str, None]:
    """流式 AI 对话（SSE），yield 每个 delta token"""
    sys = system or DEFAULT_SYSTEM_PROMPT
    normalized = [
        {
            "role": "assistant" if m.get("role") == "assistant" else "user",
            "content": str(m.get("content", "")),
        }
        for m in messages
    ]

    if PROVIDER == "anthropic":
        async for token in _stream_anthropic(sys, normalized):
            yield token
    else:
        async for token in _stream_openai(sys, normalized):
            yield token


# ── 流式内部实现 ──────────────────────────────────────────


async def _stream_openai(
    system: str, messages: list[dict]
) -> AsyncGenerator[str, None]:
    """OpenAI 流式"""
    body = {
        "model": MODEL,
        "temperature": 0.8,
        "stream": True,
        "messages": [{"role": "system", "content": system}, *messages],
    }

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {API_KEY}",
    }

    async with await _httpx_client() as client:
        async with client.stream(
            "POST",
            f"{BASE_URL}/chat/completions",
            headers=headers,
            json=body,
        ) as r:
            if r.status_code != 200:
                body_text = await r.aread()
                raise RuntimeError(
                    f"OpenAI 流式接口 {r.status_code}: {body_text.decode()}"
                )

            async for line in r.aiter_lines():
                if not line.startswith("data: "):
                    continue
                data = line[6:].strip()
                if data == "[DONE]":
                    continue
                try:
                    chunk = json.loads(data)
                    delta = (
                        ((chunk.get("choices") or [{}])[0].get("delta") or {}).get(
                            "content"
                        )
                        or ""
                    )
                    if delta:
                        yield delta
                except (json.JSONDecodeError, KeyError, IndexError):
                    pass


async def _stream_anthropic(
    system: str, messages: list[dict]
) -> AsyncGenerator[str, None]:
    """Anthropic 流式"""
    body = {
        "model": MODEL,
        "max_tokens": 1200,
        "system": system,
        "messages": messages,
        "stream": True,
    }

    headers = {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
        "anthropic-version": "2023-06-01",
    }

    async with await _httpx_client() as client:
        async with client.stream(
            "POST",
            f"{BASE_URL}/v1/messages",
            headers=headers,
            json=body,
        ) as r:
            if r.status_code != 200:
                body_text = await r.aread()
                raise RuntimeError(
                    f"Anthropic 流式接口 {r.status_code}: {body_text.decode()}"
                )

            async for line in r.aiter_lines():
                if not line.startswith("data: "):
                    continue
                data = line[6:].strip()
                try:
                    chunk = json.loads(data)
                    if (
                        chunk.get("type") == "content_block_delta"
                        and chunk.get("delta", {}).get("text")
                    ):
                        yield chunk["delta"]["text"]
                except (json.JSONDecodeError, KeyError):
                    pass


# ── 工具调用 ──────────────────────────────────────────────

from services.tool_service import TOOLS as _TOOLS, execute_tool as _execute_tool_impl


def _get_tools() -> list[dict]:
    """获取 TOOLS 定义列表"""
    return list(_TOOLS)


async def _execute_tool(name: str, args: dict, context: dict) -> str:
    """执行单个工具"""
    return await _execute_tool_impl(name, args, context)


async def ai_chat_with_tools(
    messages: list[dict],
    context: Optional[dict] = None,
) -> str:
    """
    手写 tool-calling 循环

    流程：
    1. 用户消息 + tools 定义 → 调模型
    2. 模型返回 tool_calls? → 执行工具 → 结果喂回模型
    3. 模型返回 text? → 返回

    Returns:
        完整回复文本
    """
    if context is None:
        context = {}

    system = (
        "你是「灵犀」——一个亲切专业的中文穿搭顾问。"
        "你可以使用工具来查询用户的衣橱、天气和画像信息，从而给出更精准的建议。"
    )

    # 工作副本
    msgs: list[dict] = [
        {
            "role": "assistant" if m.get("role") == "assistant" else "user",
            "content": str(m.get("content", "")),
        }
        for m in messages
    ]

    tools = _get_tools()

    for _round in range(5):  # 最多 5 轮
        data = await call_openai(system, msgs, tools=tools)
        msg = ((data.get("choices") or [{}])[0].get("message") or {})
        if not msg:
            raise RuntimeError("模型返回为空")

        # 检查 tool_calls
        if msg.get("tool_calls"):
            # 记录 assistant 的 tool_calls 消息
            msgs.append({
                "role": "assistant",
                "content": None,
                "tool_calls": msg["tool_calls"],
            })

            for tc in msg["tool_calls"]:
                tool_name = tc["function"]["name"]
                args = {}
                try:
                    args = json.loads(tc["function"]["arguments"])
                except (json.JSONDecodeError, KeyError, TypeError):
                    pass
                result = await _execute_tool(tool_name, args, context)
                msgs.append({
                    "role": "tool",
                    "tool_call_id": tc["id"],
                    "content": result,
                })
            continue

        # 普通文本回复
        return msg.get("content", "")

    raise RuntimeError("工具调用超出最大轮次")
