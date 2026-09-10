/**
 * RAG（检索增强生成）服务层的统一出口。
 *
 * 原来是 services/ 根目录下平铺的 embeddingService.mjs + ragService.mjs 两个文件，
 * 收成一个目录后分工更明显：
 *
 *   embedding.mjs  文本 → 向量，百炼 text-embedding-v3 的同步接口适配。
 *   retrieval.mjs  切块 / 检索 / 相关度阈值 / 拼 prompt，索引落 rag_index.json。
 *
 * 依赖方向：embedding ← retrieval（单向）。
 *
 * 这条边界是 2026-09-08 从 TF-IDF 换真向量时定下的：
 * 编排逻辑全部手写（能讲原理的部分），只把「文本 → 向量」这一环交给模型。
 * 两个文件各自的头部注释有完整理由。
 *
 * 为什么 embedding 不并进 services/vision/：那一层是**异步任务**协议
 * （createTask 拿 task_id 再轮询），embedding 是同步接口一次拿结果，
 * 塞进 CAPABILITIES 表会破坏它自己申明的契约。共用的只有 API Key。
 *
 * ⚠️ ESM 不支持目录导入，引用方必须写全 `services/rag/index.mjs`。
 */

export { EMBEDDING_MODEL, EMBEDDING_DIM, isEmbeddingEnabled, embedTexts, embedOne } from './embedding.mjs'
export { initRAG, searchRAG, buildRAGPrompt } from './retrieval.mjs'
