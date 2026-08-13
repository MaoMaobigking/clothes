/*
 * AI 服务层（增强版）
 *  - 结构化输出：使用 JSON Schema 约束模型输出，支持 OpenAI/Anthropic 双 provider
 *  - 兜底机制：手写 JSON 提取 + Schema 校验
 *  - 结果入库：style_reports 持久化
 *
 * 环境变量：AI_PROVIDER / AI_API_KEY / AI_MODEL / AI_BASE_URL
 * 使用 Node 18+ 内置 fetch。
 */

const PROVIDER = (process.env.AI_PROVIDER || 'openai').toLowerCase()
const API_KEY = process.env.AI_API_KEY || ''
const MODEL =
  process.env.AI_MODEL ||
  (PROVIDER === 'anthropic' ? 'claude-haiku-4-5-20251001' : 'gpt-4o-mini')
const BASE_URL =
  process.env.AI_BASE_URL ||
  (PROVIDER === 'anthropic' ? 'https://api.anthropic.com' : 'https://api.openai.com/v1')

/* ============ JSON Schema 定义 ============ */

const STYLE_REPORT_SCHEMA = {
  name: 'style_report',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      summary: { type: 'string', description: '一句话风格总结，20字以内' },
      radar: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', enum: ['风格', '肤色', '脸型', '体型', '偏好'] },
            value: { type: 'number', minimum: 0, maximum: 100 },
          },
          required: ['name', 'value'],
          additionalProperties: false,
        },
        minItems: 5,
        maxItems: 5,
      },
      palette: { type: 'array', items: { type: 'string' }, minItems: 4, maxItems: 6 },
      recommendations: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            scene: { type: 'string' },
            pieces: { type: 'array', items: { type: 'string' }, minItems: 2 },
            reason: { type: 'string' },
          },
          required: ['title', 'scene', 'pieces', 'reason'],
          additionalProperties: false,
        },
        minItems: 1,
        maxItems: 5,
      },
      tips: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 5 },
    },
    required: ['summary', 'radar', 'palette', 'recommendations', 'tips'],
    additionalProperties: false,
  },
}

const SCENE_OUTFIT_SCHEMA = {
  name: 'scene_outfits',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      outfits: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            scene: { type: 'string' },
            reason: { type: 'string' },
            pieces: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  emoji: { type: 'string' },
                },
                required: ['name', 'emoji'],
                additionalProperties: false,
              },
              minItems: 3,
              maxItems: 8,
            },
          },
          required: ['title', 'scene', 'reason', 'pieces'],
          additionalProperties: false,
        },
        minItems: 1,
        maxItems: 5,
      },
    },
    required: ['outfits'],
    additionalProperties: false,
  },
}

/* ============ Schema 校验（手写，不用 ajv 依赖） ============ */

