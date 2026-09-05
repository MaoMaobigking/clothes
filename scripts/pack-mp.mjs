/*
 * 微信小程序打包收尾。跑在 uni build 之后，做三件 uni 不管的事：
 *
 * 1. 删产物里的 static/images。uni 会无条件把 src/static/ 整个拷进去，
 *    不管代码还引不引用它；走云图方案时这 3.2 MB 纯属占位，而主包上限
 *    只有 2 MB —— 不删就传不上去。
 * 2. 走云开发那条路时（VITE_CLOUD_ENV 非空），把 cloudfunctions/ 拷进产物并在
 *    project.config.json 里指上 —— 开发者工具只认项目目录内的云函数。
 *    云函数目录不计入主包体积，工具会单独编译上传。走云托管时整个跳过。
 * 3. 报一下最终主包体积，省得上传时才发现超限。
 *
 * 只动产物，不碰 src。想回到「图打进包」的版本，不带 VITE_CLOUD_IMG_BASE
 * 重新打一次即可。
 *
 *   node scripts/pack-mp.mjs [产物目录]
 */
import { cpSync, existsSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = process.argv[2]
  ? resolve(process.cwd(), process.argv[2])
  : join(root, 'miniapp', 'dist', 'build', 'mp-weixin')

function dirSize(dir) {
  let total = 0
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    total += entry.isDirectory() ? dirSize(full) : statSync(full).size
  }
  return total
}

const mb = (n) => `${(n / 1024 / 1024).toFixed(2)} MB`

if (!existsSync(outDir)) {
  console.error(`✗ 产物目录不存在：${outDir}\n  先跑 npm run mp:build`)
  process.exit(1)
}

/* 1. 删静态图。
 *
 * 删之前先确认引用已经被改写走了。没注入 VITE_CLOUD_IMG_BASE 就跑这个脚本，
 * 结果是「图还被引用着，文件却被删了」—— 打包能过、上传能过，打开一片图裂，
 * 而且要到真机上才看得出来。宁可在这里停下。
 */
function findLocalRefs(dir, hits = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name !== 'static' && entry.name !== 'cloudfunctions') findLocalRefs(full, hits)
      continue
    }
    if (!/\.(js|wxml|wxss|json)$/.test(entry.name)) continue
    // cloud.js 里的 assetUrl 自己要拿这个前缀做判断，不算引用
    if (full.endsWith(join('api', 'cloud.js'))) continue
    if (readFileSync(full, 'utf8').includes('/static/images')) hits.push(full)
  }
  return hits
}

const images = join(outDir, 'static', 'images')
if (existsSync(images)) {
  const refs = findLocalRefs(outDir)
  if (refs.length) {
    console.error('✗ 产物里还有 %d 处引用包内静态图，例如：', refs.length)
    for (const f of refs.slice(0, 3)) console.error(`    ${f}`)
    console.error('\n  说明打包时没注入图片地址，删图会导致全站图裂。')
    console.error('  在 miniapp/.env.production 里填 VITE_CLOUD_IMG_BASE 后重新打包。')
    process.exit(1)
  }
  const freed = dirSize(images)
  rmSync(images, { recursive: true, force: true })
  console.log(`✓ 删除产物内静态图，释放 ${mb(freed)}`)
} else {
  console.log('· 产物里没有 static/images')
}

/* 2. 云函数进产物。
 *
 * 只在走「云开发 + 云函数转发」那条路时才需要（VITE_CLOUD_ENV 非空）。
 * 现在默认走微信云托管，前端直连域名，云函数完全用不上 —— 这时候还把
 * cloudfunctionRoot 写进 project.config.json，开发者工具会因为「未开通云开发」
 * 报一串跟本次部署毫无关系的告警，白白制造排查噪音。
 */
const cloudEnv = (() => {
  const f = join(root, 'miniapp', '.env.production')
  if (!existsSync(f)) return ''
  // 只吃行内空格：写成 \s* 的话会连换行一起吞掉，空值行会误读到下一行的内容
  return readFileSync(f, 'utf8').match(/^[ \t]*VITE_CLOUD_ENV[ \t]*=[ \t]*(.*)$/m)?.[1].trim() || ''
})()
const fnSrc = join(root, 'cloudfunctions')
const fnDest = join(outDir, 'cloudfunctions')
if (!cloudEnv) {
  // 顺手清掉上一次打包留下的残留，免得旧产物目录没删干净又把它传上去
  rmSync(fnDest, { recursive: true, force: true })
  const conf = join(outDir, 'project.config.json')
  if (existsSync(conf)) {
    const json = JSON.parse(readFileSync(conf, 'utf8'))
    if (json.cloudfunctionRoot) {
      delete json.cloudfunctionRoot
      writeFileSync(conf, `${JSON.stringify(json, null, 2)}\n`)
    }
  }
  console.log('· VITE_CLOUD_ENV 为空（走云托管直连），跳过云函数')
} else if (existsSync(fnSrc)) {
  rmSync(fnDest, { recursive: true, force: true })
  // node_modules 不拷：上传时选「云端安装依赖」，本地这份既大又可能架构不对
  cpSync(fnSrc, fnDest, {
    recursive: true,
    filter: (src) => !src.includes('node_modules'),
  })
  const conf = join(outDir, 'project.config.json')
  const json = JSON.parse(readFileSync(conf, 'utf8'))
  json.cloudfunctionRoot = 'cloudfunctions/'
  writeFileSync(conf, `${JSON.stringify(json, null, 2)}\n`)
  console.log('✓ 云函数已拷入产物，project.config.json 已指向 cloudfunctions/')
} else {
  console.log('· 没有 cloudfunctions/ 目录，跳过')
}

/* 3. 报体积。云函数不计入主包，减掉再报，免得虚惊一场 */
const total = dirSize(outDir)
const fnSize = existsSync(fnDest) ? dirSize(fnDest) : 0
const pkg = total - fnSize
console.log(`\n主包体积：${mb(pkg)}（微信上限 2 MB）`)
if (pkg > 2 * 1024 * 1024) {
  console.log('✗ 超限了，上传会被拒。检查 VITE_CLOUD_IMG_BASE 是否注入')
  process.exit(1)
}
