/**
 * MCP 调试脚本
 * 测试工具列表和调用
 * 运行：npm run mcp:debug
 *
 * 这个脚本本身就是一个 MCP Client —— StdioClientTransport 的 command/args
 * 和 claude_desktop_config.json 里的 command/args 是同一件事：
 * 都是「spawn 一个子进程，用它的 stdin/stdout 讲 JSON-RPC」。
 */

/*通过运行 node server/mcp/debug.mjs，
开发者可以在几秒钟内快速验证 MCP Server 的代码逻辑是否正确，
而不需要每次都重启整个 AI 客户端。*/

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

async function main() {
  // transport 自己会 spawn server.mjs 并在 client.close() 时回收，不用手动 spawn。
  // env 必须显式透传：父进程的 --env-file 不会传给子进程的 node 参数，
  // 不传子进程就读不到 MCP_USER_ID 和数据库配置，启动即退出。
  const transport = new StdioClientTransport({
    command: 'node',
    args: [join(__dirname, 'server.mjs')],
    env: process.env,
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
  // 不再传参：画像由 server 侧按 MCP_USER_ID 自己查库，模型不该也不能指定别人的画像。
  const r4 = await client.callTool({ name: 'generate_style_report', arguments: {} })
  console.log(r4.content[0].text)

  console.log('\n✅ MCP 调试完成，所有工具正常')

  // 关掉 transport，它会一并回收 spawn 出来的 server 子进程（连接池在子进程里）。
  await client.close()
}

main().catch(console.error)
