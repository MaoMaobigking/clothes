# 开启真实 AI（3 步）

这个项目现在有**真实数据库**和**真实大模型**，不再全是写死的。

## 现在哪些是"真"的

| 功能 | 是真的吗 | 靠什么 | 需要 key 吗 |
|---|---|---|---|
| 衣橱（增/删/收藏/查） | ✅ 真数据库 | Node + SQLite（`server/data.db`） | 不需要 |
| 风格报告（结果页） | ✅ 真 AI | 大模型 | 需要 |
| 情景模拟 · AI 推荐 | ✅ 真 AI | 大模型（按天气+风格生成） | 需要 |
| AI 穿搭顾问（对话） | ✅ 真 AI | 大模型 | 需要 |
| 商品/杂志/社群等列表 | ❌ 还是 mock | 之后可入库 | — |

> 衣橱不需要 key：启动后端就是真数据库，能增删改查、刷新后还在。
> 其余三个 AI 功能需要你填 key（下面 3 步）；没填会显示"AI 没连上"并回退本地示意，App 不崩。

密钥放在后端（`.env`），不会暴露到浏览器。

## 第 1 步：填你的 key

打开根目录的 **`.env`**，按你用的服务商改这几行（下面每行是一个例子，挑一行照着填）：

| 服务商 | AI_PROVIDER | AI_BASE_URL | AI_MODEL |
|---|---|---|---|
| DeepSeek | openai | https://api.deepseek.com | deepseek-chat |
| 通义千问 | openai | https://dashscope.aliyuncs.com/compatible-mode/v1 | qwen-plus |
| 智谱 GLM | openai | https://open.bigmodel.cn/api/paas/v4 | glm-4-flash |
| Kimi | openai | https://api.moonshot.cn/v1 | moonshot-v1-8k |
| OpenAI | openai | https://api.openai.com/v1 | gpt-4o-mini |
| Claude | anthropic | （留空） | claude-haiku-4-5-20251001 |

然后把 **`AI_API_KEY=`** 后面填上你的 key。

> 例：用 DeepSeek 就是
> ```
> AI_PROVIDER=openai
> AI_API_KEY=sk-你的key
> AI_MODEL=deepseek-chat
> AI_BASE_URL=https://api.deepseek.com
> ```

## 第 2 步：同时启动前端 + 后端

```bash
npm run dev:all
```

（也可以分开：一个终端 `npm run server`，另一个 `npm run dev`。改了 `.env` 要重启 `server`。）

## 第 3 步：看效果

打开前端 → 首页「开始个性化创建 / 身形测试」→ 做完 5 步 → **风格报告页**。
- 顶部会显示 **✨ 以下由 AI 实时生成**，下面的总结、雷达分数、推荐配色、穿搭推荐、造型建议都是大模型**实时生成**的。
- 点「换一份」会重新让 AI 生成一版。
- 如果 key 没填对，会显示「AI 没连上」并自动回退到本地示意数据（App 不会崩）。

## 自检后端有没有配好

浏览器打开 <http://localhost:8787/api/health> ，看到 `"hasKey":true` 就说明 key 读到了。

---

## 这层是怎么工作的（架构）

```
浏览器(Vue)  ──/api/style-report──►  Node 后端(server/index.mjs)  ──►  大模型API
   结果页                              (保管 key、拼提示词、解析JSON)      (DeepSeek/通义/Claude…)
```

- 前端代码：`src/api/ai.ts`（发请求）、`src/views/ResultReport.vue`（展示）。
- 后端代码：`server/index.mjs`（就一个文件，注释很全，想加别的 AI 功能照着扩）。
- 想让**别的功能也接 AI**（比如情景模拟的推荐、AI 穿搭顾问对话），在 `server/index.mjs` 里照着 `/api/style-report` 再加一个接口即可。
