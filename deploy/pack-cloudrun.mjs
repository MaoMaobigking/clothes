/*
 * 打一个可以直接上传到「微信云托管 → 新建版本 → 本地代码上传」的 zip。
 *
 * 为什么不直接把整个仓库丢上去：构建上下文会连 node_modules（几百 MB）、
 * .git、miniapp/dist、.image-backup 一起传，慢到没法用，而且 server/.env
 * 里的 key 会被打进镜像层。这里只挑云托管真正需要的东西，成品 4 MB 上下。
 *
 * 产物（都在 deploy/dist/）：
 *   cloudrun.zip           ← 传这个
 *   cloudrun/              ← 同样内容的目录，zip 失败时可以自己右键压缩
 *   云托管环境变量.txt      ← 照着往控制台的环境变量面板填
 *
 * 用法：node deploy/pack-cloudrun.mjs
 */
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { deflateRawSync } from 'node:zlib'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const outDir = join(here, 'dist')
const stage = join(outDir, 'cloudrun')
const zipPath = join(outDir, 'cloudrun.zip')

/*
 * server/ 里不进镜像的东西。
 * - node_modules：容器里 npm ci 重装
 * - .env：容器不读文件，环境变量走控制台面板。打进去只是白白泄露 key
 * - rag_index.json：启动时自动重建（见 .gitignore 里那条）
 * - uploads 里的历史文件：本机测试残留，跟演示无关
 */
const SKIP_SERVER = new Set(['node_modules', '.env', 'rag_index.json', 'server-dev.log'])

function copyServer() {
  const src = join(root, 'server')
  cpSync(src, join(stage, 'server'), {
    recursive: true,
    filter: (from) => {
      const rel = from.slice(src.length + 1)
      if (!rel) return true
      const head = rel.split(/[\\/]/)[0]
      if (SKIP_SERVER.has(head)) return false
      if (head.endsWith('.log')) return false
      // uploads 目录本身要留（multer 往里写），里面的旧文件不要
      if (head === 'uploads' && rel !== 'uploads') return false
      return true
    },
  })
  mkdirSync(join(stage, 'server', 'uploads'), { recursive: true })
}

function dirSize(dir) {
  let total = 0
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    total += entry.isDirectory() ? dirSize(full) : statSync(full).size
  }
  return total
}

/*
 * 把 server/.env 翻译成云托管环境变量面板的填写清单。
 *
 * MYSQL_* 四项刻意换成占位符：本机那套是 localhost:3308 的 docker 容器，
 * 原样搬到云上必然连不上，而 index.mjs 连不上库就 exit(1) ——
 * 表现成「部署一直失败」，是最容易卡住的一步。这里直接堵掉。
 */