function validateSchema(data, schema) {
  const errors = []
  const s = schema.schema

  // 检查 required 字段
  if (s.required) {
    for (const key of s.required) {
      if (!(key in data)) errors.push(`缺少必填字段: ${key}`)
    }
  }

  // 检查类型
  if (s.properties) {
    for (const [key, prop] of Object.entries(s.properties)) {
      if (!(key in data)) continue
      const val = data[key]
      if (prop.type === 'array' && !Array.isArray(val)) {
        errors.push(`字段 ${key} 应为数组`)
        continue
      }
      if (prop.type === 'string' && typeof val !== 'string') {
        errors.push(`字段 ${key} 应为字符串`)
      }
      if (prop.type === 'number' && typeof val !== 'number') {
        errors.push(`字段 ${key} 应为数字`)
      }
      // 枚举检查
      if (prop.enum && !prop.enum.includes(val)) {
        errors.push(`字段 ${key} 值 "${val}" 不在允许范围内`)
      }
      // 数组长度
      if (prop.minItems && Array.isArray(val) && val.length < prop.minItems) {
        errors.push(`字段 ${key} 至少需要 ${prop.minItems} 项，当前 ${val.length} 项`)
      }
      if (prop.maxItems && Array.isArray(val) && val.length > prop.maxItems) {
        errors.push(`字段 ${key} 最多 ${prop.maxItems} 项，当前 ${val.length} 项`)
      }
    }
  }

  if (Array.isArray(data.radar)) {
    const radarNames = ['风格', '肤色', '脸型', '体型', '偏好']
    data.radar.forEach((item, index) => {
      if (!item || typeof item !== 'object' || !radarNames.includes(item.name)) {
        errors.push(`radar 第 ${index + 1} 项维度名不合法`)
      }
      if (!Number.isFinite(Number(item.value)) || item.value < 0 || item.value > 100) {
        errors.push(`radar 第 ${index + 1} 项分数不合法`)
      }
    })
  }

  if (Array.isArray(data.recommendations)) {
    data.recommendations.forEach((item, index) => {
      if (!item || typeof item !== 'object') {
        errors.push(`recommendations 第 ${index + 1} 项不是对象`)
        return
      }
      for (const key of ['title', 'scene', 'pieces', 'reason']) {
        if (!(key in item)) errors.push(`recommendations 第 ${index + 1} 项缺少 ${key}`)
      }
      if (!Array.isArray(item.pieces) || item.pieces.length < 2) {
        errors.push(`recommendations 第 ${index + 1} 项的 pieces 至少需要 2 件单品`)
      }
    })
  }

  // 禁止额外字段
  if (s.additionalProperties === false && s.properties) {
    const knownKeys = new Set(Object.keys(s.properties))
    for (const key of Object.keys(data)) {
      if (!knownKeys.has(key)) errors.push(`未知字段: ${key}`)
    }
  }

  return { valid: errors.length === 0, errors }
}

/**
 * 不同模型对“结构化输出”的键名偶尔不一致。这里只做兼容映射，
 * 不改模型给出的业务内容；映射后仍不合法就交给规则版兜底。
 */
function normalizeStyleReport(result) {
  const next = { ...(result || {}) }
  if (next.radar && !Array.isArray(next.radar)) {
    const source = next.radar
    const names = ['风格', '肤色', '脸型', '体型', '偏好']
    next.radar = names
      .map((name) => ({
        name,
        value: Number(source[name]) || 0,
      }))
      .filter((item) => Number.isFinite(item.value))
  }

  if (Array.isArray(next.recommendations)) {
    next.recommendations = next.recommendations
      .map((item) => {
        if (!item || typeof item !== 'object') return null
        return {
          title: String(item.title || '穿搭方案'),
          scene: String(item.scene || item.occasion || '日常'),
          pieces: Array.isArray(item.pieces)
            ? item.pieces.map(String)
            : Array.isArray(item.items)
              ? item.items.map(String)
              : [],
          reason: String(item.reason || ''),
        }
      })
      .filter((item) => item && item.pieces.length >= 2)
  }

  if (!Array.isArray(next.palette)) next.palette = []
  if (!Array.isArray(next.tips)) next.tips = []
  if (typeof next.summary !== 'string') next.summary = ''
  return next
}

/* ============ AI 核心调用（支持 structured output） ============ */

/**
 * 带 JSON Schema 的结构化调用
 * @param {object} opts
 * @param {string} opts.system
 * @param {string} opts.prompt
 * @param {object} opts.jsonSchema - OpenAI 格式的 json_schema 定义
 * @returns {Promise<any>} 解析后的 JSON 对象
 */
async function structuredComplete({ system, prompt, jsonSchema }) {
  if (PROVIDER === 'anthropic') {
    return structuredAnthropic(system, prompt, jsonSchema)
  }
  return structuredOpenAI(system, prompt, jsonSchema)
}

/** OpenAI: 使用 response_format { type: "json_schema" } */
async function structuredOpenAI(system, prompt, jsonSchema) {
  const body = {
    model: MODEL,
    temperature: 0.7,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: prompt },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: jsonSchema,
    },
  }
  const r = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify(body),
  })
  if (!r.ok) {
    const errText = await r.text()
    // 如果 provider 不支持 json_schema（如某些代理），回退到普通调用 + 手动解析
    if (r.status === 400 && errText.includes('json_schema')) {
      console.warn('[aiService] Provider 不支持 json_schema，回退到 prompt 约束 + 手动解析')
      return fallbackJsonCall(system, prompt, jsonSchema)
    }
    throw new Error(`OpenAI 接口 ${r.status}: ${errText}`)
  }
  const data = await r.json()
  const content = data.choices?.[0]?.message?.content ?? ''
  return parseJson(content, jsonSchema)
}

