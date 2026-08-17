import { request } from './http'

export type CommunityContentType =
  | 'magazine'
  | 'tutorial'
  | 'share'
  | 'challenge'

export interface CommunitySection {
  heading: string
  text: string
}

export interface CommunityStep {
  title: string
  text: string
  imageUrl?: string
}

export interface CommunityContentBody {
  intro?: string
  quote?: string
  sections?: CommunitySection[]
  mode?: 'video' | 'text' | 'mixed'
  duration?: string
  verified?: boolean
  videoUrl?: string
  posterUrl?: string
  steps?: CommunityStep[]
  caption?: string
  description?: string
  lookDescription?: string
  rules?: string[]
  reward?: string
}

export interface CommunityComment {
  id: string
  content: string
  createdAt: string
  userId: number
  authorName: string
  authorAvatar: string
}

export interface CommunityContent {
  id: string
  type: CommunityContentType
  authorUserId: number | null
  authorName: string
  authorAvatar: string
  title: string
  subtitle: string
  coverUrl: string
  category: string
  topics: string[]
  body: CommunityContentBody
  publishedMonth: string
  status: string
  createdAt: string
  updatedAt: string
  likeCount: number
  commentCount: number
  favoriteCount: number
  completedCount: number
  liked: boolean
  favorited: boolean
  bookmarked: boolean
  reported: boolean
  completed: boolean
  participantCount: number
  note: string
  comments?: CommunityComment[]
}

export interface Achievement {
  key: string
  title: string
  badge: string
  points: number
  createdAt: string
}

export interface AchievementSummary {
  points: number
  badges: Achievement[]
  completed: string[]
}

export interface AdminStats {
  userCount: number
  contentCount: number
  magazineCount: number
  tutorialCount: number
  shareCount: number
  challengeCount: number
  likeCount: number
  favoriteCount: number
  reportCount: number
  tutorialCompletionCount: number
  commentCount: number
}

export interface AdminDashboard {
  stats: AdminStats
  hotTopics: { topic: string; count: number }[]
}

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
    url: `/api/community/contents${query ? `?${query}` : ''}`,
  })
  return data.items
}

export async function fetchCommunityContent(id: string): Promise<CommunityContent> {
  const data = await request<{ content: CommunityContent }>({
    url: `/api/community/contents/${encodeURIComponent(id)}`,
  })
  return data.content
}

export async function toggleCommunityInteraction(
  id: string,
  action: 'like' | 'favorite' | 'report',
): Promise<{ active: boolean; content: CommunityContent }> {
  return request({
    url: `/api/community/contents/${encodeURIComponent(id)}/interactions`,
    method: 'POST',
    data: { action },
  })
}

export async function addCommunityComment(
  id: string,
  content: string,
): Promise<CommunityComment> {
  const data = await request<{ comment: CommunityComment }>({
    url: `/api/community/contents/${encodeURIComponent(id)}/comments`,
    method: 'POST',
    data: { content },
  })
  return data.comment
}

export async function bookmarkCommunityContent(
  id: string,
  note = '',
): Promise<{ active: boolean; note: string }> {
  return request({
    url: `/api/community/contents/${encodeURIComponent(id)}/bookmark`,
    method: 'POST',
    data: { note },
  })
}

export async function completeCommunityTutorial(
  id: string,
): Promise<{ alreadyCompleted: boolean; points: number; content: CommunityContent }> {
  return request({
    url: `/api/community/tutorials/${encodeURIComponent(id)}/complete`,
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
    url: '/api/community/shares',
    method: 'POST',
    data: input,
  })
  return data.share
}

export async function fetchCommunityBookmarks(): Promise<CommunityContent[]> {
  const data = await request<{ items: CommunityContent[] }>({
    url: '/api/community/bookmarks',
  })
  return data.items
}

export async function fetchAchievements(): Promise<AchievementSummary> {
  return request({
    url: '/api/community/achievements',
  })
}

export async function fetchAdminDashboard(): Promise<AdminDashboard> {
  return request({
    url: '/api/community/admin/stats',
  })
}