function writeEnvSheet() {
  const envPath = join(root, 'server', '.env')
  const lines = ['# 微信云托管 → 服务设置 → 环境变量，逐条填进去', '']
  /*
   * 占位符刻意用纯 ASCII 的 TODO-xxx，不写「← 填内网地址」这种中文提示。
   * 原因：这份清单是拿来整段粘进云托管环境变量面板的，值里带箭头和中文，
   * 要么被面板丢掉（于是 MYSQL_HOST 为空 → 代码回落 localhost → 容器反复重启，
   * 日志里那个 localhost 看着还像是你自己配错了），要么原样存进去更莫名其妙。
   * 用 TODO-xxx 的话，粘完面板里一眼能看见哪两项没填，
   * 就算真忘了改，报错也会直接打成 `TODO-set-mysql-internal-host:3306`。
   */
  const OVERRIDE = {
    MYSQL_HOST: 'TODO-set-mysql-internal-host',
    MYSQL_PORT: '3306',
    MYSQL_USER: 'root',
    MYSQL_PASSWORD: 'TODO-set-mysql-root-password',
    MYSQL_DATABASE: 'lingxi',
    PORT: '80',
  }
  const seen = new Set()

  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*)$/)
      if (!m) continue
      const [, key, value] = m
      if (seen.has(key)) continue
      seen.add(key)
      if (key === 'DB_TYPE') continue
      lines.push(`${key}=${OVERRIDE[key] ?? value}`)
    }
  } else {
    lines.push('# 没找到 server/.env，下面是必填项，值自己补')
    for (const key of ['AI_PROVIDER', 'AI_API_KEY', 'AI_MODEL', 'AI_BASE_URL', 'DASHSCOPE_API_KEY', 'JWT_SECRET']) {
      lines.push(`${key}=`)
      seen.add(key)
    }
  }

  for (const [key, hint] of Object.entries(OVERRIDE)) {
    if (!seen.has(key)) lines.push(`${key}=${hint}`)
  }

  lines.push('', '# 说明：')
  lines.push('# - 两个 TODO-xxx 必须换成云托管 MySQL 的实际值：')
  lines.push('#     MYSQL_HOST     → 实例的【内网】地址，形如 10.x.x.x，不是公网地址')
  lines.push('#     MYSQL_PASSWORD → 建实例时设的 root 密码')
  lines.push('#   漏了任何一项，镜像照样构建成功，但部署时容器会反复重启')
  lines.push('#   （Back-off restarting failed container），启动日志里是「❌ MySQL 连接失败」')
  lines.push('# - MYSQL_DATABASE 必须保持 lingxi，schema.sql 里写死了')
  lines.push('# - PORT 必须是 80，云托管按 80 探活')
  lines.push('# - AI_API_KEY / DASHSCOPE_API_KEY 是真 key，这个文件别外传')
  writeFileSync(join(outDir, '云托管环境变量.txt'), lines.join('\n') + '\n', 'utf8')
}

/* ============ 走起 ============ */
rmSync(stage, { recursive: true, force: true })
rmSync(zipPath, { force: true })
mkdirSync(stage, { recursive: true })

const imagesSrc = join(root, 'miniapp', 'src', 'static', 'images')
if (!existsSync(imagesSrc)) throw new Error(`找不到演示素材目录: ${imagesSrc}`)

copyServer()
cpSync(imagesSrc, join(stage, 'images'), { recursive: true })
cpSync(join(here, 'Dockerfile'), join(stage, 'Dockerfile'))
cpSync(join(root, 'package.json'), join(stage, 'package.json'))
cpSync(join(root, 'package-lock.json'), join(stage, 'package-lock.json'))
writeEnvSheet()

/* ============ zip ============
 *
 * 自己写 zip，不用 PowerShell 的 Compress-Archive。
 *
 * Windows PowerShell 5.1 那个 Compress-Archive 写出来的包，路径分隔符是反斜杠
 * （234/237 个条目），违反 ZIP 规范（APPNOTE 4.4.17 要求一律用 /）。云托管那边
 * unzip 容错解开了，但日志里会甩一行
 *   warning: code.zip appears to use backslashes as path separators
 * 换个解包工具就不一定这么客气。这里手写，规范内的东西自己捏得准：
 * 正斜杠、名字一律 UTF-8 并置上 flag bit 11（中文的 rag-docs 文件名要靠它）。
 *
 * 没上第三方库，deflate 用 node:zlib，CRC32 表自己算 —— zlib.crc32 要 Node 20.15+，
 * 而这脚本没道理给自己加个 Node 版本下限。
 */
const CRC_TABLE = (() => {
  const table = new Int32Array(256)
  for (let i = 0; i < 256; i += 1) {
    let c = i
    for (let bit = 0; bit < 8; bit += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[i] = c
  }
  return table
})()

function crc32(buf) {
  let c = -1
  for (let i = 0; i < buf.length; i += 1) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}

/* DOS 时间戳：日期从 1980 起算，秒只有 5 位所以精度是 2 秒。 */
function dosStamp(mtime) {
  const d = mtime
  if (d.getFullYear() < 1980) return { time: 0, date: 0x0021 }
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
    date: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  }
}

/* 收集条目。空目录要单独出一条（名字带尾 /），否则解出来那个目录就没了。 */
function collect(dir, prefix, out) {
  const entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))
  if (!entries.length && prefix) out.push({ name: `${prefix}/`, dir: true })
  for (const entry of entries) {
    const full = join(dir, entry.name)
    const name = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.isDirectory()) collect(full, name, out)
    else out.push({ name, dir: false, path: full })
  }
}