/** Anthropic: 使用 tool_use 模拟 structured output */
async function structuredAnthropic(system, prompt, jsonSchema) {
  // Anthropic 原生 structured output 需要新版 API，这里用 tool_use 模拟
  const body = {
    model: MODEL,
    max_tokens: 2000,
    system,
    messages: [{ role: 'user', content: prompt }],
    tools: [
      {
        name: jsonSchema.name,
        description: `返回符合 schema 的 JSON: ${JSON.stringify(jsonSchema.schema)}`,
        input_schema: jsonSchema.schema,
      },
    ],
    tool_choice: { type: 'tool', name: jsonSchema.name },
  }
  const r = await fetch(`${BASE_URL}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  })
  if (!r.ok) throw new Error(`Anthropic 接口 ${r.status}: ${await r.text()}`)
  const data = await r.json()

  // 从 tool_use 块提取 JSON
  for (const block of data.content || []) {
    if (block.type === 'tool_use' && block.name === jsonSchema.name) {
      return block.input
    }
  }
  // 回退：从文本中提取
  const text = data.content?.find((c) => c.type === 'text')?.text || ''
  return parseJson(text, jsonSchema)
}

/** 兜底：普通调用 + 手动 JSON 提取 + Schema 校验 */
async function fallbackJsonCall(system, prompt, jsonSchema) {
  const text = await aiCompleteText(system, prompt)
  return parseJson(text, jsonSchema)
}

/** 普通文本补全（无 structured output） */
async function aiCompleteText(system, prompt) {
  const text = await aiComplete({
    system,
    messages: [{ role: 'user', content: prompt }],
  })
  return text
}

/* ============ 对外接口 ============ */

function withTimeout(promise, ms, label) {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const err = new Error(`${label}超时（${ms}ms）`)
      err.code = 'AI_TIMEOUT'
      reject(err)
    }, ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

/** 生成风格报告（JSON Schema 约束） */
export async function generateReport(profile) {
  const p = profile || {}
  const b = p.body || {}
  const info = [
    `喜欢的风格：${(p.styles || []).join('、') || '未填'}`,
    `肤色：${p.skin || '未填'}；脸型：${p.face || '未填'}`,
    `身高${b.height ?? '?'}cm 体重${b.weight ?? '?'}kg BMI${p.bmi ?? '?'}`,
    `围度：胸${b.bust ?? '?'} 腰${b.waist ?? '?'} 大腿${b.thigh ?? '?'} 小腿${b.calf ?? '?'}`,
    `偏好：${JSON.stringify(p.preferences || {})}`,
  ].join('\n')

  const prompt = `根据以下用户画像，生成专属穿搭风格报告：
${info}

要求：
- summary：20字内风格总结
- radar：5个维度评分(风格/肤色/脸型/体型/偏好)，0-100分
- palette：4-6个推荐色号（#RRGGBB格式）
- recommendations：3套穿搭推荐，每套含标题、场合、单品列表、推荐理由
- tips：3条实用造型建议`

  // 尝试结构化输出
  let result = null
  let lastError = null

  try {
    if (API_KEY) {
      result = await withTimeout(
        structuredComplete({
          system: '你是专业中文时尚穿搭顾问。',
          prompt,
          jsonSchema: STYLE_REPORT_SCHEMA,
        }),
        12000,
        '风格报告生成',
      )
    } else {
      throw new Error('未配置 AI_API_KEY')
    }
  } catch (e) {
    lastError = e
    console.warn('[aiService] 结构化输出失败，尝试兜底:', e.message)
  }

  // 兜底：普通调用
  if (!result) {
    try {
      if (API_KEY) {
        const text = await withTimeout(
          aiCompleteText('你是专业中文时尚穿搭顾问。只输出一个 JSON 对象。', prompt),
          12000,
          '风格报告文本兜底',
        )
        result = parseJson(text, STYLE_REPORT_SCHEMA)
      }
    } catch (e2) {
      lastError = lastError || e2
    }
  }

  if (!result) {
    return {
      ...buildRuleStyleReport(profile),
      source: 'rule',
      aiError: lastError?.message || 'AI 暂时不可用',
    }
  }

  // Schema 校验
  result = normalizeStyleReport(result)
  const { valid, errors } = validateSchema(result, STYLE_REPORT_SCHEMA)
  if (!valid) {
    console.warn('[aiService] Schema 校验警告:', errors.join('; '))
    return {
      ...buildRuleStyleReport(profile),
      source: 'rule',
      aiError: `模型结果不符合结构约束：${errors.join('; ')}`,
    }
  }

  return { ...result, source: 'ai' }
}

/**
 * 规则版风格报告：AI 不参与，只使用真实测试答案和身体参数。
 * 这是现场演示的兜底路径，不是给空画像编数据。
 */
function buildRuleStyleReport(profile = {}) {
  const styles = Array.isArray(profile.styles) ? profile.styles : []
  const skin = profile.skin || ''
  const face = profile.face || ''
  const body = profile.body || {}
  const preferences = profile.preferences || {}
  const height = Number(body.height) || null
  const weight = Number(body.weight) || null
  const bmi = height && weight ? Math.round((weight / (height / 100) ** 2) * 10) / 10 : null
  const styleLabels = styles.filter(Boolean)
  const mainStyle = styleLabels[0] || '百搭'
  const prefCount = Object.keys(preferences).filter((key) => preferences[key]).length

  const radar = [
    { name: '风格', value: Math.round(40 + (Math.min(styleLabels.length, 3) / 3) * 60) },
    { name: '肤色', value: skin ? 78 : 0, incomplete: !skin },
    { name: '脸型', value: face ? 82 : 0, incomplete: !face },
    {
      name: '体型',
      value: bmi === null ? 0 : Math.min(100, Math.max(40, Math.round(100 - Math.abs(bmi - 21) * 4))),
    },
    {
      name: '偏好',
      value: Math.round((prefCount / 5) * 100),
      incomplete: prefCount < 5,
    },
  ]

  const palettes = {
    '休闲街头': ['#2f2f3a', '#b8c8d8', '#e8e2d0', '#d97757'],
    '简约通勤': ['#3f4655', '#a9b6c9', '#e7e4da', '#8d7f6f'],
    '法式浪漫': ['#f4c6d2', '#e0d0ee', '#f7efe2', '#9d7188'],
    '韩系甜美': ['#ffd9e6', '#ffb3d1', '#f4e3ff', '#c9a7d8'],
    '复古优雅': ['#d9b58f', '#6f4e3d', '#efe6d5', '#9b5b3f'],
    '运动机能': ['#1f2933', '#6fc9b0', '#e8edf0', '#ff9e5e'],
  }
  const palette = palettes[mainStyle] || palettes['简约通勤']

  const piecesByStyle = {
    '休闲街头': ['白T恤', '牛仔外套', '直筒裤', '厚底板鞋'],
    '简约通勤': ['衬衫', '西装裤', '针织开衫', '托特包'],
    '法式浪漫': ['泡泡袖衬衫', '碎花半裙', '玛丽珍鞋', '珍珠耳饰'],
    '韩系甜美': ['娃娃领上衣', '百褶裙', '针织开衫', '小方包'],
    '复古优雅': ['格纹西装', '直筒牛仔裤', '乐福鞋', '丝巾'],
    '运动机能': ['冲锋衣', '束脚裤', '机能鞋', '帆布包'],
  }
  const pieces = piecesByStyle[mainStyle] || piecesByStyle['简约通勤']
  const scenes = ['日常通勤', '周末约会', '轻运动']
  const recommendations = scenes.map((scene, i) => ({
    title: `「${mainStyle}」${scene}方案`,
    scene,
    pieces: [pieces[0], pieces[(i + 1) % pieces.length], pieces[(i + 2) % pieces.length], pieces[(i + 3) % pieces.length]],
    reason: `基于你选择的 ${styleLabels.slice(0, 3).join('、')} 风格和当前身体参数生成，适合作为${scene}参考。`,
  }))

  const tips = [
    skin
      ? `你的肤色输入为${skin}，优先选择同色系低饱和配色会更协调。`
      : '未填写肤色时，先使用黑白灰和低饱和基础色最稳妥。',
    bmi === null
      ? '完成身高体重后，可以进一步判断版型和腰线选择。'
      : bmi < 18.5
        ? '你的 BMI 偏低，建议优先选择有肩线的外套和微廓形单品。'
        : bmi > 24
          ? '你的 BMI 偏高，建议利用垂直线条和收腰剪裁增加利落感。'
          : '你的身形比例较均衡，可以尝试叠穿和局部亮色。',
    '一套造型尽量不超过 3 个主色，鞋包统一色系更容易保持整体感。',
  ]

  const summary = [skin, face, `偏爱「${mainStyle}」`].filter(Boolean).join(' · ')
  return { summary, radar, palette, recommendations, tips }
}

/** 生成情景搭配推荐（JSON Schema 约束） */
export async function generateSceneOutfits(payload) {
  const { scene = '日常', weather = {}, profile = {} } = payload
  const w = `${weather.city || ''} ${weather.temp ?? ''}° ${weather.condition || ''}`.trim()

  const prompt = `场景：${scene}
天气：${w || '未知'}
用户偏好风格：${(profile.styles || []).join('、') || '不限'}

根据场景和天气，生成3套完整穿搭。每套4-6件单品，每件配一个 emoji。`

  let result = null
  let lastError = null

  try {
    result = await structuredComplete({
      system: '你是专业中文穿搭顾问。',
      prompt,
      jsonSchema: SCENE_OUTFIT_SCHEMA,
    })
  } catch (e) {
    lastError = e
  }

  if (!result) {
    try {
      const text = await aiCompleteText('你是专业中文穿搭顾问。只输出一个 JSON 对象。', prompt)
      result = parseJson(text, SCENE_OUTFIT_SCHEMA)
    } catch (e2) {
      throw lastError || e2
    }
  }

  const { valid, errors } = validateSchema(result, SCENE_OUTFIT_SCHEMA)
  if (!valid) console.warn('[aiService] Scene Schema 校验警告:', errors.join('; '))

  return result
}

/** AI 穿搭顾问对话 */
export async function aiChat(messages, system) {
  const sys =
    system ||
    '你是「灵犀」——一个亲切专业的中文穿搭顾问。回答简洁口语化，多给具体、可执行的单品和搭配建议，必要时分点。不要超过 200 字。'
  const reply = await aiComplete({
    system: sys,
    messages: messages.map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: String(m.content || ''),
    })),
  })
  return reply
}

/* ============ 底层 provider 适配 ============ */

export async function aiComplete({ system, messages }) {
  return PROVIDER === 'anthropic'
    ? callAnthropic(system, messages)
    : callOpenAI(system, messages)
}

export async function callOpenAI(system, messages) {
  const r = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.8,
      messages: [{ role: 'system', content: system }, ...messages],
    }),
  })
  if (!r.ok) throw new Error(`OpenAI兼容接口 ${r.status}: ${await r.text()}`)
  const data = await r.json()
  return data.choices?.[0]?.message?.content ?? ''
}

export async function callAnthropic(system, messages) {
  const r = await fetch(`${BASE_URL}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({ model: MODEL, max_tokens: 1200, system, messages }),
  })
  if (!r.ok) throw new Error(`Anthropic接口 ${r.status}: ${await r.text()}`)
  const data = await r.json()
  return data.content?.[0]?.text ?? ''
}

