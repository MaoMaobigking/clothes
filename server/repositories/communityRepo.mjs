/**
 * 功能六社区仓库层
 *
 * 与衣橱、报告一样，所有按用户查询的 SQL 都直接带 user_id。
 * 分享、杂志、教程、挑战本身是公共内容；点赞、收藏、举报、书签、
 * 评论和完成状态则严格属于当前 JWT 用户。
 */
import { execute, getAll, getOne } from '../db/mysql.mjs'

function parseJson(value, fallback) {
  if (value === null || value === undefined) return fallback
  if (typeof value === 'object') return value
  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

function mapContent(row) {
  if (!row) return null
  return {
    id: row.id,
    type: row.type,
    authorUserId: row.author_user_id,
    authorName: row.author_name || '灵犀社区',
    authorAvatar: row.author_avatar || '🧑‍🎨',
    title: row.title || '',
    subtitle: row.subtitle || '',
    coverUrl: row.cover_url || '',
    category: row.category || '',
    topics: parseJson(row.topics, []),
    body: parseJson(row.body, {}),
    publishedMonth: row.published_month || '',
    status: row.status || 'published',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    likeCount: Number(row.like_count || 0),
    commentCount: Number(row.comment_count || 0),
    favoriteCount: Number(row.favorite_count || 0),
    completedCount: Number(row.completed_count || 0),
    liked: Boolean(row.liked),
    favorited: Boolean(row.favorited),
    bookmarked: Boolean(row.bookmarked),
    reported: Boolean(row.reported),
    completed: Boolean(row.completed),
    participantCount: Number(row.participant_count || 0),
    note: row.note || '',
  }
}

function contentCountSql() {
  return `
    (SELECT COUNT(*) FROM community_interactions i
      WHERE i.content_id = c.id AND i.type = 'like') AS like_count,
    (SELECT COUNT(*) FROM community_comments cm
      WHERE cm.content_id = c.id) AS comment_count,
    (SELECT COUNT(*) FROM community_interactions i
      WHERE i.content_id = c.id AND i.type = 'favorite') AS favorite_count,
    (SELECT COUNT(*) FROM community_interactions i
      WHERE i.content_id = c.id AND i.type = 'complete') AS completed_count,
    EXISTS(SELECT 1 FROM community_interactions i
      WHERE i.content_id = c.id AND i.user_id = ? AND i.type = 'like') AS liked,
    EXISTS(SELECT 1 FROM community_interactions i
      WHERE i.content_id = c.id AND i.user_id = ? AND i.type = 'favorite') AS favorited,
    EXISTS(SELECT 1 FROM community_bookmarks b
      WHERE b.content_id = c.id AND b.user_id = ?) AS bookmarked,
    EXISTS(SELECT 1 FROM community_interactions i
      WHERE i.content_id = c.id AND i.user_id = ? AND i.type = 'report') AS reported,
    EXISTS(SELECT 1 FROM community_interactions i
      WHERE i.content_id = c.id AND i.user_id = ? AND i.type = 'complete') AS completed`
}

const CONTENT_COLUMNS = `
  c.id, c.type, c.author_user_id, c.author_name, c.author_avatar,
  c.title, c.subtitle, c.cover_url, c.category, c.topics, c.body,
  c.published_month, c.status, c.created_at, c.updated_at`

export async function listContents(
  userId,
  { type, category = '', topic = '', limit = 30, excludeReported = true } = {},
) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 30, 100))
  const params = [userId, userId, userId, userId, userId]
  const where = ['c.status = ?']
  params.push('published')
  if (type) {
    where.push('c.type = ?')
    params.push(type)
  }
  if (category) {
    where.push('c.category = ?')
    params.push(category)
  }
  if (topic) {
    where.push("JSON_CONTAINS(IFNULL(c.topics, JSON_ARRAY()), JSON_QUOTE(?))")
    params.push(topic)
  }
  if (excludeReported) {
    where.push(`NOT EXISTS (
      SELECT 1 FROM community_interactions blocked
      WHERE blocked.content_id = c.id
        AND blocked.user_id = ?
        AND blocked.type = 'report')`)
    params.push(userId)
  }

  const rows = await getAll(
    `SELECT ${CONTENT_COLUMNS}, ${contentCountSql()}
       FROM community_contents c
      WHERE ${where.join(' AND ')}
      ORDER BY
        CASE c.type WHEN 'magazine' THEN 1 WHEN 'tutorial' THEN 2
                    WHEN 'challenge' THEN 3 ELSE 4 END,
        c.published_month DESC,
        c.created_at DESC
      LIMIT ${safeLimit}`,
    params,
  )
  return rows.map(mapContent)
}

