/**
 * 运行时配置的唯一入口。
 *
 * 为什么要有这一层：改造前 `process.env` 散落在 10 多个文件里各读各的
 * （aiService 读 AI_*、authService 读 WX_*、db/mysql.mjs 读 MYSQL_*、
 * sceneService 读 OPENWEATHER_API_KEY……）。后果有三个：
 *   1. 想知道「这个服务到底吃哪些环境变量」，只能全局搜 process.env
 *   2. 同一个变量在两处读、默认值写得不一样时，谁生效取决于 import 顺序
 *   3. 配错了要等跑到那行代码才报错 —— 云托管上表现成「构建成功、容器反复重启」
 * 这是 miniapp 那套架构第 7 条规矩（环境变量集中）在后端的落地。
 *
 * ⚠️ 边界：这一层只做「读取 + 归一化纯值」，**不做路径拼接**。
 * 像 imagesDir、miniappStaticDir 那种「环境变量没给就按模块自身位置回落」的逻辑，
 * 必须留在使用方 —— 搬到这里会因为 __dirname 变成 server/config/ 而算错一级目录。
 * 这里只提供环境变量的原始值（没配就是 null）。
 *
 * ⚠️ 边界：这一层**不抛异常**，只收集 notes。
 * 硬性校验（比如 JWT_SECRET 缺失就拒绝启动）留在各自的模块里，
 * 免得改变现有的失败时机 —— 有些脚本本来不碰鉴权也能跑。
 *
 * 读取时机：靠 `node --env-file=.env` 在进程启动时注入，本模块在 import 时读一次。
 * `scripts/checkFeature2.mjs` 会在运行时改写 PORT，它用的是动态 import，
 * 所以模块级读取仍然安全 —— 不要把那个脚本改成静态 import。
 */

const notes = []

function trimmed(name) {
  const value = process.env[name]
  return typeof value === 'string' ? value.trim() : ''
}

/** 环境变量没配就返回 null，让使用方自己决定回落值 */
function optional(name) {
  return trimmed(name) || null
}

/**
 * 归一化 + 体检数据库连接配置。
 *
 * 原样搬自 db/mysql.mjs 的 resolveDbConfig()，一行没改。
 * 为什么值得单独一个函数：这些值是人在云托管的环境变量面板里手敲的，
 * 填错的代价是「构建等一分钟 → 容器起不来 → 日志里一行看不懂的报错」。
 * 下面两条都是真实踩过的（2026-08-19，prod-d7goaleke29399395）：
 *
 *   1. MYSQL_HOST=10.13.103.11:3306  —— 内网地址连端口一起粘进来了
 *      症状：getaddrinfo EAI_AGAIN 10.13.103.11:3306
 *      看着像 DNS 挂了，其实是把「地址:端口」整串当域名去解析
 *   2. MYSQL_PORT=80  —— 被「PORT 必须是 80」那条说明带偏，填到数据库端口这栏了
 *      症状：connection refused，因为连到服务自己身上
 *
 * 能自动纠的就纠（带端口的 host 拆开），不能纠的就在连库之前把话说清楚，
 * 别让人对着驱动层的报错猜。
 */
