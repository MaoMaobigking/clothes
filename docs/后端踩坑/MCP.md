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

**2026-09-10 复核**：这条结论仍然成立。`node_modules` 里 1.29.0 的
`server/mcp.js` 那句 `inputSchema must be a Zod schema or raw shape` 还在。
而且升到 v2 之后也不影响 —— v2 的 stdio 入口 `serveStdio(factory)` 接受
**手工构造的低阶 `Server`**（迁移指南原话 "a hand-constructed `Server`/`McpServer`"），
所以单一真源这套安排跨版本存活，不必为了升级改用 Zod。

---

## 1.7 MCP 2026-07-28 修订：差距核对（结论是「一条都没踩到」）

> 2026-09-10 做的核对。**原本以为这是最紧急的一项，核对下来不是** —— 记下来是因为
> 「以为要大改、实际不用改」本身就是个值得留档的判断过程。

### 背景

MCP 在 **2026-07-28** 发布了上线以来最大的一次修订，官方描述是"回到地基重新思考
MCP 如何跑在 HTTP 上"。主要变化：

- **无状态内核** —— 删掉协议级 session 和 `Mcp-Session-Id`；删掉 `initialize` /
  `notifications/initialized` 握手，改成 `server/discover` 探测；每个请求在 `_meta`
  里自带协议版本、`clientInfo`、`clientCapabilities`
- **MRT 多轮往返**（SEP-2322）取代服务端发起的 sampling / elicitation：
  handler 返回 `inputRequired(...)`，客户端补齐答案后**重发原调用**
- **跨调用状态走 `requestState`**（SEP-2567）：服务端签发的不透明字符串，客户端逐字节回传
- **Roots / Sampling / Logging 废弃**（SEP-2577）；HTTP+SSE 传输降级为 Deprecated
- **扩展框架**（SEP-2133）+ 两个官方扩展：**MCP Apps**（SEP-1865）和 Tasks
- 授权收紧：RFC 9207 issuer 校验、DCR 废弃转向 CIMD
- 正式废弃政策（SEP-2596）：三态 + 至少 12 个月窗口

### 逐条核对本项目

`server/mcp/server.mjs` 的形状：stdio 传输 + 低阶 `Server` + `capabilities` 只声明
`tools` + 四个工具全无状态（每次 `buildContext` 重新查库）+ 身份进程级锁定。

| 破坏性变更                               | 本项目踩到了吗              | 为什么                                                      |
| ---------------------------------------- | --------------------------- | ----------------------------------------------------------- |
| 删 `Mcp-Session-Id` + 协议级 session     | ❌ **不适用**               | 那是 Streamable HTTP 传输的头。本项目是 stdio，一进程一连接 |
| 删 `initialize` 握手 → `server/discover` | ⚠️ **由 SDK 承担**          | 本文件没手写握手                                            |
| `tools/list` 不再随连接变化（可缓存）    | ✅ **已满足**               | `TOOLS` 是模块加载时算好的常量                              |
| `requestState` 取代 per-session 状态     | ❌ **不适用**               | 工具全无状态，身份在 connect 之前就定死                     |
| MRT 取代 sampling / elicitation          | ❌ **不适用**               | 没用这两个                                                  |
| Roots / Sampling / Logging 废弃          | ✅ **不受影响**             | `capabilities` 只声明了 `tools`，三个都没用                 |
| HTTP+SSE 传输降级                        | ❌ **不适用**               | stdio                                                       |
| Tasks 降级为扩展                         | ❌ **不适用**               | 没用                                                        |
| DCR → CIMD、RFC 9207                     | ❌ **不适用**               | stdio 没有授权层                                            |
| 扩展框架                                 | ⚠️ **要做 MCP Apps 才需要** | 见下                                                        |

**结论：一条破坏性变更都没踩到。** 巧合吗？不完全是 —— 破坏性变更集中在
**HTTP 传输、服务端发起的请求、授权**这三块，而本项目恰好三块都没用：
用 stdio、工具是纯查询、没有授权层。**"用得少"在协议换代时是一种韧性。**

### 关键事实：升不升 SDK 都不会坏

`@modelcontextprotocol/sdk@1.29.0`（项目当前）的 `LATEST_PROTOCOL_VERSION` 是
`2025-11-25`。最新的 **1.30.0（2026-07-27 发布）仍是 v1 线**，changelog 全是 bugfix
（stdio buffer 上限、Zod 3.25、Content-Type 校验、SSE keep-alive），**没有 2026-07-28 支持**。

2026-07-28 的支持在**另一套包**里 —— SDK v2 拆成了
`@modelcontextprotocol/core` / `server` / `client` / `node`（全部 2.0.0，2026-07-27 发布），
官方标注 "first **beta** release"。

