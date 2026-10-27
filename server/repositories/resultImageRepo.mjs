import { execute, getOne } from '../db/mysql.mjs'
export async function saveResultImage({ id, userId, taskId, mime, content }) {
  await execute(
    'INSERT INTO ai_result_images (id, user_id, task_id, mime, content) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE task_id = VALUES(task_id)',
    [id, userId, taskId, mime, content],
  )
  return getOne('SELECT id FROM ai_result_images WHERE task_id = ? AND user_id = ?', [taskId, userId])
}
export function findResultImage(userId, id) {
  return getOne('SELECT mime, content FROM ai_result_images WHERE id = ? AND user_id = ?', [id, userId])
}
