/*
 * 时尚社群接口（功能五）与管理看板。
 */
import { request } from '@/utils/request'
import type {
  AchievementSummary,
  AdminDashboard,
  CommunityComment,
  CommunityContent,
  CommunityContentType,
} from './type'

enum API {
  /** 内容列表；query 里带 type / category / topic */
  CONTENTS_URL = '/api/community/contents',
  /** 单条内容，后面接编码后的 id，再拼 /interactions、/comments、/bookmark */
  CONTENT_URL = '/api/community/contents/',
  /** 教程完成打卡，后面接编码后的 id 再拼 /complete */
  TUTORIAL_URL = '/api/community/tutorials/',
  /** 发布搭配分享 */
  SHARES_URL = '/api/community/shares',
  /** 我的书签 */
  BOOKMARKS_URL = '/api/community/bookmarks',
  /** 成就与积分 */
  ACHIEVEMENTS_URL = '/api/community/achievements',
  /** 管理看板统计 */
  ADMIN_STATS_URL = '/api/community/admin/stats',
}

/** 类型再导出的理由见 api/diary/index.ts 的说明 */
export type {
  Achievement,
  AchievementSummary,
  AdminDashboard,
  AdminMetrics,
  AdminStats,
  CommunityComment,
  CommunityContent,
  CommunityContentBody,
  CommunityContentType,
  CommunitySection,
  CommunityStep,
} from './type'

export async function fetchCommunityContents(
  type: CommunityContentType,
  filters: { category?: string; topic?: string } = {},
): Promise<CommunityContent[]> {
  const query = Object.entries({
    type,
    ...filters,
  })
    .filter(([, value]) => value)
    .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
    .join('&')
  const data = await request<{ items: CommunityContent[] }>({
    url: `${API.CONTENTS_URL}${query ? `?${query}` : ''}`,
  })
  return data.items
}

export async function fetchCommunityContent(id: string): Promise<CommunityContent> {
  const data = await request<{ content: CommunityContent }>({
    url: API.CONTENT_URL + encodeURIComponent(id),
  })
  return data.content
}

export async function toggleCommunityInteraction(
  id: string,
  action: 'like' | 'favorite' | 'report',
): Promise<{ active: boolean; content: CommunityContent }> {
  return request({
    url: `${API.CONTENT_URL}${encodeURIComponent(id)}/interactions`,
    method: 'POST',
    data: { action },
  })
}

export async function addCommunityComment(id: string, content: string): Promise<CommunityComment> {
  const data = await request<{ comment: CommunityComment }>({
    url: `${API.CONTENT_URL}${encodeURIComponent(id)}/comments`,
    method: 'POST',
    data: { content },
  })
  return data.comment
}

export async function bookmarkCommunityContent(id: string, note = ''): Promise<{ active: boolean; note: string }> {
  return request({
    url: `${API.CONTENT_URL}${encodeURIComponent(id)}/bookmark`,
    method: 'POST',
    data: { note },
  })
}

export async function completeCommunityTutorial(
  id: string,
): Promise<{ alreadyCompleted: boolean; points: number; content: CommunityContent }> {
  return request({
    url: `${API.TUTORIAL_URL}${encodeURIComponent(id)}/complete`,
    method: 'POST',
  })
}

export async function createCommunityShare(input: {
  title: string
  description?: string
  imageDataUrl: string
  topics: string[]
}): Promise<CommunityContent> {
  const data = await request<{ share: CommunityContent }>({
    url: API.SHARES_URL,
    method: 'POST',
    data: input,
  })
  return data.share
}

export async function fetchCommunityBookmarks(): Promise<CommunityContent[]> {
  const data = await request<{ items: CommunityContent[] }>({
    url: API.BOOKMARKS_URL,
  })
  return data.items
}

export async function fetchAchievements(): Promise<AchievementSummary> {
  return request({
    url: API.ACHIEVEMENTS_URL,
  })
}

export async function fetchAdminDashboard(): Promise<AdminDashboard> {
  return request({
    url: API.ADMIN_STATS_URL,
  })
}
