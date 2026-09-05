/**
 * RAG 服务 — 穿搭知识库检索增强生成（JSON 文件版）
 * 不依赖 SQLite，启动时读文档建索引存 JSON
 */
import { readFileSync, readdirSync, writeFileSync, existsSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DOCS_DIR = join(__dirname, '..', 'rag-docs')
const INDEX_FILE = join(__dirname, '..', 'rag_index.json')
const CHUNK_SIZE = 400
const TOP_K = 3

// ── 中文分词 ──────────────────────────────────────────────

function tokenize(text) {
  const tokens = []
  const segments = text.split(/[，。！？、；：\s\n\r（）【】《》""'']+/).filter(Boolean)
  for (const seg of segments) {
    if (seg.length <= 1) {
      tokens.push(seg)
      continue
    }
    for (let i = 0; i < seg.length - 1; i++) tokens.push(seg.slice(i, i + 2))
    if (seg.length <= 3) tokens.push(seg)
  }
  return tokens
}

// ── TF-IDF ────────────────────────────────────────────────

function computeTF(tokens) {
  const tf = {}
  for (const t of tokens) tf[t] = (tf[t] || 0) + 1
  const len = tokens.length || 1
  for (const k in tf) tf[k] /= len
  return tf
}

function computeIDF(allTokensList) {
  const df = {},
    N = allTokensList.length
  for (const tokens of allTokensList) {
    const seen = new Set(tokens)
    for (const t of seen) df[t] = (df[t] || 0) + 1
  }
  const idf = {}
  for (const t in df) idf[t] = Math.log((N + 1) / (df[t] + 1)) + 1
  return idf
}

function tfidfVector(tf, idf) {
  const vec = {}
  for (const t in tf) if (idf[t]) vec[t] = tf[t] * idf[t]
  return vec
}

function cosineSimilarity(a, b) {
  let dot = 0,
    na = 0,
    nb = 0
  for (const k in a) {
    dot += a[k] * (b[k] || 0)
    na += a[k] * a[k]
  }
  for (const k in b) nb += b[k] * b[k]
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
  if (current.trim()) chunks.push({ source, chunkIndex: index++, content: current.trim() })
  return chunks
}

// ── 索引 ──────────────────────────────────────────────────

let chunks = null // [{source, content, tokens, vec}]
let globalIdf = null // 检索时复用建索引时的 IDF

export function initRAG() {
  if (chunks) return

  // 尝试从缓存加载（含文件修改时间校验）
  if (existsSync(INDEX_FILE)) {
    try {
      const cached = JSON.parse(readFileSync(INDEX_FILE, 'utf-8'))
      const files = readdirSync(DOCS_DIR).filter((f) => f.endsWith('.md'))
      const cachedSources = [...new Set(cached.chunks.map((c) => c.source))]
      const missing = files.filter((f) => !cachedSources.includes(f))
      let stale = false
      // 检查新增/删除文件
      const extra = cachedSources.filter((s) => !files.includes(s))
      if (missing.length > 0 || extra.length > 0) stale = true
      if (!stale) {
        if (!cached.mtimes) {
          stale = true
        } else {
          for (const file of files) {
            if (cached.mtimes[file] !== statSync(join(DOCS_DIR, file)).mtimeMs) {
              stale = true
              break
            }
          }
        }
      }
      if (!stale) {
        chunks = cached.chunks
        globalIdf = cached.idf
        console.log(`[RAG] 从缓存加载，共 ${chunks.length} 个向量块`)
        return
      }
    } catch {
      /* 缓存损坏，重建 */
    }
  }

  // 重建索引
  const files = readdirSync(DOCS_DIR).filter((f) => f.endsWith('.md'))
  if (files.length === 0) {
    chunks = []
    return
  }

  console.log(`[RAG] 索引 ${files.length} 篇文档...`)
  const allChunks = []
  const mtimes = {}
  for (const file of files) {
    mtimes[file] = statSync(join(DOCS_DIR, file)).mtimeMs
    const text = readFileSync(join(DOCS_DIR, file), 'utf-8')
    for (const c of chunkText(text, file)) {
      allChunks.push({ ...c, tokens: tokenize(c.content) })
    }
  }

  const idf = computeIDF(allChunks.map((c) => c.tokens))
  globalIdf = idf
  chunks = allChunks.map((c) => {
    const tf = computeTF(c.tokens)
    const vec = tfidfVector(tf, idf)
    const sorted = Object.entries(vec)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 50)
    return { source: c.source, content: c.content, vec: Object.fromEntries(sorted) }
  })

  // 缓存到文件
  try {
    writeFileSync(INDEX_FILE, JSON.stringify({ chunks, idf: globalIdf, mtimes }))
  } catch {
    // 索引落盘失败不影响本次检索：内存里已经建好，下次启动重建即可
  }
  console.log(`[RAG] 索引完成，共 ${chunks.length} 个向量块`)
}

// ── 检索 ──────────────────────────────────────────────────

export function searchRAG(query) {
  initRAG()
  if (!chunks || chunks.length === 0) return []

  const queryTokens = tokenize(query)
  const queryTF = computeTF(queryTokens)

  // 简单 IDF
  // 复用建索引时的全局 IDF，确保查询和文档在同一向量空间
  const idf = globalIdf || {}
  if (Object.keys(idf).length === 0) {
    const allTokens = new Set()
    for (const c of chunks) for (const k in c.vec) allTokens.add(k)
    for (const t of allTokens) {
      let df = 0
      for (const c of chunks) if (c.vec[t]) df++
      idf[t] = Math.log((chunks.length + 1) / (df + 1)) + 1
    }
  }

  const queryVec = {}
  for (const t in queryTF) if (idf[t]) queryVec[t] = queryTF[t] * idf[t]

  const scored = chunks.map((c) => ({
    source: c.source,
    content: c.content,
    score: cosineSimilarity(queryVec, c.vec),
  }))
  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, TOP_K)
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
