/**
 * AI 服务商适配：预设表 + 运行时选中的那一套参数。
 *核心作用是：把不同 AI 厂商（如 DeepSeek、OpenAI、Anthropic）
 之间不同的接口规范、默认模型和请求地址差异“屏蔽”掉，
 统合成一套统一的配置供下游代码调用。
 * 三类 provider（DeepSeek / OpenAI 兼容 / Anthropic）的差异只有四点：
 * 基址、默认模型、走哪套 HTTP 协议、支不支持 json_schema。
 * 这里把差异收敛成常量，下游的 client / stream / tools 只管用，不再判断服务商。
 *
 * ────────────────────────────────────────────────────────────────
 * 能力矩阵（2026-09-08 实测状态，改动能力时请同步更新这张表）
 *
 * | 能力            | OpenAI 兼容（含 DeepSeek） | Anthropic          |
 * |-----------------|---------------------------|--------------------|
 * | 普通对话        | ✅ 已实测                  | ⚠️ 已实现，未实测   |
 * | 结构化输出      | ✅ 已实测                  | ⚠️ 已实现，未实测   |
 * | SSE 流式        | ✅ 已实测                  | ⚠️ 已实现，未实测   |
 * | 工具调用        | ✅ 已实测                  | ❌ 未实现（待接入） |
 *
 * 「已实现，未实测」= 代码按官方 API 形状写了（client.mjs 的 structuredAnthropic /
 * callAnthropic、stream.mjs 的 streamAnthropic），但手上没有 Anthropic key，
 * 一次都没真跑过，不能当成"支持"来讲。
 *
 * 「未实现」= tools.mjs 的 aiChatWithTools 只写了 OpenAI 兼容协议。
 * Anthropic 的工具协议形状不同（tool_use / tool_result 内容块 + stop_reason 判定），
 * 需要单独一条分支。该函数已在入口显式抛 TOOL_CALLING_UNSUPPORTED_PROVIDER，
 * 不会伪装成网络错误。
 * ────────────────────────────────────────────────────────────────
 */
import { config } from '../../../config/env.mjs'
const PROVIDER_PRESETS = {
  deepseek: {
    label: 'DeepSeek',
    api: 'openai',
    model: 'deepseek-chat',
    baseUrl: 'https://api.deepseek.com',
    supportsJsonSchema: false,
  },
  openai: {
    label: 'OpenAI',
    api: 'openai',
    model: 'gpt-4o-mini',
    baseUrl: 'https://api.openai.com/v1',
    supportsJsonSchema: true,
  },
  anthropic: {
    label: 'Anthropic',
    api: 'anthropic',
    model: 'claude-haiku-4-5-20251001',
    baseUrl: 'https://api.anthropic.com',
    supportsJsonSchema: false,
  },
}

const rawProvider = config.ai.provider
//检查一下你写得对不对。如果写对了就用你的；如果没写或者写错了，自动兜底改成 'openai'，防止程序报错。
const PROVIDER = PROVIDER_PRESETS[rawProvider] ? rawProvider : 'openai'
//一旦确定了服务商，就把文件上面看到的那个“预设配置卡片”整张拿过来。
const PROVIDER_CONFIG = PROVIDER_PRESETS[PROVIDER]
export const API_KEY = config.ai.apiKey
export const MODEL = config.ai.model || PROVIDER_CONFIG.model
const BASE_URL = config.ai.baseUrl || PROVIDER_CONFIG.baseUrl
export const API_STYLE = PROVIDER_CONFIG.api
export const SUPPORTS_JSON_SCHEMA = PROVIDER_CONFIG.supportsJsonSchema
export const CHAT_COMPLETIONS_URL = joinUrl(BASE_URL, 'chat/completions')
export const ANTHROPIC_MESSAGES_URL = joinUrl(BASE_URL, 'v1/messages')

if (rawProvider && !PROVIDER_PRESETS[rawProvider]) {
  console.warn(`[aiService] 未知 AI_PROVIDER=${rawProvider}，已回退为 openai`)
}

function joinUrl(baseUrl, path) {
  return `${String(baseUrl).replace(/\/+$/, '')}/${String(path).replace(/^\/+/, '')}`
}

//这是一个获取当前 AI 运行状态快照（Debug 报告）的函数。
// 当你调用它时，它会把当前系统正在使用的 AI 配置打包成一个对象返回给你。
export function getAiRuntime() {
  return {
    provider: PROVIDER,
    providerLabel: PROVIDER_CONFIG.label,
    model: MODEL,
    baseUrl: BASE_URL,
    apiStyle: API_STYLE,
    supportsJsonSchema: SUPPORTS_JSON_SCHEMA,
    hasKey: Boolean(API_KEY),
  }
}
