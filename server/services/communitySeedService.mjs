/**
 * 功能六预置内容
 *
 * 内容、演示用户和少量真实互动在启动时幂等写入。
 * 所有 id 都是稳定字符串，重复启动只更新同一批演示数据，不清空用户数据。
 */
import { execute, getOne } from '../db/mysql.mjs'
import { findOrCreateByOpenid } from '../repositories/userRepo.mjs'

const MODEL_IMAGE = '/static/images/model/front.jpg'
const MODEL_IMAGE_MALE = '/static/images/model/front-male.jpg'

const DEMO_USERS = [
  { key: 'alice', openid: 'demo_community_alice', nickname: '小鱼要暴富', avatar: '🐟' },
  { key: 'lina', openid: 'demo_community_lina', nickname: '通勤小圈', avatar: '💼' },
  { key: 'yan', openid: 'demo_community_yan', nickname: '莫兰迪', avatar: '🫧' },
]

const CONTENTS = [
  {
    id: 'mag-2026-08-cover',
    type: 'magazine',
    authorName: '灵犀编辑部',
    authorAvatar: '📖',
    title: '灵犀八月刊',
    subtitle: '一件白衬衫的七种穿法',
    coverUrl: MODEL_IMAGE,
    category: '时尚杂志',
    topics: ['#白衬衫', '#夏季穿搭'],
    publishedMonth: '2026-08',
    body: {
      intro: '白衬衫不是基础款，而是最有表达空间的画布。',
      sections: [
        { heading: '通勤：西裤与尖头鞋', text: '把衬衫塞进高腰西裤，再配一只低饱和托特包，保持领口和袖口干净利落。' },
        { heading: '周末：牛仔裤与帆布鞋', text: '解开两颗扣子，袖口随意挽起，让版型本身成为造型重点。' },
        { heading: '约会：半裙与玛丽珍', text: '选择带泡泡袖或细褶的衬衫，搭配同色系半裙，甜美但不过度用力。' },
      ],
      quote: '穿衣的稳定感，来自每一件衣服都有一百种打开方式。',
    },
  },
  {
    id: 'mag-2026-08-commute',
    type: 'magazine',
    authorName: '灵犀编辑部',
    authorAvatar: '📖',
    title: '通勤胶囊衣橱',
    subtitle: '五天不重样的十件单品公式',
    coverUrl: MODEL_IMAGE_MALE,
    category: '时尚杂志',
    topics: ['#通勤穿搭', '#胶囊衣橱'],
    publishedMonth: '2026-08',
    body: {
      intro: '通勤穿搭的难点不是数量，而是每件单品都能互相配合。',
      sections: [
        { heading: '三件上衣', text: '一件衬衫、一件针织、一件有质感的基础 T。' },
        { heading: '两件下装', text: '直筒西裤负责正式，深色牛仔裤负责松弛。' },
        { heading: '一件外套与两双鞋', text: '西装外套连接上下班，乐福鞋和板鞋轮换使用。' },
      ],
      quote: '少而准的衣橱，比每天都换新衣服更有力量。',
    },
  },
  {
    id: 'mag-2026-07-color',
    type: 'magazine',
    authorName: '色彩观察所',
    authorAvatar: '🎨',
    title: '莫兰迪配色指南',
    subtitle: '低饱和色怎么搭才不显脏',
    coverUrl: MODEL_IMAGE,
    category: '时尚杂志',
    topics: ['#色彩搭配', '#莫兰迪'],
    publishedMonth: '2026-07',
    body: {
      intro: '低饱和不等于灰扑扑，关键是明确深浅层次与材质反差。',
      sections: [
        { heading: '同色系过渡', text: '从浅灰绿到深橄榄色，保留色相一致，只改变明度。' },
        { heading: '小面积提亮', text: '米色与灰蓝之间加入一只焦糖色包，整体立刻有焦点。' },
        { heading: '材质制造层次', text: '羊毛、亚麻、丝缎和皮革交叉出现，颜色安静但质感丰富。' },
      ],
      quote: '高级感不是颜色少，而是每种颜色都各司其职。',
    },
  },
  {
    id: 'tut-basic-layering',
    type: 'tutorial',
    authorName: '穿搭课代表',
    authorAvatar: '🧥',
    title: '新手必学的十个叠穿公式',
    subtitle: '从两层到三层，快速建立叠穿框架',
    coverUrl: MODEL_IMAGE_MALE,
    category: '新手入门',
    topics: ['#叠穿', '#新手入门'],
    publishedMonth: '2026-08',
    body: {
      mode: 'video',
      duration: '8 分钟',
      verified: true,
      videoUrl: '',
      posterUrl: MODEL_IMAGE_MALE,
      steps: [
        { title: '确认内搭长度', text: '内搭下摆不要超过外套太多，整体重心会稳定。', imageUrl: MODEL_IMAGE_MALE },
        { title: '拉开颜色明度', text: '深浅两层之间保留明显层次，避免全部糊在一起。', imageUrl: MODEL_IMAGE },
        { title: '收束脚部轮廓', text: '裤脚与鞋面干净利落，叠穿才不会显得拖沓。', imageUrl: MODEL_IMAGE },
      ],
    },
  },
  {
    id: 'tut-proportion',
    type: 'tutorial',
    authorName: '比例研究室',
    authorAvatar: '📐',
    title: '小个子显高穿搭技巧',
    subtitle: '用腰线、鞋子和颜色连续性改善比例',
    coverUrl: MODEL_IMAGE,
    category: '高级技巧',
    topics: ['#小个子穿搭', '#显高'],
    publishedMonth: '2026-08',
    body: {
      mode: 'mixed',
      duration: '12 分钟',
      videoUrl: '',
      posterUrl: MODEL_IMAGE,
      steps: [
        { title: '把腰线标清楚', text: '高腰下装或短上衣，让上半身与下半身的分界更靠上。', imageUrl: MODEL_IMAGE },
        { title: '保持纵向连续', text: '鞋、袜与下装同色，视线不会在中途被切断。', imageUrl: MODEL_IMAGE_MALE },
        { title: '控制单品体积', text: '外套和包不要超过身体比例，避免被单品吞掉。', imageUrl: MODEL_IMAGE },
      ],
    },
  },
  {
    id: 'tut-office-week',
    type: 'tutorial',
    authorName: '通勤小圈',
    authorAvatar: '💼',
    title: '通勤五天不重样',
    subtitle: '用一件西装外套搭出五个工作日',
    coverUrl: MODEL_IMAGE,
    category: '场景穿搭',
    topics: ['#通勤穿搭', '#一周穿搭'],
    publishedMonth: '2026-08',
    body: {
      mode: 'mixed',
      duration: '10 分钟',
      verified: true,
      videoUrl: '',
      posterUrl: MODEL_IMAGE,
      steps: [
        { title: '周一周二：衬衫与西裤', text: '用颜色和鞋包调整正式度，两天不会重复。', imageUrl: MODEL_IMAGE },
        { title: '周三周四：针织与半裙', text: '同件外套切换柔和的材质组合。', imageUrl: MODEL_IMAGE_MALE },
        { title: '周五：T 恤与牛仔裤', text: '保留西装轮廓，但用休闲单品进入周末节奏。', imageUrl: MODEL_IMAGE },
      ],
    },
  },
  {
    id: 'tut-accessory-focus',
    type: 'tutorial',
    authorName: '配饰玩家',
    authorAvatar: '💍',
    title: '配饰怎么戴才点睛',
    subtitle: '首饰、帽子和腰带的克制法则',
    coverUrl: MODEL_IMAGE_MALE,
    category: '配饰搭配',
    topics: ['#配饰搭配', '#点睛'],
    publishedMonth: '2026-08',
    body: {
      mode: 'text',
      duration: '6 分钟',
      videoUrl: '',
      posterUrl: MODEL_IMAGE_MALE,
      steps: [
        { title: '只保留一个主焦点', text: '耳饰、项链和腰带不要同时抢戏。', imageUrl: MODEL_IMAGE_MALE },
        { title: '配饰呼应衣服颜色', text: '金属色或低饱和色比鲜艳撞色更容易融入。', imageUrl: MODEL_IMAGE },
        { title: '用帽子制造风格', text: '一顶帽子可以迅速把基础造型变成法式或街头风。', imageUrl: MODEL_IMAGE_MALE },
      ],
    },
  },
  {
    id: 'share-demo-01',
    type: 'share',
    authorUserId: 'alice',
    authorName: '小鱼要暴富',
    authorAvatar: '🐟',
    title: '155 小个子秋冬这样穿显高 10cm',
    subtitle: '高腰线 + 顺色下装，真的亲测有效',
    coverUrl: MODEL_IMAGE,
    category: '用户分享',
    topics: ['#小个子穿搭', '#显高'],
    publishedMonth: '2026-08',
    body: { caption: '高腰线 + 顺色下装，真的亲测有效', description: '155 小个子秋冬显高记录' },
  },
  {
    id: 'share-demo-02',
    type: 'share',
    authorUserId: 'lina',
    authorName: '通勤小圈',
    authorAvatar: '💼',
    title: '一周五天不重样的通勤 look',
    subtitle: '同件外套换内搭，五天也有新鲜感',
    coverUrl: MODEL_IMAGE_MALE,
    category: '用户分享',
    topics: ['#通勤穿搭', '#一周穿搭挑战'],
    publishedMonth: '2026-08',
    body: { caption: '同件外套换内搭，五天也有新鲜感', description: '一周通勤穿搭记录' },
  },
  {
    id: 'share-demo-03',
    type: 'share',
    authorUserId: 'yan',
    authorName: '莫兰迪',
    authorAvatar: '🫧',
    title: '低饱和配色，怎么搭都高级',
    subtitle: '灰蓝 + 米白 + 燕麦色，干净又耐看',
    coverUrl: MODEL_IMAGE,
    category: '用户分享',
    topics: ['#色彩搭配', '#莫兰迪'],
    publishedMonth: '2026-08',
    body: { caption: '灰蓝 + 米白 + 燕麦色，干净又耐看', description: '今日低饱和配色记录' },
  },
  {
    id: 'share-demo-04',
    type: 'share',
    authorUserId: 'alice',
    authorName: '小鱼要暴富',
    authorAvatar: '🐟',
    title: '旧毛衣改成马甲，成本 0 元',
    subtitle: '去年舍不得扔的衣服，今年又穿了',
    coverUrl: MODEL_IMAGE_MALE,
    category: '用户分享',
    topics: ['#旧衣改造'],
    publishedMonth: '2026-08',
    body: { caption: '去年舍不得扔的衣服，今年又穿了', description: '旧毛衣手作改造' },
  },
  {
    id: 'share-demo-05',
    type: 'share',
    authorUserId: 'lina',
    authorName: '通勤小圈',
    authorAvatar: '💼',
    title: '胶囊衣橱的一周复盘',
    subtitle: '十件单品完成七个造型',
    coverUrl: MODEL_IMAGE,
    category: '用户分享',
    topics: ['#胶囊衣橱', '#一周穿搭挑战'],
    publishedMonth: '2026-08',
    body: { caption: '十件单品完成七个造型', description: '我的通勤胶囊衣橱' },
  },
  {
    id: 'share-demo-06',
    type: 'share',
    authorUserId: 'yan',
    authorName: '莫兰迪',
    authorAvatar: '🫧',
    title: '一条丝巾的三套用法',
    subtitle: '系在颈间、包上、发尾',
    coverUrl: MODEL_IMAGE_MALE,
    category: '用户分享',
    topics: ['#配饰搭配', '#点睛'],
    publishedMonth: '2026-08',
    body: { caption: '一条丝巾，三个位置三种气质', description: '配饰搭配小实验' },
  },
  {
    id: 'challenge-week',
    type: 'challenge',
    authorName: '灵犀社区',
    authorAvatar: '📅',
    title: '一周穿搭挑战',
    subtitle: '连续七天记录真实穿搭',
    coverUrl: MODEL_IMAGE,
    category: '穿搭打卡',
    topics: ['#一周穿搭挑战'],
    publishedMonth: '2026-08',
    body: {
      description: '每天发布一套真实穿搭，七天不中断即可完成挑战。',
      rules: ['图片必须是本人真实穿搭', '每条内容带话题标签', '同一天可补发一条'],
      reward: '完成挑战获得 10 积分与「一周穿搭」徽章',
    },
  },
  {
    id: 'challenge-rework',
    type: 'challenge',
    authorName: '灵犀社区',
    authorAvatar: '♻️',
    title: '旧衣改造计划',
    subtitle: '给闲置衣物第二次生命',
    coverUrl: MODEL_IMAGE_MALE,
    category: '旧衣新生',
    topics: ['#旧衣改造'],
    publishedMonth: '2026-08',
    body: {
      description: '上传一件旧衣改造前后对比，分享你的改造思路。',
      rules: ['上传改造前后照片', '说明使用了哪些材料', '不发布来路不明的物品'],
      reward: '高赞作品进入本周旧衣新生精选',
    },
  },
  {
    id: 'challenge-capsule',
    type: 'challenge',
    authorName: '灵犀社区',
    authorAvatar: '🧳',
    title: '通勤胶囊衣橱',
    subtitle: '用十件单品完成七天造型',
    coverUrl: MODEL_IMAGE,
    category: '通勤穿搭',
    topics: ['#胶囊衣橱', '#通勤穿搭'],
    publishedMonth: '2026-08',
    body: {
      description: '固定不超过十件单品，连续记录七个工作日造型。',
      rules: ['每套标注使用了哪些单品', '不额外购买新衣', '可跨日重复使用单品'],
      reward: '完成挑战获得「胶囊衣橱」徽章',
    },
  },
]