/** 手写 JSON 提取 + Schema 校验 */
export function parseJson(text, jsonSchema) {
  if (!text) throw new Error('模型返回为空')
  let s = String(text).trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim()
  const a = s.indexOf('{')
  const b = s.lastIndexOf('}')
  if (a === -1 || b === -1) throw new Error('模型没返回 JSON：' + s.slice(0, 200))

  let parsed
  try {
    parsed = JSON.parse(s.slice(a, b + 1))
  } catch (e) {
    throw new Error('JSON 解析失败: ' + e.message + '\n原始片段: ' + s.slice(0, 300))
  }

  // 有 Schema 则校验
  if (jsonSchema) {
    const { valid, errors } = validateSchema(parsed, jsonSchema)
    if (!valid) {
      console.warn('[aiService] JSON Schema 校验失败:', errors.join('; '))
      // 不抛异常，返回数据让上层决定
    }
  }

  return parsed
}

// 导出 Schema 供外部使用
export { STYLE_REPORT_SCHEMA, SCENE_OUTFIT_SCHEMA }

/* ============ 3.2 SSE 流式输出 ============ */

/**
 * 流式 AI 对话（SSE）
 * @param {string[]} messages - [{role, content}]
 * @param {string} [system] - 系统 prompt
 * @param {function} onChunk - 每收到一个 token 回调 (delta: string)
 * @param {AbortSignal} [signal] - 取消信号
 * @returns {Promise<string>} 完整回复文本
 */
