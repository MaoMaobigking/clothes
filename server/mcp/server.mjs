/**
 * MCP Server — AI 服装穿搭工具暴露
 * 
 * 暴露工具：search_garments / get_weather / get_user_profile / generate_style_report
 * 使用 @modelcontextprotocol/sdk 标准协议
 * 
 * 启动：node server/mcp/server.mjs
 * 调试：node server/mcp/debug.mjs
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ── 工具定义 ──────────────────────────────────────────────────

const TOOLS = [
  {
    name: 'search_garments',
    description: '搜索用户的衣橱，根据关键词、分类查找衣物',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '搜索关键词' },
        category: { type: 'string', enum: ['top','pants','skirt','dress','shoes','bag','hat','jewelry','accessory'] },
      },
    },
  },
  {
    name: 'get_weather',
    description: '查询指定城市的天气信息',
    inputSchema: {
      type: 'object',
      properties: {
        city: { type: 'string', description: '城市名' },
      },
      required: ['city'],
    },
  },
  {
    name: 'get_user_profile',
    description: '获取当前用户的身形数据、风格偏好',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'generate_style_report',
    description: '根据用户画像生成专属穿搭风格报告',
    inputSchema: {
      type: 'object',
      properties: {
        styles: { type: 'array', items: { type: 'string' } },
        skin: { type: 'string' },
        face: { type: 'string' },
        bmi: { type: 'number' },
        preferences: { type: 'object' },
      },
    },
  },
]

// ── 工具执行 ──────────────────────────────────────────────────

function executeTool(name, args) {
  switch (name) {
    case 'search_garments': {
      // 读取种子数据
      const seed = JSON.parse(readFileSync(join(__dirname, '..', 'seed.json'), 'utf-8'))
      let items = seed
      if (args.category) items = items.filter(g => g.category === args.category)
      if (args.query) {
        const q = args.query.toLowerCase()
        items = items.filter(g => g.name.toLowerCase().includes(q))
      }
      return {
        content: [{
          type: 'text',
          text: items.length === 0
            ? '未找到匹配的衣物'
            : '找到以下衣物：\n' + items.slice(0, 8).map(g =>
                `- ${g.emoji} ${g.name} (${g.category}, ${g.brand}, ¥${g.price})`
              ).join('\n'),
        }],
      }
    }
    case 'get_weather': {
      const mock = { '北京': { temp: 25, cond: '晴', icon: '☀️' }, '上海': { temp: 28, cond: '多云', icon: '⛅' }, '重庆': { temp: 23, cond: '暴雨', icon: '🌧️' }, '广州': { temp: 30, cond: '雷阵雨', icon: '⛈️' } }
      const w = mock[args.city] || { temp: 22, cond: '多云', icon: '☁️' }
      return { content: [{ type: 'text', text: `${args.city}: ${w.icon} ${w.cond} ${w.temp}°C` }] }
    }
    case 'get_user_profile':
      return { content: [{ type: 'text', text: '用户画像：风格偏好(简约通勤、法式浪漫)，肤色(冷白皮)，脸型(鹅蛋脸)，BMI 21.0' }] }
    case 'generate_style_report':
      return { content: [{ type: 'text', text: JSON.stringify({
        summary: '简约通勤风，干练不失温柔',
        radar: [
          { name: '风格', value: 85 }, { name: '肤色', value: 72 },
          { name: '脸型', value: 68 }, { name: '体型', value: 78 }, { name: '偏好', value: 90 }
        ],
        palette: ['#F5F5DC', '#000000', '#FFFFFF', '#B0C4DE'],
        tips: ['避开荧光色系', '直筒裤更修饰腿型', '善用丝巾提亮'],
      }, null, 2) }] }
    default:
      return { content: [{ type: 'text', text: `未知工具: ${name}` }] }
  }
}

// ── 启动 MCP Server ──────────────────────────────────────────

const server = new Server(
  { name: 'ai-fashion-mcp', version: '0.1.0' },
  { capabilities: { tools: {} } },
)

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }))

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params
  return executeTool(name, args || {})
})

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('✅ AI 服装 MCP Server 已启动 (stdio)')
}

main().catch(console.error)
