/*
 * 统一错误处理中间件
 * 用法：app.use(errorHandler) —— 必须放在所有路由之后
 */

import { config } from '../config/env.mjs'

export function errorHandler(err, req, res, _next) {
  const statusCode = err.statusCode || err.status || 500
  const code = err.code || err.error || 'INTERNAL_ERROR'
  const message = err.message || '服务器内部错误'

  // 开发环境打印完整堆栈
  if (!config.runtime.isProduction) {
    console.error(`[ERROR] ${req.method} ${req.originalUrl}`)
    console.error(err.stack || err)
  }

  res.status(statusCode).json({ error: code, message })
}