const INTERACTIONS = [
  ['demo_like_1', 'share-demo-01', 'lina', 'like'],
  ['demo_like_2', 'share-demo-01', 'yan', 'like'],
  ['demo_like_3', 'share-demo-02', 'alice', 'like'],
  ['demo_like_4', 'share-demo-03', 'alice', 'like'],
  ['demo_like_5', 'share-demo-03', 'lina', 'like'],
  ['demo_like_6', 'share-demo-04', 'lina', 'like'],
  ['demo_like_7', 'share-demo-05', 'yan', 'like'],
  ['demo_fav_1', 'share-demo-01', 'lina', 'favorite'],
  ['demo_fav_2', 'share-demo-02', 'yan', 'favorite'],
  ['demo_fav_3', 'share-demo-03', 'alice', 'favorite'],
  ['demo_complete_1', 'tut-basic-layering', 'alice', 'complete'],
  ['demo_complete_2', 'tut-office-week', 'lina', 'complete'],
  ['demo_complete_3', 'tut-accessory-focus', 'yan', 'complete'],
]

const COMMENTS = [
  ['demo_comment_1', 'share-demo-01', 'lina', '这个腰线处理太实用了！'],
  ['demo_comment_2', 'share-demo-01', 'yan', '鞋子颜色和裤子连成一条线，比例真的显高。'],
  ['demo_comment_3', 'share-demo-02', 'alice', '周一到周五照着穿很省心。'],
  ['demo_comment_4', 'share-demo-03', 'lina', '灰蓝加米白好舒服，学到了。'],
  ['demo_comment_5', 'share-demo-04', 'yan', '旧衣改造成功的一件，很自然。'],
]

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
