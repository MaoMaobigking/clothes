/*
 * 迁移脚本：删除页面里与全局样式重复的 scoped 规则。
 *
 * scoped CSS 编译成 `.mask[data-v-xxx]`，优先级高于全局 `.mask`，
 * 所以不删掉，styles/components.css 里的定义永远不生效。
 *
 * 只删「顶格的、精确匹配的」规则（^.name {），不动 .name.on / .name-xxx /
 * 嵌套选择器，避免误伤页面自己的变体。
 *
 * 用法：node scripts/css-migrate.mjs [--apply] 类名...
 * 不带 --apply 只打印会删什么，确认后再执行。
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = 'miniapp/src'
const args = process.argv.slice(2)
const apply = args.includes('--apply')
const names = args.filter((a) => a !== '--apply')

if (!names.length) {
  console.error('用法: node scripts/css-migrate.mjs [--apply] page mask sheet toast …')
  process.exit(1)
}

function walk(d, o = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name)
    if (e.isDirectory()) walk(p, o)
    else if (e.name.endsWith('.vue')) o.push(p)
  }
  return o
}

const files = walk(path.join(ROOT, 'pages')).concat(walk(path.join(ROOT, 'components')))

let removed = 0
const report = []

for (const file of files) {
  let text = fs.readFileSync(file, 'utf8')
  const styleMatch = text.match(/(<style[^>]*>)([\s\S]*?)(<\/style>)/)
  if (!styleMatch) continue

  let css = styleMatch[2]
  const hits = []

  for (const name of names) {
    // ^.name {…}  —— 单个规则，规则体里不含 }（这份代码没有嵌套 CSS）
    const re = new RegExp(String.raw`^\.${name}\s*\{[^}]*\}\s*`, 'gm')
    const found = css.match(re)
    if (!found) continue
    hits.push(`.${name} ×${found.length}`)
    css = css.replace(re, '')
    removed += found.length
  }

  if (!hits.length) continue
  report.push(`${file.padEnd(46)} ${hits.join('  ')}`)

  if (apply) {
    // 顺手清掉因为删除留下的多余空行
    css = css.replace(/\n{3,}/g, '\n\n')
    text = text.replace(styleMatch[0], styleMatch[1] + css + styleMatch[3])
    fs.writeFileSync(file, text)
  }
}

console.log(report.join('\n'))
console.log(`\n${apply ? '已删除' : '将删除'} ${removed} 条规则，涉及 ${report.length} 个文件`)
if (!apply) console.log('确认无误后加 --apply 执行')
