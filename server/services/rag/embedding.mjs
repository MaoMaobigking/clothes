/**
 * 文本向量化（阿里百炼 text-embedding-v3）。
 *
 * 为什么单独一个文件、不并进 bailianService.mjs：
 * 那一层的注释写得很清楚，它是**异步任务**协议的适配器 ——
 * createTask 拿 task_id、轮询 /api/v1/tasks/{id} 到终态，CAPABILITIES 表描述的是这套流程。
 * embedding 是同步接口，一次请求直接拿结果，塞进那张表会破坏它自己申明的契约。
 * 共用的只有 DASHSCOPE_API_KEY 和 baseUrl，那点复用不值得把两种协议混在一起。
 *
 * 为什么用它而不是继续手搓 TF-IDF：
 * 手写「AI 编排逻辑」（tool-calling 循环、结构化输出）是这个项目刻意的选择，
 * 因为那是能讲原理的部分。但「文本 → 向量」不是编排逻辑，是一个模型能力 ——
 * 手搓 TF-IDF + bigram 换来的是「换个说法就检索不到」，还得靠人工停用词表续命。
 * 切块 / 检索 / 阈值 / 拼 prompt 仍然全部手写，只把向量表示这一环交给模型。
 *
 * 环境变量：DASHSCOPE_API_KEY（北京地域）/ DASHSCOPE_BASE_URL（可选）
 */
import { config } from '../../config/env.mjs'

const BASE_URL = config.bailian.baseUrl
const API_KEY = config.bailian.apiKey

export const EMBEDDING_MODEL = 'text-embedding-v3'
export const EMBEDDING_DIM = 1024

/** 百炼实测上限：单次 10 条，25 条会 400 InvalidParameter（2026-09-08 实测） */
const BATCH_SIZE = 10
const TIMEOUT_MS = 20000

const ENDPOINT = `${BASE_URL}/api/v1/services/embeddings/text-embedding/text-embedding`

/** 没配 key 时上层应当降级（RAG 直接返回空），而不是抛错打断对话 */
export function isEmbeddingEnabled() {
  return Boolean(API_KEY)
}

async function embedBatch(texts) {
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: { texts },
      parameters: { dimension: EMBEDDING_DIM },
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  const text = await response.text()
  if (!response.ok) {
    throw new Error(`百炼 embedding 接口 ${response.status}: ${text.slice(0, 300)}`)
  }
  const data = JSON.parse(text)
  const rows = data.output?.embeddings
  if (!Array.isArray(rows) || rows.length !== texts.length) {
    throw new Error(`百炼 embedding 返回条数不匹配：要 ${texts.length} 条，回 ${rows?.length ?? 0} 条`)
  }
  // 百炼按 text_index 标序，不保证数组顺序和入参一致，必须按它给的下标回填
  const out = new Array(texts.length)
  for (const row of rows) {
    out[row.text_index] = row.embedding
  }
  return out
}

/**
 * 批量向量化。自动按 BATCH_SIZE 切批，返回顺序与入参一一对应。
 *
 * 串行发批而不是 Promise.all：知识库一共十几块，并发省不了多少时间，
 * 但很容易撞上百炼的 QPS 限流，得不偿失。
 *
 * @param {string[]} texts
 * @returns {Promise<number[][]>}
 */
export async function embedTexts(texts) {
  if (!API_KEY) throw new Error('未配置 DASHSCOPE_API_KEY，无法向量化')
  const list = (texts || []).map((t) => String(t ?? '').trim()).filter(Boolean)
  if (list.length === 0) return []

  const result = []
  for (let i = 0; i < list.length; i += BATCH_SIZE) {
    result.push(...(await embedBatch(list.slice(i, i + BATCH_SIZE))))
  }
  return result
}

/** 单条向量化的语法糖 */
export async function embedOne(text) {
  const [vec] = await embedTexts([text])
  return vec || null
}