function resolveDbConfig(servicePort) {
  let host = trimmed('MYSQL_HOST')
  let port = Number(process.env.MYSQL_PORT) || 0

  // 只在「恰好一个冒号 + 后半是纯数字」时才拆，免得误伤 IPv6 字面量（::1 这种）
  const parts = host.split(':')
  if (parts.length === 2 && /^\d+$/.test(parts[1])) {
    const embedded = Number(parts[1])
    host = parts[0]
    notes.push(`MYSQL_HOST 里带了端口，已按 host=${host} port=${embedded} 处理 —— 这一栏只填地址，别带「:端口」`)
    if (!port) port = embedded
    else if (port !== embedded) {
      notes.push(`MYSQL_HOST 里的端口(${embedded}) 和 MYSQL_PORT(${port}) 对不上，以 MYSQL_PORT 为准`)
    }
  }

  if (!port) port = 3306

  if (servicePort && port === servicePort) {
    notes.push(
      `MYSQL_PORT=${port} 和服务端口 PORT=${servicePort} 一样，几乎可以肯定是填串了 —— ` +
        'PORT 是服务自己监听的端口（云托管按它探活），数据库端口通常是 3306',
    )
  }

  const database = trimmed('MYSQL_DATABASE') || 'lingxi'
  return {
    host: host || 'localhost',
    port,
    user: trimmed('MYSQL_USER') || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    charset: 'utf8mb4',
    database,
    /** 给日志用的 host:port，别再让调用方自己去拼 —— 拼错了就是那串 `10.13.103.11:3306:80` */
    target: `${host || 'localhost'}:${port}`,
    /*
     * MYSQL_HOST 到底配没配过。
     * 不能靠 `host === 'localhost'` 反推 —— 那是兜底值，和「真填了 localhost」长得一样。
     * 启动失败时要靠这个标志决定提示语：云托管上最常见的死法就是漏配 MYSQL_HOST，
     * 于是连到容器内并不存在的 localhost，日志看着像地址配错了。
     */
    hostConfigured: Boolean(host),
  }
}

const nodeEnv = trimmed('NODE_ENV') || 'development'
const servicePort = Number(process.env.PORT) || 8787

export const config = Object.freeze({
  runtime: Object.freeze({
    nodeEnv,
    isProduction: nodeEnv === 'production',
    port: servicePort,
    /** 演示图目录。没配则由 index.mjs 按候选目录回落 */
    imagesDir: optional('IMAGES_DIR'),
    /** miniapp 静态资源根。没配则由 aiTaskService 按自身位置回落 */
    miniappStaticDir: optional('MINIAPP_STATIC_DIR'),
  }),

  db: Object.freeze(resolveDbConfig(Number(process.env.PORT) || 0)),

  auth: Object.freeze({
    /** 缺失时的硬性拒绝留在 middleware/auth.mjs，本层只负责读 */
    jwtSecret: process.env.JWT_SECRET || '',
    wxAppId: trimmed('WX_APPID'),
    wxSecret: trimmed('WX_SECRET'),
    /** 生产环境缺失时的拒绝留在 services/auth/admin.mjs */
    adminPassword: optional('ADMIN_PASSWORD'),
  }),

  ai: Object.freeze({
    /** 仅做大小写归一；合法性由 services/ai/runtime/provider.mjs 按预设表校验 */
    provider: trimmed('AI_PROVIDER').toLowerCase() || 'deepseek',
    apiKey: trimmed('AI_API_KEY'),
    /** 没配则由 provider 预设填默认值 */
    model: optional('AI_MODEL'),
    baseUrl: optional('AI_BASE_URL'),
  }),

  bailian: Object.freeze({
    baseUrl: (trimmed('DASHSCOPE_BASE_URL') || 'https://dashscope.aliyuncs.com').replace(/\/+$/, ''),
    apiKey: trimmed('DASHSCOPE_API_KEY'),
    tryonModel: trimmed('BAILIAN_TRYON_MODEL') || 'aitryon',
  }),

  weather: Object.freeze({
    openWeatherKey: optional('OPENWEATHER_API_KEY'),
  }),
})

/**
 * 配置体检结论。启动时先打这些，再连库 ——
 * 否则一旦连不上，人只看得到驱动层那句 getaddrinfo / ECONNREFUSED，
 * 看不出是自己哪一格填串了。
 */
export const CONFIG_NOTES = Object.freeze(notes)

/**
 * 按变量名动态取值，受控的逃生口。
 *
 * 存在的唯一理由：演示账号的密码变量名写在 seeds/demoAccounts.mjs 的 envKey 字段里，
 * 是数据驱动的，没法在上面的 config 对象里静态列出来。
 * 除了这种「键名本身是数据」的场景，一律往 config 里加字段，别用这个函数 ——
 * 用了就等于把「服务吃哪些环境变量」这件事重新打散回去。
 */
export function envValue(name) {
  return trimmed(name) || ''
}
