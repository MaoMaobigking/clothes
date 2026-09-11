# 双 agent RAG 与用户投喂审美语料 · 实施计划

> 版本：v0.2　日期：2026-09-11　状态：**批次 1 待执行；批次 2/3 暂缓**
> 承接 `docs/开发手册.md` 3.6.3（services 两种目录）。涉及 `server/services/rag/`、`services/ai/tools/`、`constants/`。
> ⚠️ **2026-09-11 降级**：用户投的是**前端岗**，本文档 95% 是后端工作，对前端简历帮助有限。
> 决定只做批次 1（检索地基，自成一体、不碰业务），批次 2/3 暂缓。
> 前端主线见 `docs/前端对标Pinterest实施计划.md`。

## 执行状态

| 批次             | 状态       | 说明                                                                                 |
| ---------------- | ---------- | ------------------------------------------------------------------------------------ |
| 1 检索地基       | **待执行** | rag_chunks 表 + Float32 BLOB + 元数据过滤 + BM25/向量 RRF 混合检索 + 阈值重标定      |
| 2 双库（已砍半） | **暂缓**   | 推荐库语料 + 硬约束表 + `search_knowledge` 工具 + 多路伪查询。**不动三条规则业务链** |
| 3 用户投喂       | **暂缓**   | 上传入库（owner_id）+ LLM 蒸馏审美画像 + 前端入口                                    |

**为什么批次 1 仍然值得做**：混合检索 + RRF 是最可引用的技术点（Cormack et al. SIGIR 2009、RAG-Fusion arXiv 2402.03367），自成一体、不碰任何业务逻辑、有明确的量化验证方式，面试聊到「全栈」时是个具体的后端例子。批次 2/3 的工作量和风险都明显更大，而前端岗收益低。

---

## Context

### 为什么做

现在整个项目**只有一套全局 RAG**，而且是个**死接口**：

- 语料：`server/rag-docs/` 15 篇 md，合计 11 KB，全是「为什么」型的对话知识
- 索引：`rag_index.json`，15 个块，1024 维，**331 KB**，启动时全量载入内存
- 检索：`services/rag/retrieval.mjs`，切块 400 字 / top-3 / `MIN_SCORE=0.5`（2026-09-08 实测标定过）
- **唯一消费者是 `POST /api/chat/rag`，而前端一次都没调过** —— 全前端（含 admin）搜 `chat/rag`、`chat/tools`、`chat/stream` 零命中，`miniapp/src/api/ai/index.ts` 只有 `/api/style-report`、`/api/scene-outfits`、`/api/chat`（**裸对话，不带 RAG**）

目标是两条：**对话 agent 和推荐 agent 各有自己的知识库**，以及**用户可以投喂自己的审美期刊/时尚见解，不投喂的走默认库**。

### 现状里两个容易误判的事实

**① 「推荐 agent」现在有两种，成分完全不同。**

| 链路     | 接口                                               | LLM           | RAG |
| -------- | -------------------------------------------------- | ------------- | --- |
| 风格报告 | `POST /api/style-report` → `generateReport`        | ✅ 结构化输出 | ❌  |
| 场景搭配 | `POST /api/scene-outfits` → `generateSceneOutfits` | ✅ 结构化输出 | ❌  |
| 配饰推荐 | `/api/accessories/recommend`                       | ❌ **纯规则** | ❌  |
| 智能搭配 | `/api/outfits/generate`                            | ❌ **纯规则** | ❌  |
| 场景模拟 | `/api/scene/plans`                                 | ❌ **纯规则** | ❌  |

`services/wardrobe/accessory.mjs`、`wardrobe/outfit.mjs`、`scene/planner.mjs` 压根没有 LLM，是手写规则算法，且有 5 个冒烟脚本在盯。

**② 现在的存储加了 per-user 语料就不成立。**

单块向量写成 JSON 文本要 **21.7 KB**（1024 个 float 的十进制表示）。一个用户传 10 篇 ≈ 30 块 ≈ **650 KB/人**，100 人 = 65 MB JSON 全塞内存。

---

## 调研依据

用户要求「调研现成的出名方法」，结论如下。

### 多租户 RAG 分库

