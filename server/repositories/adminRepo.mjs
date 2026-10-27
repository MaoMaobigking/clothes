import { getAll, getOne, execute } from '../db/mysql.mjs'
const LISTS = {
  users: { table: 'users', columns: 'id, nickname, role, membership_level, created_at', search: 'nickname' },
  garments: { table: 'garments', columns: 'id, user_id, name, category, price, created_at', search: 'name' },
  orders: {
    table: 'shop_orders',
    columns: 'id, user_id, order_no, status, pay_amount, created_at',
    search: 'order_no',
  },
  'ai-stats': {
    table: 'ai_logs',
    columns: 'id, user_id, scene, model, prompt_tokens, completion_tokens, latency_ms, ok, created_at',
    search: 'scene',
  },
}
export async function listAdminRows(kind, input = {}) {
  const spec = LISTS[kind]
  if (!spec) throw Object.assign(new Error('页面不存在'), { status: 404 })
  const page = Math.max(1, Math.min(100000, Math.floor(Number(input.page) || 1)))
  const limit = 20
  const search = String(input.search || '')
    .trim()
    .slice(0, 100)
  const where = search ? ` WHERE ${spec.search} LIKE ?` : ''
  const params = search ? [`%${search}%`] : []
  const [items, count] = await Promise.all([
    getAll(
      `SELECT ${spec.columns} FROM ${spec.table}${where} ORDER BY created_at DESC, id DESC LIMIT ${limit} OFFSET ${(page - 1) * limit}`,
      params,
    ),
    getOne(`SELECT COUNT(*) AS total FROM ${spec.table}${where}`, params),
  ])
  return { items, total: Number(count.total), page, pageSize: limit }
}
export async function adminOverview() {
  const [users, garments, orders, ai, daily] = await Promise.all([
    getOne('SELECT COUNT(*) AS total FROM users'),
    getOne('SELECT COUNT(*) AS total FROM garments'),
    getOne('SELECT COUNT(*) AS total FROM shop_orders'),
    getOne(
      'SELECT COUNT(*) AS total, COALESCE(SUM(ok = 0),0) AS failures, COALESCE(ROUND(AVG(latency_ms)),0) AS latency FROM ai_logs',
    ),
    getAll(
      'SELECT DATE(created_at) AS day, COUNT(*) AS calls, SUM(ok = 0) AS failures FROM ai_logs WHERE created_at >= DATE_SUB(CURRENT_DATE(), INTERVAL 6 DAY) GROUP BY DATE(created_at) ORDER BY day',
    ),
  ])
  return {
    users: Number(users.total),
    garments: Number(garments.total),
    orders: Number(orders.total),
    aiCalls: Number(ai.total),
    failures: Number(ai.failures),
    latency: Number(ai.latency),
    daily,
  }
}
export function garmentOwner(id) {
  return getOne('SELECT user_id FROM garments WHERE id = ?', [id])
}
export async function updateAdminGarment(id, userId, { name, category, price }) {
  await execute('UPDATE garments SET name = ?, category = ?, price = ? WHERE id = ? AND user_id = ?', [
    name,
    category,
    price,
    id,
    userId,
  ])
}
