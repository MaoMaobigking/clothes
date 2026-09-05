/*
 * 时尚社群（功能五）与管理看板的数据结构。
 */

export type CommunityContentType = 'magazine' | 'tutorial' | 'share' | 'challenge'

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

/** 看板的三个图表指标，全部由后端从现有表实时聚合，没有独立的统计表 */
export interface AdminMetrics {
  /** 活跃统计的窗口天数，柱状图横轴就是这么多根 */
  activeDays: number
  /** 缺数据的日期后端已补 0，前端拿到的一定是连续的 */
  activeDaily: { day: string; label: string; count: number }[]
  interactionMix: { type: 'like' | 'favorite' | 'complete' | 'report'; count: number }[]
  membership: { userTotal: number; vipCount: number; vipRate: number }
}

export interface AdminDashboard {
  stats: AdminStats
  hotTopics: { topic: string; count: number }[]
  metrics: AdminMetrics
}
