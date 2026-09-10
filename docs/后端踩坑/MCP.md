# 后端踩坑 · MCP Server

> 对应代码：`server/mcp/`
> 索引见 [INDEX.md](./INDEX.md)

---

## 1.3 MCP 进程里没有 userId，身份从哪来

**现象**：给 MCP 工具接真实数据时发现，`profileService.getLatestProfile(userId)` 第一个参数就是 `userId`，
但 MCP 是独立的 stdio 进程 —— 没有 HTTP 请求、没有 `Authorization` 头、没有 JWT 中间件，`executeTool` 拿不到任何身份。

**三条路，只有一条对**：

| 方案                                     | 评价                                      |
| ---------------------------------------- | ----------------------------------------- |
| 工具 `inputSchema` 加 `userId`，让模型填 | ❌ **模型可以填任意值 = 水平越权**        |
| 启动时从 `MCP_USER_ID` 注入，进程级锁定  | ✅ 语义正确：一个 MCP 进程 = 一个用户会话 |
| 环境变量传 JWT，启动时验签解出 userId    | ✅ 进阶版，多用户场景要用                 |

关键认知：**身份在 connect 之前就确定，不在工具参数里。**

实现细节：缺 `MCP_USER_ID` 时 `process.exit(1)`，**不给默认值**。默认成 1 就又变回《总纲》骂的"userId 写死"，隔离等于没做。

> **面试怎么讲**：
> "MCP 是独立 stdio 进程，没有 HTTP 上下文，拿不到 JWT 里的 userId。我一开始想做成工具参数，
> 但立刻意识到模型可以填任意值 —— 那就是水平越权。所以改成启动时注入、进程级锁定身份。
> 同一套 service 和 repo，HTTP 入口从 JWT 拿 userId，MCP 入口从启动配置拿，
> `WHERE user_id = ?` 这道边界两边都守住。"
>
> 这段话里有：协议理解、安全意识、分层设计、以及一个自己否掉的方案。比列工具名值钱得多。

---

## 1.4 为什么还在用已弃用的 Server 类

**现象**：IDE 提示 `@modelcontextprotocol/sdk` 的 `Server` 已弃用，建议用 `McpServer`。

**实测结论（SDK 1.29.0，2026-09-08）**：`McpServer.registerTool` 的 `inputSchema` **只接受 Zod**
（类型上是 `AnySchema = z3.ZodTypeAny | z4.$ZodType`）。传裸 JSON Schema 运行时直接抛：

```
inputSchema must be a Zod schema or raw shape, received an unrecognized object
```

**为什么这是个问题**：本项目的工具 schema 要同时喂两个消费者 ——

- MCP 的 `tools/list`（`inputSchema`）
- OpenAI 的 `tools[].function.parameters`（`GET /api/chat/tools` 直接吐给前端）

后者只认 JSON Schema。改成 Zod 优先就得用 `z.toJSONSchema()` 转回去，而它会多塞
`$schema` 和 `additionalProperties: false` 两个键，得再摸掉才能保证前端契约不变
—— 等于为了消一个提示，给单一真源加一层需要人工消毒的转换。

`Server` 的弃用说明原话是 **"Only use `Server` for advanced use cases"**：
「一份 JSON Schema 同时供 MCP 和非 MCP 两侧」正是这种 case。

**⚠️ 别"顺手修警告"**，会把 `toolCore.mjs` 的单一真源撞碎。原因已写在 `mcp/server.mjs` 的代码注释里。

---
