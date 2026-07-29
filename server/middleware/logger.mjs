/*
 * 请求日志中间件
 * 用法：app.use(logger) —— 建议放在路由之前
 */

export function logger(req, res, next) {
  const start = Date.now()
  const timestamp = new Date().toISOString()

  console.log(`[${req.method}] ${req.originalUrl} - ${timestamp}`)

  res.on('finish', () => {
    const duration = Date.now() - start
    console.log(`[${req.method}] ${req.originalUrl} - ${res.statusCode} - ${duration}ms`)
  })

  next()
}
