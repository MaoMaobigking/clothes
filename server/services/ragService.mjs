/**
 * RAG 服务 — 穿搭知识库检索增强生成（语义向量版，索引落 JSON 文件）
 *
 * 分工（2026-09-08 从 TF-IDF 换成真向量时定下的边界）：
 *   切块 / 检索 / 相关度阈值 / 拼 prompt —— 全部手写，这些是能讲原理的部分。
 *   文本 → 向量 —— 交给 services/embeddingService.mjs（百炼 text-embedding-v3）。
 *
 * 为什么不再手搓 TF-IDF：
 *   原来是 bigram 分词 + TF-IDF + 余弦。问题不在于慢，在于它只会字面匹配 ——
 *   「换个说法就检索不到」。而且实测暴露过一个更难看的毛病：
 *   「推荐几家附近的火锅店」能拿 0.1331 分，比「通勤怎么穿显得专业」的 0.0995 还高，
 *   因为它唯一命中的词是「推荐」，查询向量只剩一维时余弦会被虚高。
 *   当时靠一张人工停用词表压住，但那张表得随语料重调 —— 是负债不是资产。
 *   换成语义向量后停用词表整个删掉了。
 *
 * 为什么不上向量数据库：15 篇文档、十几个块，全量算余弦是微秒级。
 *   引入 pgvector/Qdrant 只会多一个要部署的东西，等语料上千再说。
 */
