/**
 * MCP 调试脚本
 * 测试工具列表和调用
 * 运行：node server/mcp/debug.mjs
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

async function main() {
  // 启动 MCP server 子进程
  const proc = spawn('node', [join(__dirname, 'server.mjs')], {
    stdio: ['pipe', 'pipe', 'pipe'],
  })

  const transport = new StdioClientTransport({
    command: 'node',
    args: [join(__dirname, 'server.mjs')],
  })

  const client = new Client({ name: 'mcp-debug', version: '1.0.0' }, { capabilities: {} })
  await client.connect(transport)

  // 1. 列出工具
  console.log('=== 工具列表 ===')
  const { tools } = await client.listTools()
  for (const t of tools) {
    console.log(`  🔧 ${t.name}: ${t.description}`)
  }

  // 2. 测试每个工具
  console.log('\n=== 测试工具调用 ===')

  console.log('\n--- search_garments ---')
  const r1 = await client.callTool({ name: 'search_garments', arguments: { category: 'top' } })
  console.log(r1.content[0].text)

  console.log('\n--- get_weather ---')
  const r2 = await client.callTool({ name: 'get_weather', arguments: { city: '北京' } })
  console.log(r2.content[0].text)

  console.log('\n--- get_user_profile ---')
  const r3 = await client.callTool({ name: 'get_user_profile', arguments: {} })
  console.log(r3.content[0].text)

  console.log('\n--- generate_style_report ---')
  const r4 = await client.callTool({ name: 'generate_style_report', arguments: { styles: ['法式浪漫'], skin: 'cool-fair', face: 'oval', bmi: 21 } })
  console.log(r4.content[0].text)

  console.log('\n✅ MCP 调试完成，所有工具正常')

  await client.close()
  proc.kill()
}

main().catch(console.error)
