import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

process.env.PORT = process.env.FEATURE2_TEST_PORT || '8791'

const here = dirname(fileURLToPath(import.meta.url))
await import('../index.mjs')

const BASE = `http://localhost:${process.env.PORT}/api`
let failed = 0

const check = (label, ok, extra = '') => {
  console.log(`${ok ? '   ✓' : '   ✗'} ${label}${extra ? '  - ' + extra : ''}`)
  if (!ok) failed += 1
}

async function req(path, { method = 'GET', token, body, form } = {}) {
  const headers = {}
  if (body) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: form || (body ? JSON.stringify(body) : undefined),
  })
  let data = null
  try {
    data = await response.json()
  } catch {
    /* empty response */
  }
  return { status: response.status, data }
}

async function waitForServer() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await fetch(`${BASE}/health`)
      if (response.ok) return
    } catch {
      /* retry */
    }
    await new Promise((resolve) => setTimeout(resolve, 150))
  }
  throw new Error('feature-2 test server did not start')
}

await waitForServer()

const stamp = Date.now().toString(36)
const a = (await req('/auth/dev-token', { method: 'POST', body: { tag: `feature2_a_${stamp}` } })).data
const b = (await req('/auth/dev-token', { method: 'POST', body: { tag: `feature2_b_${stamp}` } })).data

console.log('\n[1] 用户与衣橱基础能力')
const listA = (await req('/garments', { token: a.token })).data.items
const listB = (await req('/garments', { token: b.token })).data.items
check('新用户拿到种子衣橱', listA.length > 0 && listB.length > 0, `A=${listA.length} B=${listB.length}`)
check('A 不能读取 B 的衣橱 ID', listA.some((item) => listB.some((other) => other.id === item.id)) === false)

console.log('\n[2] 标签、常穿与排序')
const target = listA[0]
const updated = await req(`/garments/${target.id}`, {
  method: 'PATCH',
  token: a.token,
  body: {
    name: `${target.name}（已确认）`,
    primaryColor: '#4f5668',
    secondaryColors: ['#d9e2ee'],
    seasons: ['spring', 'autumn'],
    occasions: ['daily', 'work'],
    recognitionStatus: 'confirmed',
  },
})
check('标签修改成功', updated.status === 200, updated.status)
check('修改后的颜色/季节/场合返回前端', updated.data?.item?.primaryColor === '#4f5668' && updated.data?.item?.seasons?.length === 2)
const frequent = await req(`/garments/${target.id}/frequently-worn`, { method: 'POST', token: a.token })
check('常穿状态切换成功', frequent.status === 200 && frequent.data?.item?.frequentlyWorn === true)
const reversedIds = [...listA.map((item) => item.id)].reverse()
const reordered = await req('/garments/reorder', { method: 'PUT', token: a.token, body: { ids: reversedIds } })
check('排序接口更新列表', reordered.status === 200, reordered.status)
check('排序顺序按提交顺序返回', reordered.data?.items?.[0]?.id === reversedIds[0])

console.log('\n[3] 三套搭配生成、替换与收藏')
const generated = await req('/wardrobe/generate', { method: 'POST', token: a.token, body: {} })
check('一键生成 3 套搭配', generated.status === 200 && generated.data?.batch?.outfits?.length === 3)
const firstOutfit = generated.data?.batch?.outfits?.[0]
check('搭配包含真实衣橱单品', firstOutfit?.items?.length > 0)
check('算法说明包含真实参与数量', firstOutfit?.algorithm?.garmentCount === listA.length)
const firstItem = firstOutfit?.items?.[0]
const replacementCandidates = listA.filter((item) => item.category === firstItem?.garment?.category && item.id !== firstItem.garment.id)
const replacement = replacementCandidates[0]
if (firstItem && replacement) {
  const replaced = await req(`/wardrobe/outfits/${firstOutfit.id}/replace`, {
    method: 'POST',
    token: a.token,
    body: { oldGarmentId: firstItem.garment.id, newGarmentId: replacement.id },
  })
  check('替换单品后方案立即更新', replaced.status === 200 && replaced.data?.item?.items?.[0]?.garment?.id === replacement.id)
} else {
  check('替换单品候选存在（当前衣橱足够）', false)
}
const saved = await req(`/wardrobe/outfits/${firstOutfit.id}/save`, { method: 'POST', token: a.token })
check('收藏搭配成功', saved.status === 200 && saved.data?.item?.isSaved === true)
const savedList = await req('/wardrobe/outfits?saved=1', { token: a.token })
check('我的搭配可回看', savedList.status === 200 && savedList.data?.items?.length > 0)

console.log('\n[4] 购物车持久化与用户隔离')
const cart = await req(`/cart/outfits/${firstOutfit.id}`, { method: 'POST', token: a.token })
check('整套方案拆成单品进入购物车', cart.status === 201 && cart.data?.items?.length > 0)
const cartList = await req('/cart', { token: a.token })
check('购物车数据可重新读取', cartList.status === 200 && cartList.data?.items?.length > 0)
const crossBatch = await req(`/wardrobe/outfits/${firstOutfit.id}`, { token: b.token })
check('B 不能读取 A 的搭配', crossBatch.status === 404, crossBatch.status)
const crossCart = await req('/cart', { token: b.token })
check('B 的购物车不受 A 影响', crossCart.status === 200 && crossCart.data?.items?.length === 0)

console.log('\n[5] 真实照片上传与演示识别')
const mainUploadDir = join(here, '..', '..', '..', '..', 'server', 'uploads', 'garments')
const files = readdirSync(mainUploadDir).filter((name) => /\.(png|jpe?g|webp)$/i.test(name))
if (files.length) {
  const bytes = readFileSync(join(mainUploadDir, files[0]))
  const form = new FormData()
  form.append('files', new Blob([bytes], { type: 'image/png' }), 'feature2-smoke.png')
  const uploaded = await req('/wardrobe/upload', { method: 'POST', token: a.token, form })
  check('相册照片上传成功', uploaded.status === 201 && uploaded.data?.items?.length === 1, uploaded.status)
  check('演示识别字段写入衣橱', uploaded.data?.items?.[0]?.recognitionSource === 'demo')
  check('识别建议可确认', Boolean(uploaded.data?.items?.[0]?.recognitionStatus === 'suggested'))
} else {
  check('存在可用于上传验收的真实图片', false)
}

console.log(failed === 0 ? '\n🎉 功能二接口验收全部通过\n' : `\n✗ ${failed} 项未通过\n`)
process.exit(failed === 0 ? 0 : 1)
