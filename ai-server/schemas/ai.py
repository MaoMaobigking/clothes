"""AI 服装 · Pydantic 请求/响应模型

从 aiService.mjs 的 JSON Schema 定义转换而来：
- STYLE_REPORT_SCHEMA → StyleReportRadar / StyleReportRecommendation / StyleReportResponse
- SCENE_OUTFIT_SCHEMA  → SceneOutfitPiece / SceneOutfit / SceneOutfitResponse
- 对话模型            → ChatMessage / ChatRequest / ChatReply
"""

from typing import Literal
from pydantic import BaseModel, Field, ConfigDict


# ═══════════════════════════════════════════════
# 风格报告相关
# ═══════════════════════════════════════════════

class StyleReportRadar(BaseModel):
    """雷达图单项：5 个固定维度之一"""
    name: Literal['风格', '肤色', '脸型', '体型', '偏好']
    value: float = Field(..., ge=0, le=100, description="0-100 评分")

    model_config = ConfigDict(extra='forbid')


class StyleReportRecommendation(BaseModel):
    """单套穿搭推荐"""
    title: str
    scene: str
    pieces: list[str] = Field(..., min_length=2)
    reason: str

    model_config = ConfigDict(extra='forbid')


class StyleReportResponse(BaseModel):
    """风格报告完整响应（匹配 STYLE_REPORT_SCHEMA）"""
    summary: str = Field(..., description="一句话风格总结，20字以内")
    radar: list[StyleReportRadar] = Field(..., min_length=5, max_length=5)
    palette: list[str] = Field(..., min_length=4, max_length=6, description="4-6 个推荐色号 #RRGGBB")
    recommendations: list[StyleReportRecommendation] = Field(..., min_length=1, max_length=5)
    tips: list[str] = Field(..., min_length=2, max_length=5, description="2-5 条实用造型建议")

    model_config = ConfigDict(extra='forbid')


# ═══════════════════════════════════════════════
# 情景搭配相关
# ═══════════════════════════════════════════════

class SceneOutfitPiece(BaseModel):
    """单件搭配单品"""
    name: str
    emoji: str

    model_config = ConfigDict(extra='forbid')


class SceneOutfit(BaseModel):
    """单套情景搭配"""
    title: str
    scene: str
    reason: str
    pieces: list[SceneOutfitPiece] = Field(..., min_length=3, max_length=8)

    model_config = ConfigDict(extra='forbid')


class SceneOutfitResponse(BaseModel):
    """情景搭配完整响应（匹配 SCENE_OUTFIT_SCHEMA）"""
    outfits: list[SceneOutfit] = Field(..., min_length=1, max_length=5)

    model_config = ConfigDict(extra='forbid')


# ═══════════════════════════════════════════════
# 对话相关
# ═══════════════════════════════════════════════

class ChatMessage(BaseModel):
    """单条对话消息"""
    role: Literal['user', 'assistant', 'system']
    content: str


class ChatRequest(BaseModel):
    """对话请求"""
    messages: list[ChatMessage] = Field(..., min_length=1)


class ChatReply(BaseModel):
    """对话回复"""
    reply: str
