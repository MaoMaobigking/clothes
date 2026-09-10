/**
 * 功能六社区业务层
 *
 * 公共内容可读，但用户状态（点赞/收藏/举报/评论/书签/完成）全部落库。
 * 举报不会删除公共内容，只从举报者自己的后续列表中过滤。
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
import * as repo from '../../repositories/communityRepo.mjs'

const here = dirname(fileURLToPath(import.meta.url))
// 三段回退到 server/：本文件在 services/community/ 下，'..' 只到 services/
const uploadRoot = join(here, '..', '..', 'uploads', 'community')
const MAX_IMAGE_BYTES = 8 * 1024 * 1024
const IMAGE_MIME = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

function notFound(message = '内容不存在') {
  const err = new Error(message)
  err.status = 404
  err.code = 'NOT_FOUND'
  throw err
}

function invalid(message, code = 'INVALID_COMMUNITY_INPUT') {
  const err = new Error(message)
  err.status = 400
  err.code = code
  throw err
}

async function requireVisibleContent(userId, id) {
  const content = await repo.findContent(userId, id)
  if (!content || content.reported) notFound()
  return content
}

export async function listContents(userId, query = {}) {
  const allowedTypes = new Set(['magazine', 'tutorial', 'share', 'challenge'])
  const type = query.type
  if (type && !allowedTypes.has(type)) {
    invalid('内容类型不合法')
  }
  const items = await repo.listContents(userId, {
    type,
    category: query.category || '',
    topic: query.topic || '',
    limit: query.limit,
    excludeReported: type === 'share',
  })
  if (type === 'challenge') {
    await Promise.all(
      items.map(async (item) => {
        const topic = item.topics?.[0]
        if (topic) item.participantCount = await repo.countChallengeParticipants(topic)
      }),
    )
  }
  return items
}

export async function getContent(userId, id) {
  const content = await requireVisibleContent(userId, id)
  if (content.type === 'share') {
    content.comments = await repo.listComments(id)
  }
  return content
}

export async function toggleInteraction(userId, contentId, action) {
  const allowed = new Set(['like', 'favorite', 'report'])
  if (!allowed.has(action)) invalid('互动类型不合法')
  const content = await requireVisibleContent(userId, contentId)
  const active = action === 'like' ? !content.liked : action === 'favorite' ? !content.favorited : !content.reported
  await repo.setInteraction(userId, contentId, action, active)
  return {
    active,
    content: await repo.findContent(userId, contentId),
  }
}

export async function addComment(userId, contentId, text) {
  const value = String(text || '').trim()
  if (!value) invalid('评论内容不能为空')
  if (value.length > 500) invalid('评论最多 500 字')
  await requireVisibleContent(userId, contentId)
  return repo.addComment(userId, contentId, value)
}

export async function saveBookmark(userId, contentId, note = '') {
  await requireVisibleContent(userId, contentId)
  const savedNote = await repo.saveBookmark(userId, contentId, note)
  return { active: true, note: savedNote }
}

export async function listBookmarks(userId) {
  const [bookmarks, favorites] = await Promise.all([repo.listBookmarks(userId), repo.listFavoritedContents(userId)])
  const merged = new Map()
  bookmarks.forEach((item) => merged.set(item.id, item))
  favorites.forEach((item) => {
    if (!merged.has(item.id)) merged.set(item.id, item)
  })
  return [...merged.values()].sort(
    (a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime(),
  )
}

export async function listAchievements(userId) {
  const achievements = await repo.listAchievements(userId)
  return {
    points: achievements.reduce((sum, item) => sum + item.points, 0),
    badges: achievements.filter((item) => item.badge && item.badge !== '✅'),
    completed: achievements.filter((item) => item.badge === '✅').map((item) => item.key.replace(/^tutorial_/, '')),
  }
}

export async function completeTutorial(userId, contentId) {
  const content = await requireVisibleContent(userId, contentId)
  if (content.type !== 'tutorial') {
    invalid('只有穿搭教程可以完成打卡')
  }
  if (content.completed) {
    return { alreadyCompleted: true, content }
  }

  await repo.setInteraction(userId, contentId, 'complete', true)
  await repo.grantAchievement(userId, {
    key: `tutorial_${contentId}`,
    title: `完成：${content.title}`,
    badge: '✅',
    points: 10,
  })

  const completedCount = await repo.countCompletedTutorials(userId)
  if (completedCount === 1) {
    await repo.grantAchievement(userId, {
      key: 'learning_starter',
      title: '穿搭新手',
      badge: '🌱',
      points: 0,
    })
  }
  if (completedCount === 2) {
    await repo.grantAchievement(userId, {
      key: 'learning_advanced',
      title: '穿搭进阶者',
      badge: '🧥',
      points: 0,
    })
  }
  const tutorialTotal = await repo.countPublishedContents('tutorial')
  if (completedCount === tutorialTotal && tutorialTotal > 0) {
    await repo.grantAchievement(userId, {
      key: 'learning_all_round',
      title: '全能衣橱生',
      badge: '🏆',
      points: 0,
    })
  }

  return {
    alreadyCompleted: false,
    points: (await repo.listAchievements(userId)).reduce((sum, item) => sum + item.points, 0),
    content: await repo.findContent(userId, contentId),
  }
}

function normalizeTopics(value) {
  if (!Array.isArray(value)) return []
  return [
    ...new Set(
      value
        .map((topic) => String(topic).trim())
        .filter(Boolean)
        .map((topic) => (topic.startsWith('#') ? topic : `#${topic}`))
        .slice(0, 5),
    ),
  ]
}

async function saveShareImage(userId, imageDataUrl) {
  if (typeof imageDataUrl !== 'string' || !imageDataUrl.startsWith('data:image/')) {
    invalid('请上传真实穿搭照片')
  }
  const match = imageDataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/)
  if (!match) invalid('仅支持 JPEG、PNG 或 WebP 图片')
  const mime = match[1]
  const base64 = match[2]
  const size = Buffer.byteLength(base64, 'base64')
  if (size > MAX_IMAGE_BYTES) {
    invalid('图片不能超过 8MB', 'IMAGE_TOO_LARGE')
  }

  const extension = IMAGE_MIME[mime] || 'jpg'
  const filename = `u${userId}_${Date.now()}.${extension}`
  await mkdir(uploadRoot, { recursive: true })
  await writeFile(join(uploadRoot, filename), Buffer.from(base64, 'base64'))
  return `/uploads/community/${filename}`
}

export async function createShare(userId, input = {}) {
  const caption = String(input.title || '').trim()
  if (!caption) invalid('请填写分享文案')
  const coverUrl = await saveShareImage(userId, input.imageDataUrl)
  const body = {
    caption,
    description: String(input.subtitle || input.description || '').trim(),
    lookDescription: String(input.lookDescription || '').trim(),
  }
  const now = new Date()
  const publishedMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  return repo.createShare(userId, {
    title: caption.slice(0, 64),
    subtitle: body.description || caption,
    coverUrl,
    topics: normalizeTopics(input.topics),
    body,
    publishedMonth,
  })
}

export async function getAdminDashboard() {
  const stats = await repo.getAdminStats()
  const hotTopics = await repo.getHotTopics()
  // 三个图表指标（近 7 日活跃 / 互动构成 / 会员渗透），全部来自现有表的实时聚合
  const metrics = await repo.getAdminMetrics()
  return { stats, hotTopics, metrics }
}
