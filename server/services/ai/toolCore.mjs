/**
 * 工具的唯一真源（schema + 纯执行逻辑）。
 *
 * 为什么要有这一层：
 *   原来同一批工具定义了两遍 —— services/ai/tools.mjs 给手写 tool-calling 用（OpenAI 格式），
 *   mcp/server.mjs 给 MCP 协议用（inputSchema 格式）。过滤逻辑几乎一样、schema 也几乎一样，
 *   只有外层包装不同。改一个字段忘了另一边就是 bug，所以收敛到这里，两侧各写一个薄适配器。
 *
 * 两侧的真正差异不是格式，是「谁负责取数据」：
 *   - HTTP 侧：routes/ai.mjs 先 await listGarments(req.userId)，profile 从请求体来，塞进 context。
 *   - MCP 侧：没有 HTTP 上下文，mcp/server.mjs 自己用 MCP_USER_ID 查库，再塞进 context。
 *   所以本层共享的是「schema + 吃 context 的纯逻辑」，取数据一律由调用方负责。
 *   这么切也顺带保证了本层不依赖 repositories，不会引入循环引用。
 *
 * 依赖方向：toolCore → usecases → client → provider（usecases 不反向依赖工具层，无环）。
 *           toolCore → weatherService（顶层 service，不属于任何业务域，无环）。
 *           toolCore → profileService（写偏好用，profileService 不反向依赖 AI 层，无环）。
 */
import { generateReport } from './usecases.mjs'
import { resolveWeatherByCity } from '../weatherService.mjs'
import { rememberPreference } from '../profileService.mjs'

/**
 * 工具清单。
 *
 * surfaces 决定这个工具在哪些「面」上暴露：
 *   'openai' → services/ai/tools.mjs 的手写 tool-calling（GET /api/chat/tools 也读它）
 *   'mcp'    → mcp/server.mjs 的 MCP 协议
 * generate_style_report 只在 MCP 暴露 —— 聊天链路里报告是走 POST /api/style-report 的独立接口，
 * 不该让对话模型再多一条路径生成报告。
 */
export const TOOL_SPECS = [
  {
    name: 'search_garments',
    description: '搜索用户的衣橱，根据关键词、分类、颜色等条件查找衣物',
    surfaces: ['openai', 'mcp'],
    schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '搜索关键词（可选，如"白色衬衫"）' },
        category: {
          type: 'string',
          enum: ['top', 'pants', 'skirt', 'dress', 'shoes', 'bag', 'hat', 'jewelry', 'accessory'],
        },
        color: { type: 'string', description: '颜色偏好（可选）' },
      },
    },
  },
  {
    name: 'get_weather',
    description: '查询指定城市的天气信息',
    surfaces: ['openai', 'mcp'],
    schema: {
      type: 'object',
      properties: {
        city: { type: 'string', description: '城市名，如"北京"、"上海"、"重庆"' },
      },
      required: ['city'],
    },
  },
  {
    name: 'get_user_profile',
    description: '获取当前用户的身形数据、风格偏好等信息',
    surfaces: ['openai', 'mcp'],
    schema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'generate_style_report',
    description: '根据当前用户的画像生成专属穿搭风格报告（无需传参，服务端自行读取画像）',
    surfaces: ['mcp'],
    schema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'remember_preference',
    description:
      '记住用户在对话中透露的长期穿搭偏好，下次对话仍然有效。' +
      '只在用户明确表达稳定偏好时调用（如"我不穿亮色""我对羊毛过敏""我通勤要求正式"），' +
      '不要记录一次性的临时需求（如"今天想穿得休闲点"）。',
    surfaces: ['openai', 'mcp'],
    schema: {
      type: 'object',
      properties: {
        key: { type: 'string', description: '偏好的类别，如"颜色禁忌"、"材质过敏"、"通勤要求"' },
        value: { type: 'string', description: '偏好的具体内容，一句话' },
      },
      required: ['key', 'value'],
    },
  },
]

/* ============ 格式适配器 ============ */

/** OpenAI Chat Completions 的 tools 格式 */
export function toOpenAiTools(specs = TOOL_SPECS) {
  return specs
    .filter((spec) => spec.surfaces.includes('openai'))
    .map((spec) => ({
      type: 'function',
      function: { name: spec.name, description: spec.description, parameters: spec.schema },
    }))
}

/** MCP 的 tools/list 格式 */
export function toMcpTools(specs = TOOL_SPECS) {
  return specs
    .filter((spec) => spec.surfaces.includes('mcp'))
    .map((spec) => ({ name: spec.name, description: spec.description, inputSchema: spec.schema }))
}

/* ============ 纯执行逻辑 ============ */