export async function aiChatStream(messages, system, onChunk, signal) {
  const sys = system || '你是「灵犀」——一个亲切专业的中文穿搭顾问。回答简洁口语化，多给具体、可执行的单品和搭配建议，必要时分点。不要超过 200 字。'
  
  if (PROVIDER === 'anthropic') {
    return streamAnthropic(sys, messages, onChunk, signal)
  }
  return streamOpenAI(sys, messages, onChunk, signal)
}

/** OpenAI 流式 */
async function streamOpenAI(system, messages, onChunk, signal) {
  const r = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.8,
      stream: true,
      messages: [{ role: 'system', content: system }, ...messages],
    }),
    signal,
  })
  if (!r.ok) throw new Error(`OpenAI 流式接口 ${r.status}: ${await r.text()}`)
  
  const reader = r.body.getReader()
  const decoder = new TextDecoder()
  let fullText = ''
  
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const chunk = decoder.decode(value, { stream: true })
    for (const line of chunk.split('\n')) {
      if (!line.startsWith('data: ')) continue
      const data = line.slice(6).trim()
      if (data === '[DONE]') continue
      try {
        const json = JSON.parse(data)
        const delta = json.choices?.[0]?.delta?.content || ''
        if (delta) {
          fullText += delta
          onChunk(delta)
        }
      } catch { /* 忽略解析错误的行 */ }
    }
  }
  return fullText
}

