/*
 * 云函数 api —— 小程序 ↔ 你自己那台服务器之间的转发层。
 *
 * 为什么需要它：微信小程序的 request 只认「已备案域名 + HTTPS」，
 * 裸公网 IP 根本填不进合法域名列表。但云函数是跑在腾讯云上的服务端代码，
 * 出网完全不受这套白名单约束 —— 于是链路变成：
 *
 *   小程序 --callFunction(免域名校验)--> 云函数 --普通 HTTP--> http://你的IP:8787
 *
 * 好处是后端一行都不用动，Express + MySQL 原样跑着。
 *
 * 后端地址优先读环境变量 API_ORIGIN（云开发控制台 → 云函数 → 配置）；
 * 没配就用下面的 DEFAULT_ORIGIN —— 现在后端固定在微信云托管上，地址不是秘密，
 * 写死一个兜底能省掉「部署完还得进控制台点一遍」这步，换环境时改这一行即可。
 *
 * 运行时最好选 Nodejs16 及以上（全局 fetch 内置）。选到了更老的运行时也能跑：
 * 下面 httpRequest() 会退回 https 模块，行为一致。
 */
const cloud = require('wx-server-sdk')
const https = require('https')
const http = require('http')
const { URL } = require('url')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

/** 后端兜底地址（微信云托管服务的公网域名）。环境变量 API_ORIGIN 优先。 */
const DEFAULT_ORIGIN = 'https://express-q6b8-299096-11-1470997981.sh.run.tcloudbase.com'

/** 转发超时。比小程序端默认的 60s 短一截，免得前端还在等、云函数已经被平台掐掉。 */
const TIMEOUT_MS = 20000

/**
 * 发一个 HTTP 请求，返回 { status, text }。
 *
 * 有全局 fetch 就用 fetch；没有（Nodejs12 及以下运行时）退回 https/http 模块。
 * 这里不用 axios / node-fetch，是为了让这个函数除 wx-server-sdk 外零依赖 ——
 * 依赖越少，云端 npm 安装出问题的面越小。
 */
function httpRequest({ url, method, headers, body }) {
  if (typeof fetch === 'function') {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
    return fetch(url, { method, headers, body, signal: controller.signal })
      .then(async (res) => ({ status: res.status, text: await res.text() }))
      .finally(() => clearTimeout(timer))
  }

  return new Promise((resolve, reject) => {
    const u = new URL(url)
    const lib = u.protocol === 'http:' ? http : https
    const req = lib.request(
      {
        hostname: u.hostname,
        port: u.port || (u.protocol === 'http:' ? 80 : 443),
        path: u.pathname + u.search,
        method,
        headers,
        timeout: TIMEOUT_MS,
      },
      (res) => {
        let text = ''
        res.setEncoding('utf8')
        res.on('data', (c) => (text += c))
        res.on('end', () => resolve({ status: res.statusCode, text }))
      },
    )
    req.on('timeout', () => {
      // destroy 会触发 error，用 AbortError 的名字对齐 fetch 分支的判断
      const err = new Error('timeout')
      err.name = 'AbortError'
      req.destroy(err)
    })
    req.on('error', reject)
    if (body !== undefined) req.write(body)
    req.end()
  })
}

exports.main = async (event) => {
  const origin = (process.env.API_ORIGIN || DEFAULT_ORIGIN).replace(/\/$/, '')
  if (!origin) {
    return { statusCode: 500, data: { error: 'NO_API_ORIGIN', message: '云函数未配置 API_ORIGIN 环境变量' } }
  }

  // action 分流：默认是转发请求；上传场景要把云存储 fileID 换成后端能下载的 https 地址
  if (event.action === 'fileUrl') {
    const { fileList } = await cloud.getTempFileURL({ fileList: [].concat(event.fileID || []) })
    return { statusCode: 200, data: { urls: fileList.map((f) => f.tempFileURL) } }
  }

  const { path, method = 'GET', data, header = {} } = event
  // 只允许转发本项目的 /api/* 和 /uploads/*，别把云函数做成任意地址的代理
  if (typeof path !== 'string' || !/^\/(api|uploads)\//.test(path)) {
    return { statusCode: 400, data: { error: 'BAD_PATH', message: `不允许转发的路径: ${path}` } }
  }

  const hasBody = !['GET', 'HEAD'].includes(method.toUpperCase())
  let url = origin + path
  if (!hasBody && data && Object.keys(data).length) {
    url += (path.includes('?') ? '&' : '?') + new URLSearchParams(data).toString()
  }

  try {
    const res = await httpRequest({
      url,
      method: method.toUpperCase(),
      headers: { 'Content-Type': 'application/json', ...header },
      body: hasBody && data !== undefined ? JSON.stringify(data) : undefined,
    })
    const text = res.text
    let payload
    try {
      payload = JSON.parse(text)
    } catch {
      // 后端返回了非 JSON（比如 502 的 HTML 错误页），原样带回去，别在这里吞掉
      payload = { error: 'BAD_JSON', message: text.slice(0, 200) }
    }
    return { statusCode: res.status, data: payload }
  } catch (err) {
    const aborted = err.name === 'AbortError'
    return {
      statusCode: 504,
      data: {
        error: aborted ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_UNREACHABLE',
        // 云托管缩容到零时首个请求要 20s 上下才醒，这里把「重试一次」写进文案，
        // 免得前端只看到一句连不上、以为服务挂了
        message: aborted
          ? `后端 ${TIMEOUT_MS / 1000}s 未响应（可能是云托管冷启动，重试一次）`
          : `连不上后端: ${err.message}`,
      },
    }
  }
}
