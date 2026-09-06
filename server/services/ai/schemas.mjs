/**
 * 结构化输出的 JSON Schema 定义、手写校验器和 JSON 提取。
 *
 * 不引 ajv：这里只需要「对象/数组/枚举/必填」四种约束，
 * 为此拖一个依赖不划算，而且校验失败的中文提示要自己拼才说得清哪个字段错了。
 */
/* ============ JSON Schema 定义 ============ */

export const STYLE_REPORT_SCHEMA = {
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

export const SCENE_OUTFIT_SCHEMA = {
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

export function validateSchema(data, schema) {
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
export function normalizeStyleReport(result) {
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

export function parseJson(text, jsonSchema) {
  if (!text) throw new Error('模型返回为空')
  let s = String(text)
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim()
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