export async function findContent(userId, id) {
  const row = await getOne(
    `SELECT ${CONTENT_COLUMNS}, ${contentCountSql()}
       FROM community_contents c
      WHERE c.id = ? AND c.status = 'published'`,
    [userId, userId, userId, userId, userId, id],
  )
  return mapContent(row)
}

export async function listComments(contentId) {
  const rows = await getAll(
    `SELECT cm.id, cm.content, cm.created_at,
            u.id AS user_id, u.nickname, u.avatar_url
       FROM community_comments cm
       JOIN users u ON u.id = cm.user_id
      WHERE cm.content_id = ?
      ORDER BY cm.created_at ASC`,
    [contentId],
  )
  return rows.map((row) => ({
    id: row.id,
    content: row.content,
    createdAt: row.created_at,
    userId: row.user_id,
    authorName: row.nickname || '时尚用户',
    authorAvatar: row.avatar_url || '🧑‍🎨',
  }))
}

export async function setInteraction(userId, contentId, type, active) {
  const key = `${contentId}_${userId}_${type}_${Date.now().toString(36)}`
  if (!active) {
    const result = await execute(
      `DELETE FROM community_interactions
       WHERE user_id = ? AND content_id = ? AND type = ?`,
      [userId, contentId, type],
    )
    return result.affectedRows > 0
  }
  await execute(
    `INSERT INTO community_interactions (id, content_id, user_id, type)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE id = VALUES(id)`,
    [key, contentId, userId, type],
  )
  return true
}

