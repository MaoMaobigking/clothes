/*
 * 一次性改名跟进：shrink-images 把 7 个目录的 PNG 转成了 JPG，
 * 这里把代码/数据里对应的引用后缀跟着改掉。
 *
 * 只动这 7 个目录：catalog closet community model outfit scene tryon
 * accessory/ 保持 .png —— 那 18 张真带 alpha（配饰要透明底抠在人身上）。
 *
 * 为什么用脚本而不是手改：引用里有模板串（`/static/images/closet/${g.id}.png`），
 * 一处漏改就是一整个目录的图裂开，肉眼核对 80 处不现实。
 *
 * 用法：node scripts/repoint-images.mjs [--dry]
 */
import { readFileSync, writeFileSync } from 'node:fs'

const DRY = process.argv.includes('--dry')

const DIRS = ['catalog', 'closet', 'community', 'model', 'outfit', 'scene', 'tryon']
// 路径里允许出现 ${...} 模板占位，而占位里可能带空格（`${i + 1}`），
// 所以不能拿空白当边界 —— 那会漏掉 outfit 那条。真正的边界只有引号、
// 反引号和换行：不管 JS 字符串、模板串还是 HTML 属性，都停在它们上面。
const RE = new RegExp(`(images/(?:${DIRS.join('|')})/[^"'\`\\n]*)\\.png`, 'g')

const FILES = [
  'miniapp/src/data/mock.ts',
  'miniapp/src/data/scene.ts',
  'miniapp/src/data/custom.ts',
  'miniapp/src/pages/custom/index.vue',
  'server/scene-catalog.json',
  'server/seed.json',
  'server/services/communitySeedService.mjs',
  'server/scripts/checkTryon.mjs',
]

let total = 0
for (const file of FILES) {
  const before = readFileSync(file, 'utf-8')
  const hits = before.match(RE)?.length || 0
  if (!hits) continue
  const after = before.replace(RE, '$1.jpg')
  if (!DRY) writeFileSync(file, after)
  total += hits
  console.log(`  ${String(hits).padStart(3)} 处  ${file}`)
}
console.log(`${DRY ? '[dry] ' : ''}共改 ${total} 处引用`)
