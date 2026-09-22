# AI 服装（灵犀）· 智能穿搭系统

> **一个微信小程序 AI 穿搭助手**，包含 C 端小程序、B 端管理后台、Node 后端、AI 工程化层。
> 涵盖身形测试、AI 风格报告、智能衣橱、虚拟搭配、AI 顾问对话、商城、社群等完整功能。

**技术栈**：uni-app + Vue3 + TypeScript + Pinia + Node.js + Express + MySQL + AI 工程化（结构化输出/流式/工具调用/MCP/RAG）

---

## 📁 项目结构（Monorepo）

```
ai-fashion-studio/
├── miniapp/          # C 端微信小程序（uni-app）
├── admin/            # B 端管理后台（Vue3 + Element Plus）
├── server/           # Node 后端（Express + AI 工程化层）
├── cloudfunctions/   # 云函数
├── deploy/           # 部署脚本
└── docs/             # 项目文档
```

---

## 🚀 快速开始

### 1. 环境要求

- Node.js >= 16
- MySQL >= 5.7
- 微信开发者工具（小程序开发）

### 2. 安装依赖

```bash
# 根目录安装
npm install

# 或分别安装各模块
cd miniapp && npm install
cd ../server && npm install
cd ../admin && npm install
```

### 3. 配置环境变量

在 `server/` 目录创建 `.env` 文件：

```bash
# 数据库配置
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=ai_fashion

# JWT
JWT_SECRET=your-secret-key-here

# AI 配置（DeepSeek / OpenAI / Anthropic）
AI_PROVIDER=deepseek
DEEPSEEK_API_KEY=your-deepseek-key
# OPENAI_API_KEY=your-openai-key
# ANTHROPIC_API_KEY=your-anthropic-key

# 阿里云百炼（RAG 向量化）
DASHSCOPE_API_KEY=your-dashscope-key

# OpenWeather（天气工具）
OPENWEATHER_API_KEY=your-openweather-key
```

### 4. 初始化数据库

```bash
cd server
# 运行建表脚本
mysql -u root -p ai_fashion < schema.sql
```

### 5. 启动服务

```bash
# 启动后端
cd server
npm run dev

# 启动小程序（H5 模式）
cd miniapp
npm run dev:h5

# 启动小程序（微信小程序模式）
cd miniapp
npm run dev:mp-weixin
# 然后用微信开发者工具打开 miniapp/dist/dev/mp-weixin

# 启动管理后台
cd admin
npm run dev
```

---

## 📱 功能模块

### C 端小程序（miniapp/）

| 页面       | 路由                      | 功能                                 |
| ---------- | ------------------------- | ------------------------------------ |
| 首页       | `/pages/home/home`        | 品牌落地页 + 功能入口                |
| AI 工作流  | `/pages/ai/ai`            | AI 功能聚合（测试/顾问/搭配）        |
| 我的衣橱   | `/pages/closet/closet`    | 衣物管理（CRUD/收藏/分类）           |
| 商城       | `/pages/mall/mall`        | 商品浏览 + 购买                      |
| 我的       | `/pages/me/me`            | 个人中心 + 订单 + 收藏               |
| 个性化创建 | `/pages/create/index`     | 创建虚拟形象                         |
| 身形测试   | `/pages/test/index`       | 5 步测试（风格/肤色/脸型/体型/偏好） |
| 风格报告   | `/pages/result/index`     | AI 分析结果（雷达图 + 推荐）         |
| 自由搭配   | `/pages/free-match/index` | 手动选衣搭配                         |
| 情景模拟   | `/pages/scene/index`      | 虚拟试穿 + AI 推荐                   |
| 时尚杂志   | `/pages/magazine/index`   | 内容浏览                             |
| 时尚社群   | `/pages/community/index`  | 用户分享 + 互动                      |
| AI 顾问    | `/pages/stylist/index`    | 对话式穿搭建议（流式 SSE）           |

### B 端管理后台（admin/）

- 用户管理
- 衣物库管理
- 订单管理
- AI 调用监控（可观测性看板）
- 数据统计

### Node 后端（server/）

**分层架构**：routes → services → repositories

**核心能力**：

- ✅ JWT 登录鉴权 + 用户隔离
- ✅ 结构化输出（JSON Schema 约束 + 校验兜底）
- ✅ SSE 流式输出（AI 对话打字机效果）
- ✅ 工具调用（手写 tool-calling 循环）
- ✅ MCP Server（stdio 协议）
- ✅ RAG 向量检索（embedding + 余弦相似度 + 阈值过滤）
- ✅ 多厂商适配（OpenAI / Anthropic / DeepSeek）

---

## 🗄️ 数据库设计

7 张核心表：