而且迁移指南写得很明确：

> Nothing in v2 puts a 2026-07-28 byte on the wire by default.
> A hand-constructed `Server`/`McpServer` connected directly to a `StdioServerTransport`
> serves only the 2025-era protocol — **upgrading the SDK changes nothing about what it
> puts on the wire.**

所以「跟上新规范」不是升个版本号就自动发生的事，是一次**显式 opt-in**。

⚠️ **`@modelcontextprotocol/server-legacy` 不是迁移路径** —— 名字有误导性，
它是"冻结的 v1 SSE 传输 + OAuth 授权服务器辅助"，本身已弃用。别按名字猜。

### 真要升级，改动量有多大

stdio 侧的 opt-in 就是一行：

```js
// 现在
await server.connect(new StdioServerTransport())
// 2026-07-28（来自 @modelcontextprotocol/server/stdio）
serveStdio(() => buildServer()) // 也继续服务 2025 era
serveStdio(() => buildServer(), { legacy: 'reject' }) // 只服务 2026
```

加上包名替换（`@modelcontextprotocol/sdk/server/index.js` →
`@modelcontextprotocol/server`）。**注意一处语义变化**：2026 era 的连接上
`getClientCapabilities()` / `getClientVersion()` 返回 `undefined`（那条连接上
`initialize` 从来没跑过），身份改从 `ctx.mcpReq.envelope` 逐请求读。
本项目两个都没调用，所以不受影响。

### 结论与决定

**不为了"跟上"而升级。** 唯一的硬理由是 **MCP Apps**（它是随 2026-07-28 规范发布的
官方扩展，要用就得走 2026 era → 需要 v2 包）。而 v2 是 beta ——
项目的原则是"半年后的面试现场还得跑起来"，把能跑的 stdio server 换到 beta 包上
是有代价的。

**所以次序是**：先确认 MCP Apps 值不值得做；值得，才连带升 v2。
不做 MCP Apps 的话，当前实现在 2025 era 上是完全合规的，不欠债。

---

## 1.8 `requestState` 给了「身份怎么传」的第四个答案（1.3 的续）

2026-07-28 的 `requestState`（SEP-2567）值得单独记一笔，因为它正面回应了
[1.3](#13-mcp-进程里没有-userid身份从哪来) 里被否掉的那个方案。

1.3 的三条路里，第一条「工具 `inputSchema` 加 `userId` 让模型填」被否，
理由是**模型可以填任意值 = 水平越权**。这个判断是对的。

新规范的答案表面上看像同一件事 —— 状态**也是当普通参数传**的 —— 但机制完全不同：

|        | 1.3 否掉的方案 | `requestState`                                  |
| ------ | -------------- | ----------------------------------------------- |
| 谁签发 | **模型自己编** | **服务端签发**                                  |
| 完整性 | 无             | HMAC-SHA256 封签（`createRequestStateCodec`）   |
| 绑定   | 无             | 绑 principal + 原始方法/参数 + 过期时间         |
| 回传时 | 直接信         | **每一轮都过 `verify` 钩子**，验不过答 `-32602` |

迁移指南自己把话说在前面：

> `requestState` round-trips through the client and is therefore **untrusted input** —
> integrity-protect it (HMAC / AEAD over the payload, bound to principal, originating
> method/parameters, and an expiry) and reject failed verification on re-entry.

还有一句关键的：codec 是 **signed, not encrypted** —— 客户端能 base64url 解出内容，
只是改不了。所以它能防篡改，**不能防读**，敏感数据不能往里塞。

**这条对本项目的实际影响：没有**（工具无状态，身份进程级锁定，用不上）。
记下来是因为它把 1.3 那个决定的坐标系补全了。

> **面试怎么讲**（1.3 那段话的升级版）：
> "MCP 是独立 stdio 进程，没有 HTTP 上下文拿不到 JWT。我一开始想做成工具参数，
> 但立刻意识到模型可以填任意值 —— 那就是水平越权。所以改成启动时注入、进程级锁定。
>
> 后来 2026-07-28 的修订给了第四个选项：服务端签发的 `requestState`。
> 它表面上也是'状态进参数'，但签发方是服务端、HMAC 封签、绑 principal 和过期时间、
> 每轮回传都验签 —— 所以它和我否掉的那个方案的区别不在'放哪儿'，在'谁签发'。
> 规范自己也强调它是 untrusted input、必须做完整性保护，而且是签名不是加密，
> 敏感数据不能塞。
>
> 我的场景仍然用进程级锁定，因为一个 stdio 进程本来就对应一个用户会话，
> 引入签名状态是解一个我没有的问题。"

这段话比原版多了两样东西：**协议演进的跟踪**，以及**知道新方案却能说清为什么自己不用**。

---
