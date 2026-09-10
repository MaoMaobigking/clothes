/**
 * 功能六预置内容的写库逻辑。
 *
 * 内容、演示用户和少量真实互动在启动时幂等写入。
 * 数据本身在 seeds/community.mjs —— 这一层只管「怎么写进库」，不存内容。
 */
import { execute, getOne } from '../../db/mysql.mjs'
import { findOrCreateByOpenid } from '../../repositories/userRepo.mjs'
import { DEMO_USERS, CONTENTS, INTERACTIONS, COMMENTS } from '../../seeds/community.mjs'

async function ensureUser(key, profile) {
  const { user } = await findOrCreateByOpenid(profile.openid, {
    nickname: profile.nickname,
  })
  return { key, id: user.id, ...profile }
}

async function upsertContent(content, userIds) {
  const values = [
    content.id,
    content.type,
    content.authorUserId ? userIds.get(content.authorUserId) || null : null,
    content.authorName,
    content.authorAvatar,
    content.title,
    content.subtitle,
    content.coverUrl,
    content.category,
    JSON.stringify(content.topics),
    JSON.stringify(content.body),
    content.publishedMonth,
    'published',
  ]
  await execute(
    `INSERT INTO community_contents
      (id, type, author_user_id, author_name, author_avatar, title,
       subtitle, cover_url, category, topics, body, published_month, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       type = VALUES(type),
       author_user_id = VALUES(author_user_id),
       author_name = VALUES(author_name),
       author_avatar = VALUES(author_avatar),
       title = VALUES(title),
       subtitle = VALUES(subtitle),
       cover_url = VALUES(cover_url),
       category = VALUES(category),
       topics = VALUES(topics),
       body = VALUES(body),
       published_month = VALUES(published_month),
       status = VALUES(status)`,
    values,
  )
}

async function upsertInteraction(row, userIds) {
  const [id, contentId, userKey, type] = row
  const userId = userIds.get(userKey)
  if (!userId) return
  await execute(
    `INSERT INTO community_interactions (id, content_id, user_id, type)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       content_id = VALUES(content_id),
       user_id = VALUES(user_id),
       type = VALUES(type)`,
    [id, contentId, userId, type],
  )
}

async function upsertComment(row, userIds) {
  const [id, contentId, userKey, content] = row
  const userId = userIds.get(userKey)
  if (!userId) return
  await execute(
    `INSERT INTO community_comments (id, content_id, user_id, content)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       content_id = VALUES(content_id),
       user_id = VALUES(user_id),
       content = VALUES(content)`,
    [id, contentId, userId, content],
  )
}

export async function seedCommunityIfNeeded() {
  const userIds = new Map()
  for (const user of DEMO_USERS) {
    const saved = await ensureUser(user.key, user)
    userIds.set(user.key, saved.id)
  }

  for (const content of CONTENTS) {
    await upsertContent(content, userIds)
  }
  for (const interaction of INTERACTIONS) {
    await upsertInteraction(interaction, userIds)
  }
  for (const comment of COMMENTS) {
    await upsertComment(comment, userIds)
  }

  const count = await getOne('SELECT COUNT(*) AS n FROM community_contents WHERE status = ?', ['published'])
  return Number(count?.n || 0)
}