import { readFileSync, readdirSync, writeFileSync, existsSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { embedTexts, embedOne, isEmbeddingEnabled, EMBEDDING_MODEL, EMBEDDING_DIM } from './embeddingService.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DOCS_DIR = join(__dirname, '..', 'rag-docs')
const INDEX_FILE = join(__dirname, '..', 'rag_index.json')
const CHUNK_SIZE = 400
const TOP_K = 3

/**
 * 相关度下限。低于它的片段不返回，让调用方走普通对话而不是硬凑参考资料。
 *
 * 实测标定（2026-09-08，text-embedding-v3 / 1024 维 / 15 篇文档）：
 *   明确相关的 12 个问题：0.5632 ~ 0.8637
 *   明确无关的 9 个问题（写代码 / 点外卖 / 查签证 / 股市…）：0.3418 ~ 0.4544
 *   0.50 卡在中间，两边各有约 0.05 余量。
 *
 * 一个诚实的边界：「明天开会该准备什么材料」拿到 0.5755，会过线命中「面试穿搭」。
 *   没有把阈值抬到 0.58 去挡它，因为它本来就是灰区 —— 在一个穿搭 App 里问这句，
 *   想要穿搭建议是合理解读；而抬到 0.58 就会连「冷白皮适合什么颜色」(0.5632) 一起挡掉。
 *   宁可放过灰区、不可漏掉真相关：buildRAGPrompt 里已经写了「资料没有的直接结合知识补充」，
 *   多一份边缘资料不会逼模型胡说，少一份真资料却会让它答得更差。
 *
 * 换 embedding 模型或维度后必须重新标定 —— 不同模型的余弦分布不一样，这个数字不能跨模型搬。
 * 标定方法见文件末尾。
 */
const MIN_SCORE = 0.5

// ── 向量运算 ──────────────────────────────────────────────

/** 稠密向量余弦。embedding 出来是等长数组，不再是 TF-IDF 那种稀疏对象 */
function cosineSimilarity(a, b) {
  let dot = 0,
    na = 0,
    nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  if (na === 0 || nb === 0) return 0
  return dot / (Math.sqrt(na) * Math.sqrt(nb))
}

// ── 文档切块 ──────────────────────────────────────────────

function chunkText(text, source) {
  const chunks = []
  const sentences = text.split(/(?<=[。！？\n])/)
  let current = '',
    index = 0
  for (const s of sentences) {
    if ((current + s).length > CHUNK_SIZE && current.length > 100) {
      chunks.push({ source, chunkIndex: index++, content: current.trim() })
      current = s
    } else {
      current += s
    }
  }
  if (current.trim()) chunks.push({ source, chunkIndex: index, content: current.trim() })
  return chunks
}

// ── 索引 ──────────────────────────────────────────────────

let chunks = null // [{source, content, vec: number[]}]

/**
 * 缓存是否还能用。
 *
 * 除了原有的「文件增删 / mtime 变了」，还多两条向量特有的判断：
 * 换了 embedding 模型或维度，旧向量和新查询就不在同一个空间里，
 * 算出来的余弦是没有意义的数字 —— 必须重建，不能静默复用。
 */
function isCacheUsable(cached, files) {
  if (!cached || !Array.isArray(cached.chunks) || cached.chunks.length === 0) return false
  if (cached.model !== EMBEDDING_MODEL || cached.dim !== EMBEDDING_DIM) return false
  if (!cached.mtimes) return false

  const cachedSources = [...new Set(cached.chunks.map((c) => c.source))]
  if (files.some((f) => !cachedSources.includes(f))) return false
  if (cachedSources.some((s) => !files.includes(s))) return false
  for (const file of files) {
    if (cached.mtimes[file] !== statSync(join(DOCS_DIR, file)).mtimeMs) return false
  }
  return true
}

export async function initRAG() {
  if (chunks) return

  const files = readdirSync(DOCS_DIR).filter((f) => f.endsWith('.md'))
  if (files.length === 0) {
    chunks = []
    return
  }

  if (existsSync(INDEX_FILE)) {
    try {
      const cached = JSON.parse(readFileSync(INDEX_FILE, 'utf-8'))
      if (isCacheUsable(cached, files)) {
        chunks = cached.chunks
        console.log(`[RAG] 从缓存加载，共 ${chunks.length} 个向量块（${cached.model}）`)
        return
      }
      console.log('[RAG] 缓存已失效（文档变动或换了 embedding 模型），重建索引')
    } catch {
      /* 缓存损坏，重建 */
    }
  }

  if (!isEmbeddingEnabled()) {
    // 没 key 就明确关掉 RAG，而不是偷偷退回关键词检索 ——
    // 「以为在做语义检索、其实没有」比「明确不可用」危险得多。
    console.warn('[RAG] 未配置 DASHSCOPE_API_KEY，语义检索不可用，/chat/rag 将退化为普通对话')
    chunks = []
    return
  }

  const pending = []
  const mtimes = {}
  for (const file of files) {
    mtimes[file] = statSync(join(DOCS_DIR, file)).mtimeMs
    pending.push(...chunkText(readFileSync(join(DOCS_DIR, file), 'utf-8'), file))
  }

  console.log(`[RAG] 向量化 ${files.length} 篇文档 / ${pending.length} 个块（${EMBEDDING_MODEL}）...`)
  const vectors = await embedTexts(pending.map((c) => c.content))
  chunks = pending.map((c, i) => ({ source: c.source, content: c.content, vec: vectors[i] }))

  try {
    writeFileSync(INDEX_FILE, JSON.stringify({ model: EMBEDDING_MODEL, dim: EMBEDDING_DIM, mtimes, chunks }))
  } catch {
    // 索引落盘失败不影响本次检索：内存里已经建好，下次启动重建即可
  }
  console.log(`[RAG] 索引完成，共 ${chunks.length} 个向量块`)
}

// ── 检索 ──────────────────────────────────────────────────

/**
 * 语义检索。返回 top-K 中相关度过线的片段，一条都不过线就返回空数组。
 *
 * 注意是 async —— 查询本身要先向量化。调用方（routes/ai.mjs 的 /chat/rag）要 await。
 * 查不到不抛异常：检索挂了应该退化成普通对话，不该让整个回答失败。
 */
export async function searchRAG(query) {
  await initRAG()
  if (!chunks || chunks.length === 0) return []

  let queryVec = null
  try {
    queryVec = await embedOne(query)
  } catch (err) {
    console.warn('[RAG] 查询向量化失败，本轮跳过检索:', err.message)
    return []
  }
  if (!queryVec) return []

  const scored = chunks.map((c) => ({
    source: c.source,
    content: c.content,
    score: cosineSimilarity(queryVec, c.vec),
  }))
  scored.sort((a, b) => b.score - a.score)
  // 先截 top-K 再卡阈值：低于 MIN_SCORE 的一条都不返回，
  // 宁可让调用方走普通对话，也不要拿不相关的资料硬凑 prompt。
  return scored.slice(0, TOP_K).filter((c) => c.score >= MIN_SCORE)
}

// ── 构建 prompt ──────────────────────────────────────────

export function buildRAGPrompt(userMessage, chunks) {
  if (chunks.length === 0) return null
  const context = chunks.map((c, i) => `【参考资料${i + 1}】\n${c.content}`).join('\n\n')
  return `你是专业穿搭顾问。根据以下资料回答用户问题。资料没有的直接结合知识补充，并说明。

--- 参考资料 ---
${context}
--- 用户问题 ---
${userMessage}

请简洁口语化回答。`
}

/*
 * MIN_SCORE 的标定方法（换模型/换语料后照着重跑一遍）：
 *   准备两组问题 —— 一组穿搭相关、一组完全无关（写代码、点外卖、查签证……），
 *   打印每个问题的 top1 分数，取「相关组最低分」和「无关组最高分」之间的中点。
 *   两组如果重叠，说明检索本身有问题，调阈值治不了，得先看检索。
 */
