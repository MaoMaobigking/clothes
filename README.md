# 灵犀 · AI 穿搭助手

基于 **uni-app、Vue 3、TypeScript、Node.js 和 MySQL** 的穿搭应用，提供 H5 与微信小程序双端体验，以及独立的管理后台。

从身形与风格档案出发，用户可以管理衣橱、获取搭配建议、与 AI 顾问对话，再通过阿里百炼生成试衣图片。档案、搭配、对话和试衣结果保存在数据库中，按登录用户隔离。

[在线体验](https://maomaobigking.github.io/) · [项目介绍](docs/项目介绍.md) · [验收报告](docs/20261027-项目验收报告.md) · [部署状态](deploy/当前上线状态.md)

## 可以做什么

| 模块           | 当前能力                                                                 |
| -------------- | ------------------------------------------------------------------------ |
| 身形与风格档案 | 分步填写风格、肤色、脸型、体型与偏好，生成并保存风格报告                 |
| 智能衣橱       | 衣物上传、分类、收藏、搭配保存；首页与 AI 页推荐读取本人衣橱             |
| AI 穿搭顾问    | DeepSeek 对话、流式文本、工具调用、会话历史与 H5 断线续接                |
| AI 试衣        | 百炼 `qwen-image-2.1-turbo` 异步出图，支持公网图与本地素材上传           |
| 试衣记录       | 结果转存 MySQL，通过鉴权接口读取；查看最近 20 条记录、刷新进度与图片预览 |
| 管理后台       | 独立管理员登录、用户与订单列表、衣物增删改查、运营概览与 AI 调用统计     |
| 内容与交易演示 | 穿搭分享、教学内容、商品、购物车与订单流程；不接真实支付                 |

### 试衣记录示例

<img src="docs/images/tryon-history.png" width="300" alt="手机宽度下的试衣记录：已完成结果和生成中任务" />

页面示例使用公开演示素材和隔离记录；图中的试衣结果来自真实百炼调用。真实环境另外验证了生成、保存、重新登录读回及用户权限。

## 实现与架构

```text
miniapp/（H5 / 微信小程序）      admin/（Vue 3 + Element Plus）
                │                           │
                └──────── HTTP API ─────────┘
                                  │
                  Express：routes → services → repositories
                       │                         │
               AI / 图片任务服务               MySQL 8
                 │          │              用户、衣橱、会话、
              DeepSeek   阿里百炼           试衣任务与结果图片
```

- **AI 调用层**：统一超时、重试、结构化输出校验与用量记录，支持 DeepSeek、OpenAI 兼容接口及 Anthropic 协议。
- **流式工具调用**：处理文本增量和跨分片工具参数；通过请求编号、事件游标续接 H5 对话，避免重放时重复执行工具。
- **试衣生命周期**：提交任务 → 轮询 → 下载结果 → 数据库保存 → 本人鉴权读取。小程序为不同结果使用独立缓存文件。
- **RAG 与 MCP**：百炼 `text-embedding-v3` 语义向量、余弦相似度与阈值过滤；通过 stdio MCP 暴露业务工具。
- **权限**：JWT 登录，业务查询按用户过滤；管理接口查询数据库角色；私有试衣图禁止匿名与跨用户读取。
- **前端工程**：小程序分包、瀑布流、衣橱并发请求合并、图片按需加载；性能采集默认关闭，按开关和采样率启用。

代码入口：[AI 服务](server/services/ai/) · [试衣服务](server/services/vision/) · [RAG](server/services/rag/) · [MCP](server/mcp/) · [数据表](server/schema.sql)

## 目录

```text
miniapp/          uni-app 客户端；pages 为主包，pages-sub 为业务分包
admin/            Vue 3 + Element Plus 管理后台
server/           Express 接口、业务服务、数据仓库与测试
cloudfunctions/   微信小程序使用的云函数转发
scripts/          构建、浏览器验收与真实环境检查
deploy/           Dockerfile、云托管打包与部署说明
docs/             项目介绍、验收记录和开发文档
.github/          GitHub Actions 自动检查
```

## 本地运行

需要 **Node.js 22.12+、npm、MySQL 8**；小程序开发另需微信开发者工具。以下命令均从仓库根目录执行。

```bash
npm ci
npm ci --prefix miniapp
npm ci --prefix admin
```

将 [server/.env.example](server/.env.example) 复制为 `server/.env`，填写配置。PowerShell 示例：

```powershell
Copy-Item server/.env.example server/.env
```

| 配置                                                | 用途                                                           |
| --------------------------------------------------- | -------------------------------------------------------------- |
| `MYSQL_HOST / PORT / USER / PASSWORD / DATABASE`    | 连接 MySQL；模板端口 3308 对应本机 Docker 映射，按实际环境修改 |
| `JWT_SECRET`                                        | 登录签名密钥，至少 16 位随机值                                 |
| `AI_PROVIDER / AI_API_KEY / AI_MODEL / AI_BASE_URL` | AI 顾问，模板使用 DeepSeek                                     |
| `DASHSCOPE_API_KEY`                                 | 阿里百炼试衣与向量化                                           |
| `BAILIAN_TRYON_MODEL`                               | 默认 `qwen-image-2.1-turbo`                                    |
| `ADMIN_PASSWORD`                                    | 管理员独立密码；生产环境必须配置                               |
| `WX_APPID / WX_SECRET`                              | 微信真实登录；生产环境缺失会明确报错                           |
| `OPENWEATHER_API_KEY`                               | 可选实时天气数据源                                             |
| `MCP_USER_ID`                                       | 独立 MCP 进程的用户身份                                        |

环境变量和密钥不要提交到仓库。数据库初始化与启动：

```bash
npm run db:init --workspace=ai-fashion-server
npm run server
```

在另一个终端选择客户端：

```bash
npm run h5:dev       # H5
npm run mp:dev       # 微信小程序
npm run admin:dev    # 管理后台
```

开发小程序时，用微信开发者工具打开 `miniapp/dist/dev/mp-weixin`。生产配置参考 [miniapp/.env.production.example](miniapp/.env.production.example)。

## 检查与构建

```bash
node scripts/verify-project.mjs
npx playwright install chromium
node scripts/check-ui.mjs
node scripts/check-tryon-history.mjs
```

一键检查覆盖后端测试、前端测试、类型检查及 H5 / 小程序 / 后台构建。浏览器验收使用隔离 API 数据，覆盖首页、对话续接、后台及试衣记录；不会调用付费模型。

[GitHub Actions](.github/workflows/checks.yml) 在 push 和 PR 时执行上述自动检查。[查看运行记录](https://github.com/MaoMaobigking/clothes/actions/workflows/checks.yml)。

真实数据库与模型检查需自行配置环境，单独运行：

```bash
node --env-file=server/.env scripts/check-persistence.mjs
node --env-file=server/.env server/scripts/checkTryon.mjs
```

前者创建并清理独立验收库；后者调用真实百炼模型，会产生出图费用。自动测试、真实接口验收与手机操作验收分别记录，不能互相替代。

## 部署与当前边界

- **网页**：已发布到 GitHub Pages，入口为 [在线体验](https://maomaobigking.github.io/)。
- **后端和后台**：部署在现有微信云托管服务，管理页面由 `/admin/` 提供。
- **小程序**：1.0.3 已上传；体验版状态及新试衣记录的真机验收待确认，尚未提审或正式发布。
- **天气**：目前缺少 OpenWeather 密钥。首页没有实况时不显示温度；其他场景的估算天气带有 `fallback` 标记，不能作为实时天气。
- **对话续接**：当前使用单进程缓存；容器重启或切换实例后不能无损续接。
- **模型验证**：DeepSeek 和百炼已真实调用验证；Anthropic 流式工具协议有测试，尚未使用真实账号验收。
- **未包含**：真实支付、真实物流接入、可用的拍照换脸模型、自动部署流水线。

当前功能与部署以 [上线状态](deploy/当前上线状态.md) 为准；旧规划文档保留历史演进。

## 文档

- [项目介绍](docs/项目介绍.md)：产品功能、技术实现与边界。
- [2026-10-27 验收报告](docs/20261027-项目验收报告.md)：真实调用、权限与发布结果。
- [开发手册](docs/开发手册.md)：开发和部署细节。
- [后端决策记录](docs/后端踩坑/INDEX.md)：架构调整与问题复盘。
- [性能埋点说明](docs/performance-instrumentation.md)：采样、指标口径及验证限制。
- [项目总纲](docs/项目总纲.md)：历史规划与演进。

作者：朱力鹏 · 浙江工业大学软件工程 2027 届。