/**
 * 一件衣物是否命中颜色关键词。
 *
 * 注意字段名：repositories/garmentRepo.mjs 的 rowToGarment 产出的是 primaryColor /
 * secondaryColors，没有 color 字段。旧版这里写的是 `(g.color || '').includes(color)`，
 * 恒为空串 —— 传了 color 就一律过滤成 0 条，是个静默 bug，一并修掉。
 */
function matchesColor(garment, color) {
  const pool = [garment.primaryColor || '', ...(garment.secondaryColors || [])]
  return pool.some((c) => String(c).includes(color))
}

/**
 * 执行一个工具，返回喂给模型的文本。
 *
 * @param {string} name 工具名
 * @param {object} args 模型传来的参数
 * @param {object} context 调用方准备好的数据 { garments, profile, userId }
 *   - garments: rowToGarment 形状的数组
 *   - profile: 嵌套形状（styles/skin/face/bmi 在顶层，围度在 body 下），
 *              与 usecases.generateReport 的入参一致
 *   - userId: 只有写工具（remember_preference）需要。**必须由调用方给，不能来自模型参数**
 * @returns {Promise<string>}
 */
export async function runTool(name, args = {}, context = {}) {
  switch (name) {
    case 'search_garments': {
      const { query = '', category, color } = args
      let items = context.garments || []
      if (category) items = items.filter((g) => g.category === category)
      if (query) {
        //将用户输入的查询关键词转为小写
        const q = query.toLowerCase()
        //过滤列表：将每个元素的名称也转为小写，并检查是否包含关键词 q，只保留匹配的项
        items = items.filter((g) => (g.name || '').toLowerCase().includes(q))
      }
      if (color) items = items.filter((g) => matchesColor(g, color))
      if (items.length === 0) return '衣橱中没有找到匹配的衣物。'
      return (
        '衣橱中找到以下衣物：\n' +
        items
          .slice(0, 8)
          .map((g) => `- ${g.emoji || '👕'} ${g.name}（${g.category}，${g.brand || '无品牌'}，¥${g.price}）`)
          .join('\n')
      )
    }

    case 'get_weather': {
      const { city } = args
      // 走真实 OpenWeather（没配 key 或超时会自动降级，不会抛，见 weatherService 注释）。
      // 把 source 带给模型：让它知道这条是实测数据还是降级推算，
      // 而不是把降级值当真实天气斩钉截铁地讲给用户。
      const w = await resolveWeatherByCity(city)
      const label = w.source === 'located' ? '实时' : '推算'
      return `${w.city}天气（${label}）：${w.icon} ${w.condition}，气温 ${w.temp}°C，当前${w.season}`
    }

    case 'get_user_profile': {
      const p = context.profile || {}
      if (!p.styles || p.styles.length === 0) return '用户尚未完成风格测试，没有画像数据。'
      const body = p.body || {}
      return [
        `风格偏好：${p.styles.join('、')}`,
        `肤色：${p.skin || '未填'}；脸型：${p.face || '未填'}；视觉体型：${p.visualBody || '未填'}`,
        `身高 ${body.height ?? '?'}cm，体重 ${body.weight ?? '?'}kg，BMI ${p.bmi ?? '?'}`,
      ].join('\n')
    }

    case 'generate_style_report': {
      const p = context.profile || {}
      if (!p.styles || p.styles.length === 0) return '用户尚未完成风格测试，无法生成风格报告。'
      // generateReport 自带三级兜底：没配 key / 超时 / 不合 Schema 都会退到本地规则版，不会抛。
      const report = await generateReport(p)
      return JSON.stringify(report, null, 2)
    }

    case 'remember_preference': {
      /*
       * 这是唯一一个**写**工具，所以身份来源要特别小心。
       *
       * userId 从 context 来（HTTP 侧是 JWT 解出的 req.userId，MCP 侧是启动时注入的
       * MCP_USER_ID），**绝不从 args 取** —— 模型可以填任意 userId，那就是水平越权。
       * 这和 mcp/server.mjs 里否掉「userId 进 inputSchema」是同一条理由。
       *
       * 写入本身走 profileService.rememberPreference，它只改 preferences 一列、
       * 强制截断、条数封顶。模型碰不到身形数据。
       */
      if (!context.userId) return '当前调用没有用户身份，无法保存偏好。'
      const { key, value } = args
      const res = await rememberPreference(context.userId, key, value)
      if (res.ok) return `已记住偏好：${res.key} —— ${res.value}（当前共 ${res.total} 条）`
      if (res.reason === 'NO_PROFILE') return '用户尚未完成风格测试，还没有画像可以挂载偏好，无法保存。'
      return '偏好内容为空，没有保存。'
    }

    default:
      // 交给调用方决定怎么把错误告知模型：
      // MCP 侧靠 SDK 转成 isError，OpenAI 侧由 aiChatWithTools 的调用处冒泡。
      throw new Error(`未知工具: ${name}`)
  }
}
