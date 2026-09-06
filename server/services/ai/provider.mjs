/**
 * AI 服务商适配：预设表 + 运行时选中的那一套参数。
 *
 * 三类 provider（DeepSeek / OpenAI 兼容 / Anthropic）的差异只有四点：
 * 基址、默认模型、走哪套 HTTP 协议、支不支持 json_schema。
 * 这里把差异收敛成常量，下游的 client / stream / tools 只管用，不再判断服务商。
 */
import { config } from '../../config/env.mjs'
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
const PROVIDER = PROVIDER_PRESETS[rawProvider] ? rawProvider : 'openai'
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