export async function addComment(userId, contentId, content) {
  const id = `comment_${userId}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
  await execute(
    `INSERT INTO community_comments (id, content_id, user_id, content)
     VALUES (?, ?, ?, ?)`,
    [id, contentId, userId, content],
  )
  const row = await getOne(
    `SELECT cm.id, cm.content, cm.created_at,
            u.id AS user_id, u.nickname, u.avatar_url
       FROM community_comments cm
       JOIN users u ON u.id = cm.user_id
      WHERE cm.id = ?`,
    [id],
  )
  return {
    id: row.id,
    content: row.content,
    createdAt: row.created_at,
    userId: row.user_id,
    authorName: row.nickname || '时尚用户',
    authorAvatar: row.avatar_url || '🧑‍🎨',
  }
}

export async function saveBookmark(userId, contentId, note = '') {
  await execute(
    `INSERT INTO community_bookmarks (content_id, user_id, note)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE
       note = VALUES(note),
       updated_at = CURRENT_TIMESTAMP`,
    [contentId, userId, String(note || '').slice(0, 2000)],
  )
  const row = await getOne(
    'SELECT note FROM community_bookmarks WHERE user_id = ? AND content_id = ?',
    [userId, contentId],
  )
  return row?.note || ''
}

export async function listBookmarks(userId) {
  const rows = await getAll(
    `SELECT ${CONTENT_COLUMNS}, ${contentCountSql()},
            b.note
       FROM community_bookmarks b
       JOIN community_contents c ON c.id = b.content_id
      WHERE b.user_id = ? AND c.status = 'published'
      ORDER BY b.updated_at DESC`,
    [userId, userId, userId, userId, userId, userId],
  )
  return rows.map(mapContent)
}

export async function listFavoritedContents(userId) {
  const rows = await getAll(
    `SELECT ${CONTENT_COLUMNS}, ${contentCountSql()}, '' AS note
       FROM community_interactions i
       JOIN community_contents c ON c.id = i.content_id
      WHERE i.user_id = ?
        AND i.type = 'favorite'
        AND c.status = 'published'
      ORDER BY i.created_at DESC`,
    [userId, userId, userId, userId, userId, userId],
  )
  return rows.map(mapContent)
}

export async function listAchievements(userId) {
  const rows = await getAll(
    `SELECT achievement_key, title, badge, points, created_at
       FROM user_achievements
      WHERE user_id = ?
      ORDER BY created_at ASC`,
    [userId],
  )
  return rows.map((row) => ({
    key: row.achievement_key,
    title: row.title,
    badge: row.badge,
    points: Number(row.points || 0),
    createdAt: row.created_at,
  }))
}

export async function grantAchievement(userId, achievement) {
  await execute(
    `INSERT INTO user_achievements
      (user_id, achievement_key, title, badge, points)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       title = VALUES(title),
       badge = VALUES(badge),
       points = VALUES(points)`,
    [
      userId,
      achievement.key,
      achievement.title,
      achievement.badge,
      achievement.points,
    ],
  )
}

export async function createShare(userId, input) {
  const id = `share_u${userId}_${Date.now().toString(36)}`
  const author = await getOne(
    'SELECT nickname, avatar_url FROM users WHERE id = ?',
    [userId],
  )
  await execute(
    `INSERT INTO community_contents
      (id, type, author_user_id, author_name, author_avatar,
       title, subtitle, cover_url, category, topics, body, published_month, status)
     VALUES (?, 'share', ?, ?, ?, ?, ?, ?, 'share', ?, ?, ?, 'published')`,
    [
      id,
      userId,
      author?.nickname || '时尚用户',
      author?.avatar_url || '🧑‍🎨',
      String(input.title || '').slice(0, 160),
      String(input.subtitle || '').slice(0, 255),
      input.coverUrl || '',
      JSON.stringify(input.topics || []),
      JSON.stringify(input.body || {}),
      input.publishedMonth || '',
    ],
  )
  return findContent(userId, id)
}

export async function countChallengeParticipants(topic) {
  const row = await getOne(
    `SELECT COUNT(DISTINCT author_user_id) AS n
       FROM community_contents
      WHERE type = 'share'
        AND status = 'published'
        AND JSON_CONTAINS(IFNULL(topics, JSON_ARRAY()), JSON_QUOTE(?))`,
    [topic],
  )
  return Number(row?.n || 0)
}

export async function countPublishedContents(type) {
  const row = await getOne(
    `SELECT COUNT(*) AS n
       FROM community_contents
      WHERE type = ? AND status = 'published'`,
    [type],
  )
  return Number(row?.n || 0)
}

export async function countCompletedTutorials(userId) {
  const row = await getOne(
    `SELECT COUNT(*) AS n
       FROM community_interactions i
       JOIN community_contents c ON c.id = i.content_id
      WHERE i.user_id = ?
        AND i.type = 'complete'
        AND c.type = 'tutorial'
        AND c.status = 'published'`,
    [userId],
  )
  return Number(row?.n || 0)
}

export async function getAdminStats() {
  const [
    users,
    contents,
    interactions,
    tutorialCompletions,
    comments,
  ] = await Promise.all([
    getOne('SELECT COUNT(*) AS n FROM users'),
    getOne(
      `SELECT COUNT(*) AS total,
              SUM(type = 'magazine') AS magazines,
              SUM(type = 'tutorial') AS tutorials,
              SUM(type = 'share') AS shares,
              SUM(type = 'challenge') AS challenges
         FROM community_contents WHERE status = 'published'`,
    ),
    getOne(
      `SELECT
        SUM(type = 'like') AS likes,
        SUM(type = 'favorite') AS favorites,
        SUM(type = 'report') AS reports
       FROM community_interactions`,
    ),
    getOne(
      `SELECT COUNT(*) AS n
         FROM community_interactions
        WHERE type = 'complete'`,
    ),
    getOne(
      `SELECT COUNT(*) AS n FROM community_comments`,
    ),
  ])

  return {
    userCount: Number(users?.n || 0),
    contentCount: Number(contents?.total || 0),
    magazineCount: Number(contents?.magazines || 0),
    tutorialCount: Number(contents?.tutorials || 0),
    shareCount: Number(contents?.shares || 0),
    challengeCount: Number(contents?.challenges || 0),
    likeCount: Number(interactions?.likes || 0),
    favoriteCount: Number(interactions?.favorites || 0),
    reportCount: Number(interactions?.reports || 0),
    tutorialCompletionCount: Number(tutorialCompletions?.n || 0),
    commentCount: Number(comments?.n || 0),
  }
}

export async function getHotTopics(limit = 6) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 6, 20))
  const rows = await getAll(
    `SELECT topics
       FROM community_contents
      WHERE status = 'published' AND topics IS NOT NULL`,
  )
  const counts = new Map()
  rows.forEach((row) => {
    parseJson(row.topics, []).forEach((topic) => {
      counts.set(topic, (counts.get(topic) || 0) + 1)
    })
  })
  return [...counts.entries()]
    .map(([topic, count]) => ({ topic, count }))
    .sort((a, b) => b.count - a.count || a.topic.localeCompare(b.topic))
    .slice(0, safeLimit)
}
