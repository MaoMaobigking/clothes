/* 一次性分析：统计重复类名的写法差异，判断能否安全合并到全局样式 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = 'miniapp/src'

function walk(d, o = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name)
    if (e.isDirectory()) walk(p, o)
    else if (e.name.endsWith('.vue')) o.push(p)
  }
  return o
}

const files = walk(path.join(ROOT, 'pages')).concat(walk(path.join(ROOT, 'components')))

function styleOf(file) {
  const m = fs.readFileSync(file, 'utf8').match(/<style[^>]*>([\s\S]*?)<\/style>/)
  return m ? m[1] : ''
}

/** 抓出 `.name { ... }` 的规则体（不含嵌套） */
function ruleBody(css, name) {
  const re = new RegExp(String.raw`^\.` + name + String.raw`\s*\{([^}]*)\}`, 'm')
  const m = css.match(re)
  return m ? m[1].replace(/\s+/g, ' ').trim() : null
}

for (const name of process.argv.slice(2)) {
  const variants = new Map()
  for (const f of files) {
    const body = ruleBody(styleOf(f), name)
    if (body === null) continue
    if (!variants.has(body)) variants.set(body, [])
    variants.get(body).push(f)
  }
  const total = [...variants.values()].reduce((a, b) => a + b.length, 0)
  console.log(`=== .${name}: ${total} 处定义, ${variants.size} 种写法 ===`)
  ;[...variants.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 5)
    .forEach(([body, fs2]) => console.log('  ×' + String(fs2.length).padEnd(3) + body.slice(0, 170)))
  console.log()
}
