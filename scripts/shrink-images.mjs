/*
 * 图片瘦身：把「没有 alpha 通道的 PNG」转成 JPEG，顺手限制最长边。
 *
 * 为什么需要：小程序主包上限 2MB，而 static/images 有 13.7MB，其中 79 张
 * RGB PNG 占了 12.24MB。这批是照片，存 PNG 属于格式选错——同目录下 custom/
 * 那批同类照片存 JPG 只有 14KB/张，PNG 是 155KB/张，差 11 倍。
 *
 * 为什么用 playwright 而不是 sharp：仓库刻意保持零新依赖，而 playwright 已经
 * 是根目录 devDependency，scripts/crop.mjs 早就用它做图片裁剪了。走同一条路。
 *
 * 安全性：默认输出到 images-min/，源目录一个字节都不改。确认效果后再用
 * --apply 覆盖（会同时把代码里的 .png 后缀改掉，见 README 提示）。
 *
 * 用法：
 *   node scripts/shrink-images.mjs              # 转换到 images-min/，只看体积
 *   node scripts/shrink-images.mjs --quality 75 # 调 JPEG 质量（默认 82）
 *   node scripts/shrink-images.mjs --max 1080   # 调最长边（默认 1080）
 */
import { chromium } from 'playwright'
import {
  readdirSync,
  statSync,
  mkdirSync,
  writeFileSync,
  copyFileSync,
  readFileSync,
  openSync,
  readSync,
  closeSync,
  rmSync,
  existsSync,
} from 'node:fs'
import { join, relative, dirname, sep } from 'node:path'

const SRC = 'miniapp/src/static/images'
const OUT = 'miniapp/src/static/images-min'

const argv = process.argv.slice(2)
const argOf = (name, dflt) => {
  const i = argv.indexOf(`--${name}`)
  return i >= 0 && argv[i + 1] ? Number(argv[i + 1]) : dflt
}
const QUALITY = argOf('quality', 82) / 100
const MAX_EDGE = argOf('max', 1080)

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else out.push(p)
  }
  return out
}

/** 读 PNG 的 IHDR 色彩类型：6=RGBA 4=灰+A 才真有 alpha，2/3/0 转 JPEG 无损失。 */
function pngHasAlpha(file) {
  const fd = openSync(file, 'r')
  const buf = Buffer.alloc(26)
  readSync(fd, buf, 0, 26, 0)
  closeSync(fd)
  return buf[25] === 6 || buf[25] === 4
}

async function launch() {
  for (const channel of ['msedge', 'chrome']) {
    try {
      return await chromium.launch({ channel })
    } catch {
      /* 试下一个 */
    }
  }
  return await chromium.launch()
}

const mb = (n) => (n / 1048576).toFixed(2) + ' MB'

const files = walk(SRC)
if (existsSync(OUT)) rmSync(OUT, { recursive: true, force: true })

const browser = await launch()
const page = await browser.newPage()

let srcTotal = 0
let outTotal = 0
let converted = 0
let copied = 0
const failures = []

for (const file of files) {
  const rel = relative(SRC, file).split(sep).join('/')
  const size = statSync(file).size
  srcTotal += size

  const isPng = file.toLowerCase().endsWith('.png')
  const keepAsIs = !isPng || pngHasAlpha(file)

  if (keepAsIs) {
    // 已经是 JPG，或 PNG 真带 alpha（配饰要透明底）→ 原样拷过去
    const dest = join(OUT, rel)
    mkdirSync(dirname(dest), { recursive: true })
    copyFileSync(file, dest)
    outTotal += size
    copied++
    continue
  }

  // 注意：不能直接把 file:// 路径丢进页面 —— 页面是 about:blank，跨源读本地文件
  // 会被浏览器拦掉（EncodingError）。改成 Node 侧读字节、以 data URL 送进去。
  const srcDataUrl = `data:image/png;base64,${readFileSync(file).toString('base64')}`
  const dataUrl = await page.evaluate(
    async ([url, quality, maxEdge]) => {
      const img = new Image()
      img.src = url
      await img.decode()
      let { naturalWidth: w, naturalHeight: h } = img
      const scale = Math.min(1, maxEdge / Math.max(w, h))
      w = Math.round(w * scale)
      h = Math.round(h * scale)
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      // 无 alpha 的图铺白底，避免个别边缘半透明像素转 JPEG 后发黑
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, w, h)
      ctx.drawImage(img, 0, 0, w, h)
      return canvas.toDataURL('image/jpeg', quality)
    },
    [srcDataUrl, QUALITY, MAX_EDGE],
  )

  if (!dataUrl?.startsWith('data:image/jpeg')) {
    failures.push(rel)
    continue
  }

  const dest = join(OUT, rel.replace(/\.png$/i, '.jpg'))
  mkdirSync(dirname(dest), { recursive: true })
  const bytes = Buffer.from(dataUrl.split(',')[1], 'base64')
  writeFileSync(dest, bytes)
  outTotal += bytes.length
  converted++
  const pct = (100 - (bytes.length / size) * 100).toFixed(0)
  console.log(`  ${mb(size).padStart(9)} → ${mb(bytes.length).padStart(9)}  -${pct.padStart(2)}%  ${rel}`)
}

await browser.close()

console.log(`\n转换 ${converted} 张，原样保留 ${copied} 张${failures.length ? `，失败 ${failures.length} 张` : ''}`)
if (failures.length) console.log('  失败：', failures.join(', '))
console.log(
  `体积  ${mb(srcTotal)}  →  ${mb(outTotal)}   省下 ${mb(srcTotal - outTotal)}（-${(100 - (outTotal / srcTotal) * 100).toFixed(0)}%）`,
)
console.log(`产物在 ${OUT}/ ，源目录未改动。`)