function writeZip(srcDir, dest) {
  const entries = []
  collect(srcDir, '', entries)

  const chunks = []
  const central = []
  let offset = 0

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, 'utf8')
    const stat = entry.dir ? null : statSync(entry.path)
    const raw = entry.dir ? Buffer.alloc(0) : readFileSync(entry.path)
    if (raw.length >= 0xffffffff) throw new Error(`单个文件超过 4 GB，需要 zip64: ${entry.name}`)

    // 压不动就存原样（图片基本都是这种），省得反而变大
    const deflated = entry.dir ? Buffer.alloc(0) : deflateRawSync(raw, { level: 9 })
    const store = entry.dir || deflated.length >= raw.length
    const body = store ? raw : deflated
    const method = store ? 0 : 8
    const { time, date } = dosStamp(entry.dir ? new Date(1980, 0, 1) : stat.mtime)
    const sum = crc32(raw)

    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4) // version needed
    local.writeUInt16LE(0x0800, 6) // flag bit 11 = 名字是 UTF-8
    local.writeUInt16LE(method, 8)
    local.writeUInt16LE(time, 10)
    local.writeUInt16LE(date, 12)
    local.writeUInt32LE(sum, 14)
    local.writeUInt32LE(body.length, 18)
    local.writeUInt32LE(raw.length, 22)
    local.writeUInt16LE(nameBuf.length, 26)
    local.writeUInt16LE(0, 28) // extra field 长度

    const head = Buffer.alloc(46)
    head.writeUInt32LE(0x02014b50, 0)
    head.writeUInt16LE(0x031e, 4) // version made by：3 = UNIX，这样下面的权限位才会被认
    head.writeUInt16LE(20, 6)
    head.writeUInt16LE(0x0800, 8)
    head.writeUInt16LE(method, 10)
    head.writeUInt16LE(time, 12)
    head.writeUInt16LE(date, 14)
    head.writeUInt32LE(sum, 16)
    head.writeUInt32LE(body.length, 20)
    head.writeUInt32LE(raw.length, 24)
    head.writeUInt16LE(nameBuf.length, 28)
    head.writeUInt16LE(0, 30) // extra
    head.writeUInt16LE(0, 32) // comment
    head.writeUInt16LE(0, 34) // 起始磁盘号
    head.writeUInt16LE(0, 36) // internal attrs
    head.writeUInt32LE(entry.dir ? ((0o40755 << 16) | 0x10) >>> 0 : (0o100644 << 16) >>> 0, 38)
    head.writeUInt32LE(offset, 42)

    chunks.push(local, nameBuf, body)
    central.push(head, nameBuf)
    offset += local.length + nameBuf.length + body.length
  }

  const cd = Buffer.concat(central)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(0, 4)
  end.writeUInt16LE(0, 6)
  end.writeUInt16LE(entries.length, 8)
  end.writeUInt16LE(entries.length, 10)
  end.writeUInt32LE(cd.length, 12)
  end.writeUInt32LE(offset, 16)
  end.writeUInt16LE(0, 20)

  writeFileSync(dest, Buffer.concat([...chunks, cd, end]))
  return entries.length
}

let zipped = 0
try {
  zipped = writeZip(stage, zipPath)
} catch (err) {
  console.error(`⚠ 写 zip 失败：${err.message}`)
}

const mb = (n) => `${(n / 1024 / 1024).toFixed(2)} MB`
console.log('')
if (zipped) {
  console.log(`✓ ${zipPath}  (${mb(statSync(zipPath).size)}，${zipped} 个条目)`)
} else {
  console.log(`⚠ 自动压缩失败，请手动把这个目录里的内容压成 zip（Dockerfile 要在 zip 根目录）：`)
  console.log(`  ${stage}`)
}
console.log(`  暂存目录 ${stage}  (${mb(dirSize(stage))})`)
console.log(`  其中演示素材 ${mb(dirSize(join(stage, 'images')))}`)
console.log(`✓ ${join(outDir, '云托管环境变量.txt')}`)
console.log('\n下一步看 deploy/云托管部署.md')
