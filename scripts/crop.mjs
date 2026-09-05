import { chromium } from 'playwright'
import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'

async function launch() {
  for (const channel of ['msedge', 'chrome']) {
    try {
      return await chromium.launch({ channel })
    } catch {
      /* next */
    }
  }
  return await chromium.launch()
}

// 要抠的图： [源文件, 输出文件, 裁剪框(占原图比例) {x,y,w,h}]
const jobs = [
  ['public/images/mockups/2.png', 'public/images/model/front.png', { x: 0.42, y: 0.14, w: 0.26, h: 0.71 }],
  ['public/images/mockups/5.png', 'public/images/model/outfit.png', { x: 0.42, y: 0.13, w: 0.33, h: 0.66 }],
]

const browser = await launch()
const page = await browser.newPage()

for (const [src, out, box] of jobs) {
  const b64 = readFileSync(resolve(src)).toString('base64')
  const dataUri = `data:image/png;base64,${b64}`
  await page.setContent(`<body style="margin:0;padding:0"><img id="i" src="${dataUri}" style="display:block"></body>`)
  await page.waitForFunction(
    () => {
      const im = document.getElementById('i')
      return im && im.complete && im.naturalWidth > 0
    },
    { timeout: 10000 },
  )
  const dim = await page.evaluate(() => {
    const im = document.getElementById('i')
    return { w: im.naturalWidth, h: im.naturalHeight }
  })
  await page.setViewportSize({ width: dim.w, height: dim.h })
  await page.waitForTimeout(150)
  const clip = {
    x: Math.round(box.x * dim.w),
    y: Math.round(box.y * dim.h),
    width: Math.round(box.w * dim.w),
    height: Math.round(box.h * dim.h),
  }
  await page.screenshot({ path: out, clip })
  console.log(`裁剪 ${src} (${dim.w}x${dim.h}) -> ${out}  clip=`, clip)
}

await browser.close()
