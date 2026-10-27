import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
const cwd = fileURLToPath(new URL('../', import.meta.url))
const commands = [
  ['test', '--workspace=ai-fashion-server'],
  ['run', 'check:types', '--prefix', 'miniapp'],
  ['test', '--prefix', 'miniapp'],
  ['run', 'build:h5', '--prefix', 'miniapp'],
  ['run', 'build:mp-weixin', '--prefix', 'miniapp'],
  ['run', 'build', '--prefix', 'admin'],
]
for (const args of commands) {
  const result = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', args, {
    cwd,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })
  if (result.status !== 0) process.exit(result.status || 1)
}
console.log('项目测试、类型检查与三端构建通过')