/** Anthropic 流式 */
async function streamAnthropic(system, messages, onChunk, signal) {
  const r = await fetch(`${BASE_URL}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1200,
      system,
      messages,
      stream: true,
    }),
    signal,
  })
  if (!r.ok) throw new Error(`Anthropic 流式接口 ${r.status}: ${await r.text()}`)
  
  const reader = r.body.getReader()
  const decoder = new TextDecoder()
  let fullText = ''
  
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const chunk = decoder.decode(value, { stream: true })
    for (const line of chunk.split('\n')) {
      if (!line.startsWith('data: ')) continue
      const data = line.slice(6).trim()
      try {
        const json = JSON.parse(data)
        if (json.type === 'content_block_delta' && json.delta?.text) {
          fullText += json.delta.text
          onChunk(json.delta.text)
        }
      } catch { /* ignore */ }
    }
  }
  return fullText
}

/* ============ 3.3 工具调用（手写 tool-calling 循环） ============ */

/**
 * 工具定义
 */
export const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'search_garments',
      description: '搜索用户的衣橱，根据关键词、分类、颜色等条件查找衣物',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: '搜索关键词（可选，如"白色衬衫"）' },
          category: { type: 'string', enum: ['top','pants','skirt','dress','shoes','bag','hat','jewelry','accessory'] },
          color: { type: 'string', description: '颜色偏好（可选）' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_weather',
      description: '查询指定城市的天气信息',
      parameters: {
        type: 'object',
        properties: {
          city: { type: 'string', description: '城市名，如"北京"、"上海"、"重庆"' },
        },
        required: ['city'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_user_profile',
      description: '获取当前用户的身形数据、风格偏好等信息',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
]

/**
 * 工具执行器
 * @param {string} name 工具名
 * @param {object} args 参数
 * @param {object} context 上下文（garmentRepo, weather mock 等）
 * @returns {Promise<string>} 工具执行结果的文本描述
 */
export async function executeTool(name, args, context = {}) {
  switch (name) {
    case 'search_garments': {
      const { query = '', category, color } = args
      let items = context.garments || []
      if (category) items = items.filter(g => g.category === category)
      if (query) {
        const q = query.toLowerCase()
        items = items.filter(g => g.name.toLowerCase().includes(q) || (g.tags || []).some(t => t.toLowerCase().includes(q)))
      }
      if (color) items = items.filter(g => (g.color || '').includes(color))
      if (items.length === 0) return '衣橱中没有找到匹配的衣物。'
      return '衣橱中找到以下衣物：\n' + items.slice(0, 8).map(g =>
        `- ${g.emoji || '👕'} ${g.name}（${g.category}，${g.brand || ''}，¥${g.price}）`
      ).join('\n')
    }
    case 'get_weather': {
      const { city } = args
      // Mock 天气数据（生产环境接入真实天气 API）
      const mockWeather = {
        '北京': { temp: 25, condition: '晴', icon: '☀️' },
        '上海': { temp: 28, condition: '多云', icon: '⛅' },
        '重庆': { temp: 23, condition: '暴雨', icon: '🌧️' },
        '广州': { temp: 30, condition: '雷阵雨', icon: '⛈️' },
      }
      const w = mockWeather[city] || { temp: 22, condition: '多云', icon: '☁️' }
      return `${city}天气：${w.icon} ${w.condition}，气温 ${w.temp}°C`
    }
    case 'get_user_profile': {
      const ctx = context.profile || {}
      if (!ctx.styles || ctx.styles.length === 0) return '用户尚未完成风格测试，没有画像数据。'
      return `用户画像：风格偏好 ${ctx.styles.join('、')}，肤色 ${ctx.skin || '未知'}，脸型 ${ctx.face || '未知'}，BMI ${ctx.bmi || '未知'}`
    }
    default:
      return `未知工具: ${name}`
  }
}

/**
 * 手写 tool-calling 循环
 * 
 * 流程：
 * 1. 用户消息 + tools 定义 → 调模型
 * 2. 模型返回 tool_calls? → 执行工具 → 结果喂回模型
 * 3. 模型返回 text? → 流式输出给用户 → 结束
 * 
 * @param {string[]} messages - [{role, content}]
 * @param {function} onChunk - 流式回调
 * @param {object} context - 工具执行上下文 { garments, profile }
 * @param {AbortSignal} [signal]
 * @returns {Promise<string>} 完整回复文本
 */
export async function aiChatWithTools(messages, onChunk, context = {}, signal) {
  const system = '你是「灵犀」——一个亲切专业的中文穿搭顾问。你可以使用工具来查询用户的衣橱、天气和画像信息，从而给出更精准的建议。'
  
  // 最多循环 5 轮（防止无限循环）
  for (let round = 0; round < 5; round++) {
    const body = {
      model: MODEL,
      temperature: 0.8,
      messages: [
        { role: 'system', content: system },
        ...messages.map(m => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: String(m.content || ''),
        })),
      ],
      tools: TOOLS,
      tool_choice: 'auto',
    }

    const r = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
      body: JSON.stringify(body),
      signal,
    })
    if (!r.ok) throw new Error(`OpenAI 接口 ${r.status}: ${await r.text()}`)
    const data = await r.json()
    const msg = data.choices?.[0]?.message
    if (!msg) throw new Error('模型返回为空')

    // 检查是否有 tool_calls
    if (msg.tool_calls && msg.tool_calls.length > 0) {
      // 记录 assistant 的 tool_calls 消息
      messages.push({ role: 'assistant', content: null, tool_calls: msg.tool_calls })

      // 执行每个工具并添加结果
      for (const tc of msg.tool_calls) {
        const toolName = tc.function.name
        let args = {}
        try { args = JSON.parse(tc.function.arguments) } catch { /* ignore */ }
        const result = await executeTool(toolName, args, context)
        messages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: result,
        })
      }
      // 继续循环，把工具结果喂回模型
      continue
    }

    // 普通文本回复 → 返回
    const content = msg.content || ''
    if (onChunk) onChunk(content)
    return content
  }
  
  throw new Error('工具调用超出最大轮次')
}