```
users              # 用户表
├── body_profiles     # 身形档案
├── style_reports     # ★ AI 风格报告（持久化）
├── garments          # 衣橱
├── outfits           # 搭配方案
│   └── outfit_items      # 搭配明细
└── chat_sessions     # ★ AI 顾问会话
    └── chat_messages     # ★ 对话消息
```

**关键设计**：

- 所有业务表带 `user_id` 外键 → 支持用户隔离
- AI 生成结果持久化到数据库（标 ★）
- 高频查询字段建索引

完整建表 SQL 见 [server/schema.sql](server/schema.sql)

---

## 🤖 AI 工程化亮点

### 1. 结构化输出

- JSON Schema 约束模型输出
- ajv 校验 + 三级兜底（重试/正则修复/默认值）
- 代码：[server/services/aiService.mjs:20-159](server/services/aiService.mjs#L20-L159)

### 2. 流式输出（SSE）

- 真流式推送（逐 token）
- 流式结束后完整消息存库
- 代码：[server/services/aiService.mjs:457-547](server/services/aiService.mjs#L457-L547)

### 3. 工具调用

- 手写 tool-calling 循环（非 SDK 封装）
- 支持多轮工具调用
- 工具：查衣橱/查天气/获取画像/记录偏好/RAG 检索
- 代码：[server/services/aiService.mjs:656-714](server/services/aiService.mjs#L656-L714)

### 4. MCP（Model Context Protocol）

- stdio 协议 MCP Server
- 5 个工具动态发现调用
- 对齐字节 AIDP 技术栈
- 代码：[server/mcp/server.mjs](server/mcp/server.mjs)

### 5. RAG 向量检索

- 阿里云百炼 text-embedding-v3（1024 维）
- 余弦相似度 + 阈值过滤（0.50）
- 手写切块/检索/拼 prompt
- 代码：[server/services/ragService.mjs](server/services/ragService.mjs)

---

## 📚 文档导航

| 文档                                            | 说明                                   |
| ----------------------------------------------- | -------------------------------------- |
| [项目总纲](docs/项目总纲.md)                    | **必读**：架构、战略、路线图、面试话术 |
| [开发手册](docs/开发手册.md)                    | 部署上线、页面规范、图片清单           |
| [后端踩坑记录](docs/后端踩坑/INDEX.md)          | 架构决策、bug 根因、能力矩阵           |
| [补强清单](docs/阿里前端全栈岗-项目补强清单.md) | 功能完成度、验收标准                   |
| [图片清单](docs/图片素材清单.md)                | 所需图片列表（尺寸/位置/内容）         |

---

## 🔧 开发命令

### 小程序（miniapp/）

```bash
npm run dev:h5              # H5 开发
npm run dev:mp-weixin       # 小程序开发
npm run build:h5            # H5 打包
npm run build:mp-weixin     # 小程序打包
npm run check:types         # 类型检查
npm test                    # 运行测试
```

### 后端（server/）

```bash
npm run dev                 # 开发模式
npm start                   # 生产模式
npm test                    # 运行测试
```

### 管理后台（admin/）

```bash
npm run dev                 # 开发模式
npm run build               # 生产打包
npm run preview             # 预览打包结果
```

---

## 🎯 项目定位

**一句话**：一个**双端（小程序 + 后台）、真数据库、有登录鉴权、有 AI 工程化深度、真上过线**的完整系统。

**技能叠加**：

- 前端：Vue3 + TypeScript + Pinia + uni-app + Element Plus
- 后端：Node.js + Express + 三层架构 + JWT
- 数据库：MySQL（表设计/索引/事务）
- AI 工程化：结构化输出/流式/工具调用/MCP/RAG（**护城河**）
- 工程化：TypeScript + ESLint + Prettier + Vitest + CI/CD

**面试亮点**：

- ✅ 用户隔离 + 越权控制（SQL 层 `user_id` 隔离，404 防枚举）
- ✅ AI 结果持久化（存了才是产品，不存只是调 API）
- ✅ 手写 AI 逻辑（不用 LangChain，能讲原理）
- ✅ 多模态能力（图片自动打标签、虚拟试衣）
- ✅ 可观测性（调用日志/成本统计/性能监控）

---

## 📝 开发规范

- 提交规范：Conventional Commits
- 代码风格：ESLint + Prettier
- 类型检查：TypeScript strict mode
- 测试覆盖：Vitest 单元测试 + E2E
- Git 工作流：功能分支 + PR review

---

## 🚢 部署

- 小程序：微信开发者工具 → 上传代码 → 提审发布
- 后端：Docker + docker-compose + PM2
- 数据库：MySQL 云数据库
- 域名：HTTPS（Nginx + Let's Encrypt）

详细部署指南见 [docs/开发手册.md](docs/开发手册.md)

---

## 📄 License

MIT

---

## 👤 作者

朱力鹏 · 浙江工业大学软件工程 2027 届

**联系方式**：见个人简历