业界只有两种范式（[Pinecone](https://www.pinecone.io/learn/series/vector-databases-in-production-for-busy-engineers/vector-database-multi-tenancy/) / [Truto](https://truto.one/blog/how-to-architect-strict-data-isolation-in-multi-tenant-rag-pipelines/)）：

- **Namespace 隔离** —— 每租户独立索引。边界硬、删除干净、查询快
- **Metadata 过滤** —— 共享索引 + 强制前置过滤。一份文档属于多租户时更灵活

共识是**混合**：namespace 划硬边界，metadata 管细粒度。两条硬警告：**per-user namespace 会命名空间爆炸**；**过滤太窄会伤召回**。

### 检索：RAG-Fusion + RRF

[RAG-Fusion](https://arxiv.org/abs/2402.03367)（[GitHub](https://github.com/Raudaschl/rag-fusion)）就是为「单条 query 覆盖不了完整信息需求」设计的：多路查询 → 并行检索 → RRF 融合。

RRF 出自 Cormack et al. SIGIR 2009，`score(d) = Σ 1/(k + rank_i(d))`，**k=60 是业界标准**。用它而不是直接加分的理由：**余弦 0.85 和 BM25 12.4 不在一个量纲上**，RRF 只用排名所以可比。

**一条反直觉的实测结论**（[工业部署论文](https://arxiv.org/pdf/2603.02153)）：

- **混合检索（BM25 + 向量走 RRF）是「免费午餐」** —— 零 LLM 调用、零额外延迟，MRR 明显提升
- **多路查询单独用，提升很小**
- 两者叉乘最好：+19% NDCG@10、+18% MRR

诚实的边界：这套方法**主要在「查询与语料术语不匹配」时才值回票价**。伪查询若和语料同一套词汇，多路查询收益缩水，**大头在混合检索那一半**。

### 时尚领域

- [Integrating Domain Knowledge into LLMs for Enhanced Fashion Recommendations](https://arxiv.org/pdf/2502.15696) —— 把检索拆成多条 query pathway：直接 embedding + 按风格 + 按场合。最贴本项目
- [FashionKG-RAG](https://arxiv.org/html/2608.22688) —— 知识图谱增强的时尚 QA
- [Agentic Personalized Fashion Recommendation](https://arxiv.org/pdf/2508.02342) —— 粒度分层：属性（颜色/图案/**材质**）→ 单品 → 成套 → 系列；明确要引入**领域本体**
- [OpenAI Cookbook](https://cookbook.openai.com/examples/how_to_combine_gpt4o_with_rag_outfit_assistant) —— **兼容性守卫回路**：建议发回模型做 yes/no 自评

**2025 年的共识结论**：结构化兼容性知识（KG / 搭配模板）+ 向量检索 + **LLM 只当推理器/校验器，不当唯一推荐者**。这正好验证了「LLM 直接推荐效果不理想」的判断。

### 用户投喂语料

锚点 [A Survey of Personalization: From RAG to Agent](https://arxiv.org/pdf/2504.10147)（ACM TOIS），明确区分两条路：**(a) 用户专属语料并进检索库** vs **(b) 用画像改写 query / 重排**。

最接近的现成工作：**PEARL**（挑选用户自己写的内容捕捉个人风格与价值观）、**EMG-RAG**。**Persona-DB** 的分层值得抄：`原始素材 → 蒸馏画像(事实/观点) → 归纳画像(抽象推断) → 高层缓存`。

**文献缺口**：绝大多数从**对话历史**蒸馏画像，而非**用户上传的文档语料**。本项目这条比标准做法靠前。

**已知坑**：靠 LLM 摘要更新记忆，长期会累积冗余和幻觉，反而让个性化退化（[综述](https://arxiv.org/pdf/2604.20006)）。

---

## 决策

| #   | 决定                                                        | 理由                                                                                                                                                                                                                                                                                                                     |
| --- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D1  | **单索引 + 结构化元数据**，不做物理分库                     | 三个正交维度（agent / owner / 内容标签）都靠 metadata；per-user namespace 会爆炸                                                                                                                                                                                                                                         |
| D2  | **向量存 MySQL，Float32 BLOB**                              | 见 D3。BLOB 4096 B vs JSON 21707 B，**小 5.3 倍**                                                                                                                                                                                                                                                                        |
| D3  | **不上向量数据库**，余弦在 Node 里全量算                    | MySQL Community 版**没有 `DISTANCE()`**，只在 HeatWave/MySQL AI 里有（[9.4 手册](https://dev.mysql.com/doc/refman/9.4/en/vector-functions.html)），且 HeatWave 里也是全表扫无 ANN 索引。本项目量级全量算余弦是微秒级，Chroma/Qdrant/DashVector 都只是多一个要部署的东西 —— `retrieval.mjs:16` 那条既有注释的判断依然成立 |
| D4  | **混合检索（BM25 + 向量走 RRF）+ 多路伪查询**               | 研究实测混合是零成本大头；多路伪查询给推荐侧用（无天然 query）                                                                                                                                                                                                                                                           |
| D5  | **用户语料两级：原文进库 + 蒸馏画像**                       | Persona-DB 分层。原文保证可引用可追溯，画像用于拼伪查询和重排                                                                                                                                                                                                                                                            |
| D6  | **硬约束进 `constants/`，语义库只放「为什么」**             | 项目第 4 条规矩（数据与逻辑分离）。**形状要设计成能长成三元组**，按用户要求「先有硬约束，后面可进化」                                                                                                                                                                                                                    |
| D7  | **对话侧 RAG 做成 `search_knowledge` 工具**，不做成固定端点 | agentic RAG，模型自己决定检不检索。问天气就不白烧一次 embedding                                                                                                                                                                                                                                                          |
| D8  | **不动配饰/搭配/场景三条规则链**                            | 工作量最大、风险最高（5 个冒烟脚本在盯）、收益最不确定（LLM 重排未必比现有规则好）。**本轮砍掉**                                                                                                                                                                                                                         |

---

## 实施方案

### 批次 1 — 检索地基（不改任何业务逻辑）

**1.1 新建 `rag_chunks` 表**

照 `db/mysql.mjs` 里已有的 7 个 `migrate*` 函数写幂等迁移。

```sql
CREATE TABLE IF NOT EXISTS rag_chunks (
  id          BIGINT AUTO_INCREMENT PRIMARY KEY,
  owner_id    BIGINT NULL,                       -- NULL = 默认库；非空 = 某用户投喂
  agents      VARCHAR(64) NOT NULL DEFAULT 'chat,recommend',
  source      VARCHAR(255) NOT NULL,
  chunk_index INT NOT NULL,
  content     TEXT NOT NULL,
  vec         BLOB NOT NULL,                     -- Float32Array，非 JSON
  meta        JSON NULL,                         -- bodyType/scene/season/style/fabric
  model       VARCHAR(64) NOT NULL,
  dim         INT NOT NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_owner (owner_id),
  INDEX idx_source (source)
);
```

**批次 1 阶段 `owner_id` 全为 NULL、`meta` 可为空** —— 字段先留位，批次 2/3 才填。

**1.2 Float32 BLOB 编解码**

新增 `services/rag/vector.mjs`：`packVec(number[]) → Buffer` / `unpackVec(Buffer) → Float32Array`。
注意字节序固定用 LE，别依赖平台默认。

**1.3 语料加 frontmatter**

给现有 15 篇补 YAML 头，`services/rag/frontmatter.mjs` 手写一个极简解析器（不引 gray-matter，就几个 key）：

```yaml
---
agents: [chat]
bodyType: []
scene: [通勤]
season: []
style: []
---
```

**1.4 中文 BM25**

新增 `services/rag/bm25.mjs`。中文没有空格，先按 bigram 切（项目 2026-09-08 之前的 TF-IDF 版就是 bigram，实现思路可参考 git 历史）。
`k1=1.2, b=0.75` 标准参数。**约 60 行。**

**1.5 RRF 融合**

新增 `services/rag/fusion.mjs`：

```js
// score(d) = Σ 1/(k + rank_i(d))，k=60（Cormack et al. SIGIR 2009）
// 去重规则：同一块在同一个列表里只算最好名次
export function rrf(lists, { k = 60 } = {}) { ... }
```

**1.6 改造 `retrieval.mjs`**

- `initRAG()` 从 MySQL 读，不再读 `rag_index.json`（保留 JSON 作为一次性迁移源）
- `searchRAG(query, { agent, owner, filter })` —— 先 meta 硬过滤，再 BM25 + 向量两路检索，RRF 融合
- 默认库常驻内存（小），用户库按 userId 懒加载 + LRU

**1.7 重新标定 `MIN_SCORE`（必做）**

**换了融合方式后现在的 `MIN_SCORE=0.5` 直接失效** —— RRF 分数不是余弦，量纲完全不同（rank-1 独占也只有 `1/61 ≈ 0.0164`）。

按 `retrieval.mjs` 文件末尾已经写好的标定方法重跑：准备相关组（穿搭问题）和无关组（写代码/点外卖/查签证）各若干，取「相关组最低分」与「无关组最高分」的中点。**两组若重叠说明检索本身有问题，调阈值治不了。**

原始标定数据留档备查：相关 12 题 0.5632~~0.8637，无关 9 题 0.3418~~0.4544。

---

### 批次 2 — 双库（已砍掉三条规则链改造）

**2.1 推荐库语料**（用户写，我定格式并审）

新增约 15 篇「身材X→穿 Y」型 md，`agents: [recommend]`，frontmatter 打满标签。
现有 15 篇标 `agents: [chat]`；`04-色彩搭配.md` 这种两边都要的标 `[chat, recommend]`。

**2.2 `constants/fashionRules.mjs` 硬约束表**（用户写，我定格式并审）

按 D6，形状要能平滑长成三元组图谱：

```js
// 现在当表查，以后直接当图走 —— 别写成扁平字典
export const FIT_RULES = [
  { s: 'pear', p: '适配', o: 'A字裙', w: 0.9 },
  { s: 'pear', p: '避免', o: '铅笔裤', w: 0.8 },
  { s: '雪纺', p: '适用季节', o: '夏', w: 1.0 },
]
```

规则层用它算候选（确定性、可测试）；语义库只放「为什么梁形适合 A 字裙」这种不可枚举的理由。

**2.3 `search_knowledge` 工具**

`services/ai/tools/handlers.mjs` 的 `TOOLS` 从 5 个加到 6 个：

```
search_garments / get_weather / get_user_profile
generate_style_report / remember_preference
+ search_knowledge          ← 新增
```

`surfaces: ['openai', 'mcp']` 两侧都暴露（MCP 侧 `mcp/server.mjs` 自动跟着走，它直引 `tools/handlers.mjs`）。
`context.userId` 传进去，检索时带上 owner 过滤 —— **userId 绝不从 args 取**，这条纪律 `handlers.mjs:198` 已经写明。

**2.4 多路伪查询**

新增 `services/rag/pseudoQuery.mjs`：画像 → 3 路子查询（身材 / 场景 / 风格）→ 各自 BM25 + 向量 → **一个 RRF 池融合 6 个列表**（不是嵌套融合，按研究里的拓扑）。

接给 `generateReport` 和 `generateSceneOutfits` 用（这两条已经是 LLM 链路，只需往 prompt 里插检索到的知识 + 回引 source）。

---

### 批次 3 — 用户投喂

**3.1 上传入库**

复用现有 multer 基建（`routes/wardrobe.mjs` 和 `routes/custom.mjs` 各有一套 `diskStorage` 可参考）。
新增 `POST /api/rag/corpus`：接文本或 md 文件 → 切块 → embed → 写 `rag_chunks`（`owner_id=req.userId`）。

**注意百炼 embedding 单次上限 10 条**（`services/rag/embedding.mjs:27` 实测记录），复用现成的 `embedTexts` 自动切批。

**3.2 蒸馏审美画像**

新建 `user_taste_profiles` 表。LLM 读完用户上传全文 → 结构化输出：

```json
{
  "偏爱": ["极简", "大地色", "廓形感"],
  "厌恶": ["logo 大字", "荧光色"],
  "面料倾向": ["亚麻", "羊毛"],
  "基调": "法式极简 + 一点解构"
}
```

**必须让用户能看到并手改这份画像** —— 这是对付「LLM 摘要累积幻觉」那个已知失败模式的唯一实用手段。

**3.3 前端入口**

新增投喂页 + 画像展示/编辑页。`miniapp/src/api/` 按项目规矩一域一目录（`api/rag/{index.ts,type.ts}`，URL 收进 `enum API`）。

---

## 验证

```bash
# 批次 1
cd server
npm run check:ai                      # ai/ barrel 未破
node --env-file=.env scripts/checkRag.mjs   # 新增：重新标定阈值 + 打印两组分数分布
npm run check:usage                   # embedding 调用计入 ai_logs

# 批次 2
npm run check:ai                      # 工具清单从 5 → 6
npm run mcp:debug                     # MCP 侧 search_knowledge 可用
# 三条规则链本轮不动，但仍要跑一遍确认没误伤：
npm run check:accessory && npm run check:cart && npm run check:scene

# 批次 3
node --env-file=.env scripts/checkCorpus.mjs  # 新增：A 投喂的语料 B 检索不到（隔离）
npm run check:http                    # 鉴权面未破

# 全批次
cd .. && npm run lint                 # no-undef / no-unused-vars 必须为 0
```

**隔离必测**：用户 A 投喂的语料，用户 B 必须检索不到。这条和项目已有的 `check:isolation` 是同一类要求，别漏。

---

## 明确不做

- **不动配饰/搭配/场景三条规则链**（D8）。它们保持纯规则。以后要接 LLM 重排，形态已经定了：规则算候选 → RAG 多路召回 → LLM 重排+写理由 → Schema 约束 id 必须来自候选集 → 失败退回规则版
- **不上向量数据库**（D3）。等语料上千再说，届时 `services/rag/` 的检索接口不变，只换存储实现
- **不做知识图谱**。硬约束表的三元组形状已经为它留好路（D6）
- **不做多模态检索**（FashionCLIP 那条线）。现有 `services/vision/` 是异步任务协议，和同步 embedding 是两套东西
- **不改 `/api/chat` 前端调用**。对话侧 RAG 走工具（D7），前端无感

---

## 待确认

- 推荐库语料和 `fashionRules.mjs` 的**内容**由用户提供，我只定格式并审校。批次 2 卡在这里
- 批次 1 完成后需要重新跑阈值标定，**这一步必须有真实 DASHSCOPE_API_KEY 和可用的 MySQL**（本文撰写时本机 MySQL 未启动）
