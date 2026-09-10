/**
 * 功能六社区服务层的统一出口。
 *
 * 原来是 services/ 根目录下平铺的 communityService.mjs + communitySeedService.mjs，
 * 收成一个目录：
 *
 *   content.mjs  业务逻辑 —— 内容列表、点赞/收藏/举报/评论/书签、成就、看板。
 *   seed.mjs     预置内容的写库逻辑（幂等）。数据本身在 seeds/community.mjs，
 *                这一层只管「怎么写进库」。
 *
 * 两个文件之间没有依赖，都只朝下依赖 repositories/communityRepo.mjs 与 db/mysql.mjs。
 *
 * 为什么 seed 进这个目录，而 demoSeed.mjs 留在 services/ 顶层：
 * seedCommunityIfNeeded 只碰 community 一个域，所以它属于这里；
 * demoSeed 横跨 auth + wardrobe + commerce 四五个域，进任何一个都不合适。
 *
 * ⚠️ db/mysql.mjs:135 用**动态** import 引 seedCommunityIfNeeded（建表完再灌数据，
 * 避免 db ← services ← db 的静态循环）。改这里的导出名要记得同步那处。
 *
 * ⚠️ ESM 不支持目录导入，引用方必须写全 `services/community/index.mjs`。
 */

export {
  listContents,
  getContent,
  toggleInteraction,
  addComment,
  saveBookmark,
  listBookmarks,
  listAchievements,
  completeTutorial,
  createShare,
  getAdminDashboard,
} from './content.mjs'
export { seedCommunityIfNeeded } from './seed.mjs'
