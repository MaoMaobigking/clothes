/**
 * AI 业务用例：风格报告、情景搭配、穿搭顾问对话。
 *
 * 这一层认识业务（画像字段、场景槽位、报告结构），调用 client 的通用能力。
 * 每个用例都带规则兜底：没配 key、模型超时或返回不合 Schema 时走本地规则版，
 * 保证演示链路不会因为外部服务挂掉而断在半路。
 */
import { API_KEY } from './provider.mjs'
import { withTimeout, structuredComplete, aiCompleteText, aiComplete } from './client.mjs'
import { fitContext } from './context.mjs'
import {
  STYLE_REPORT_SCHEMA,
  SCENE_OUTFIT_SCHEMA,
  parseJson,
  validateSchema,
  normalizeStyleReport,
} from './schemas.mjs'
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
    休闲街头: ['#2f2f3a', '#b8c8d8', '#e8e2d0', '#d97757'],
    简约通勤: ['#3f4655', '#a9b6c9', '#e7e4da', '#8d7f6f'],
    法式浪漫: ['#f4c6d2', '#e0d0ee', '#f7efe2', '#9d7188'],
    韩系甜美: ['#ffd9e6', '#ffb3d1', '#f4e3ff', '#c9a7d8'],
    复古优雅: ['#d9b58f', '#6f4e3d', '#efe6d5', '#9b5b3f'],
    运动机能: ['#1f2933', '#6fc9b0', '#e8edf0', '#ff9e5e'],
  }
  const palette = palettes[mainStyle] || palettes['简约通勤']

  const piecesByStyle = {
    休闲街头: ['白T恤', '牛仔外套', '直筒裤', '厚底板鞋'],
    简约通勤: ['衬衫', '西装裤', '针织开衫', '托特包'],
    法式浪漫: ['泡泡袖衬衫', '碎花半裙', '玛丽珍鞋', '珍珠耳饰'],
    韩系甜美: ['娃娃领上衣', '百褶裙', '针织开衫', '小方包'],
    复古优雅: ['格纹西装', '直筒牛仔裤', '乐福鞋', '丝巾'],
    运动机能: ['冲锋衣', '束脚裤', '机能鞋', '帆布包'],
  }
  const pieces = piecesByStyle[mainStyle] || piecesByStyle['简约通勤']
  const scenes = ['日常通勤', '周末约会', '轻运动']
  const recommendations = scenes.map((scene, i) => ({
    title: `「${mainStyle}」${scene}方案`,
    scene,
    pieces: [
      pieces[0],
      pieces[(i + 1) % pieces.length],
      pieces[(i + 2) % pieces.length],
      pieces[(i + 3) % pieces.length],
    ],
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
  // 上下文压进预算再上行：客户端每次把整个历史发上来，服务端原本一个上限都没有
  const { messages: fitted } = await fitContext(messages, { summarize: summarizeTranscript })
  const reply = await aiComplete({
    system: sys,
    messages: fitted.map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: String(m.content || ''),
    })),
  })
  return reply
}

/**
 * 把一段被裁掉的历史摘成几句话。传给 context.fitContext 的第 4 层用。
 *
 * 放在 usecases 而不是 context.mjs：context.mjs 刻意不依赖任何东西（好单测、
 * 也避免绕出环），所以「怎么摘」由调用方注入。
 *
 * ⚠️ 这是四层里唯一花钱的一层（要多打一次模型），所以 fitContext 只在前三层
 * 压不下来时才会调到它。摘要失败由 context.summarizeDropped 吞掉，不影响主流程。
 */
export async function summarizeTranscript(transcript) {
  return aiCompleteText(
    '你是对话摘要器。把下面的穿搭咨询记录压成 3 句话以内的要点，只保留对后续对话有用的信息（用户的偏好、已排除的选项、已确定的结论）。不要寒暄，不要复述。',
    transcript,
  )
}
