-- AI 服装 · MySQL 数据库建表脚本
-- 使用方法：docker exec -i mysql_container mysql -uroot -p<密码> lingxi < schema.sql
-- 或在 MySQL 客户端中执行 source schema.sql

CREATE DATABASE IF NOT EXISTS lingxi CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE lingxi;

-- 1. 用户表
-- account / password_hash 服务于规格 §5「账号密码登录 + 四类预置演示账号」。
-- 普通微信用户这两列为 NULL，只有演示账号和管理员才有值。
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  openid VARCHAR(64) UNIQUE,
  account VARCHAR(64) NULL,
  password_hash VARCHAR(160) NULL,
  nickname VARCHAR(64),
  avatar_url VARCHAR(512),
  role VARCHAR(32) NOT NULL DEFAULT 'user',
  membership_level VARCHAR(32) NOT NULL DEFAULT 'standard',
  demo_kind VARCHAR(32) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_users_account (account)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. 身形档案
CREATE TABLE IF NOT EXISTS body_profiles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  gender VARCHAR(16),
  styles JSON,
  skin VARCHAR(32),
  face VARCHAR(32),
  body_type VARCHAR(32),
  height DECIMAL(5,1),
  weight DECIMAL(5,1),
  bmi DECIMAL(4,1),
  bust DECIMAL(5,1),
  waist DECIMAL(5,1),
  hips DECIMAL(5,1),
  shoulder DECIMAL(5,1),
  thigh DECIMAL(5,1),
  calf DECIMAL(5,1),
  preferences JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_body_user_created (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. AI 风格报告 ★
CREATE TABLE IF NOT EXISTS style_reports (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  answers JSON,
  result JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  -- 「历史报告」列表页按 user_id + 时间倒序查，加复合索引避免全表扫
  INDEX idx_user_created (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 10. 功能六：时尚社区内容
CREATE TABLE IF NOT EXISTS community_contents (
  id VARCHAR(64) PRIMARY KEY,
  type ENUM('magazine','tutorial','share','challenge') NOT NULL,
  author_user_id INT NULL,
  author_name VARCHAR(64) NOT NULL DEFAULT '',
  author_avatar VARCHAR(32) NOT NULL DEFAULT '',
  title VARCHAR(160) NOT NULL,
  subtitle VARCHAR(255) NOT NULL DEFAULT '',
  cover_url VARCHAR(512) NOT NULL DEFAULT '',
  category VARCHAR(32) NOT NULL DEFAULT '',
  topics JSON NULL,
  body JSON NULL,
  published_month CHAR(7) NOT NULL DEFAULT '',
  status VARCHAR(16) NOT NULL DEFAULT 'published',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (author_user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_content_type_created (type, created_at),
  INDEX idx_content_author_created (author_user_id, created_at),
  INDEX idx_content_category (type, category, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 11. 功能六：点赞/收藏/举报/完成（单用户单内容只能有一种状态）
CREATE TABLE IF NOT EXISTS community_interactions (
  id VARCHAR(64) PRIMARY KEY,
  content_id VARCHAR(64) NOT NULL,
  user_id INT NOT NULL,
  type ENUM('like','favorite','report','complete') NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (content_id) REFERENCES community_contents(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uq_interaction_user_content_type (user_id, content_id, type),
  INDEX idx_interaction_content_type (content_id, type, created_at),
  INDEX idx_interaction_user (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 12. 功能六：评论（同一用户可以继续追加评论）
CREATE TABLE IF NOT EXISTS community_comments (
  id VARCHAR(64) PRIMARY KEY,
  content_id VARCHAR(64) NOT NULL,
  user_id INT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (content_id) REFERENCES community_contents(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_comment_content_created (content_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 13. 功能六：杂志书签和用户笔记
CREATE TABLE IF NOT EXISTS community_bookmarks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  content_id VARCHAR(64) NOT NULL,
  user_id INT NOT NULL,
  note TEXT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (content_id) REFERENCES community_contents(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uq_bookmark_user_content (user_id, content_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 14. 功能六：学习积分与徽章
CREATE TABLE IF NOT EXISTS user_achievements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  achievement_key VARCHAR(64) NOT NULL,
  title VARCHAR(64) NOT NULL,
  badge VARCHAR(16) NOT NULL,
  points INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uq_achievement_user_key (user_id, achievement_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. 衣橱（含前端渐变色字段）
-- 注意：user_id 不设 DEFAULT。默认值 1 是「假用户」时代的残留，
--       会让漏传 user_id 的插入静默归到 1 号用户，隔离就又变成演的。
CREATE TABLE IF NOT EXISTS garments (
  id VARCHAR(64) PRIMARY KEY,
  user_id INT NOT NULL,
  name VARCHAR(128) NOT NULL,
  category VARCHAR(32),
  brand VARCHAR(64),
  emoji VARCHAR(8),
  `from` VARCHAR(10) DEFAULT '#ffd1e8',
  `to` VARCHAR(10) DEFAULT '#c9b8ff',
  price INT DEFAULT 0,
  season VARCHAR(32),
  image_url VARCHAR(512),
  fav TINYINT(1) DEFAULT 0,
  primary_color VARCHAR(32) DEFAULT '',
  secondary_colors JSON NULL,
  seasons JSON NULL,
  occasions JSON NULL,
  frequently_worn TINYINT(1) DEFAULT 0,
  sort_order INT DEFAULT 0,
  recognition_status VARCHAR(24) DEFAULT 'confirmed',
  recognition_source VARCHAR(24) DEFAULT 'manual',
  uploaded_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. 搭配方案
CREATE TABLE IF NOT EXISTS outfits (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  title VARCHAR(128),
  scene VARCHAR(32),
  reason TEXT,
  batch_id VARCHAR(64),
  kind VARCHAR(24) DEFAULT 'generated',
  is_saved TINYINT(1) DEFAULT 0,
  is_starred TINYINT(1) DEFAULT 0,
  season VARCHAR(32),
  occasion VARCHAR(32),
  algorithm JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 6. 搭配明细
CREATE TABLE IF NOT EXISTS outfit_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  outfit_id INT NOT NULL,
  garment_id VARCHAR(64) NOT NULL,
  sort_order INT DEFAULT 0,
  FOREIGN KEY (outfit_id) REFERENCES outfits(id) ON DELETE CASCADE,
  FOREIGN KEY (garment_id) REFERENCES garments(id) ON DELETE CASCADE
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 7. 功能二购物车 —— 已删除（2026-08-16 批次 0B）
-- 原 feature2_cart_items 与 cart_items 两套并存、互相看不见，违反规格 §13
-- 「只有一个 cart_items 数据域」。存量已由 migrateCart() 搬进 cart_items 后 DROP。
-- 别把这张表加回来：功能二的购物车走 cart_items 的 item_type='garment'。

-- 8. AI 顾问会话 ★
CREATE TABLE IF NOT EXISTS chat_sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  title VARCHAR(128),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  -- 「历史对话」列表页按 user_id + 时间倒序查
  INDEX idx_user_created (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 9. 聊天消息 ★
-- role 除了 user/assistant，还留了 system/tool：
-- 手写 tool-calling 循环里模型请求工具、工具返回结果也是对话历史的一部分，
-- 现在就把枚举放宽，省得接工具调用时再改表。
CREATE TABLE IF NOT EXISTS chat_messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  session_id INT NOT NULL,
  role ENUM('user','assistant','system','tool') NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE,
  INDEX idx_session_id (session_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 10. AI 调用日志（可观测性）
-- 每次调大模型记一条：用哪个模型、花多久、烧多少 token、成没成功。
-- 有了这张表才敢在面试说「我能说出上周调了多少次、平均延迟、失败率」。
CREATE TABLE IF NOT EXISTS ai_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,                      -- 允许为空：没登录也可能触发 AI（如健康检查）
  scene VARCHAR(32) NOT NULL,            -- style_report / chat / scene_outfits / tool_call
  provider VARCHAR(16),                  -- openai / anthropic
  model VARCHAR(64),
  prompt_tokens INT DEFAULT 0,
  completion_tokens INT DEFAULT 0,
  cache_hit_tokens INT DEFAULT 0,        -- 命中缓存的输入 token（便宜的那部分）
  cache_write_tokens INT DEFAULT 0,      -- 写入缓存的输入 token（略贵，只有部分 provider 报）
  model_calls INT DEFAULT 0,             -- 这一次逻辑调用底下的模型往返次数，tool-calling 会 > 1
  latency_ms INT DEFAULT 0,
  ok TINYINT(1) DEFAULT 1,
  error_msg VARCHAR(512),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_scene_created (scene, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 11. 配饰目录（全局目录，所有用户共享推荐候选）
CREATE TABLE IF NOT EXISTS accessories (
  id VARCHAR(64) PRIMARY KEY,
  category ENUM('jewelry','hat','scarf','belt','shoes') NOT NULL,
  name VARCHAR(128) NOT NULL,
  brand VARCHAR(64),
  price DECIMAL(8,2) NOT NULL,
  original_price DECIMAL(8,2),
  discount_price DECIMAL(8,2),
  image_url VARCHAR(512),
  tryon_slot VARCHAR(32),
  tryon_enabled TINYINT(1) NOT NULL DEFAULT 0,
  primary_color VARCHAR(16),
  secondary_color VARCHAR(16),
  seasons JSON,
  occasions JSON,
  styles JSON,
  keywords JSON,
  taobao_url VARCHAR(1024),
  taokouling VARCHAR(128),
  favorite_count INT NOT NULL DEFAULT 0,
  base_popularity DECIMAL(4,1) NOT NULL DEFAULT 3.5,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_accessory_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 12. 配饰评分（按用户隔离，用户可重新评分）
CREATE TABLE IF NOT EXISTS accessory_ratings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  accessory_id VARCHAR(64) NOT NULL,
  score TINYINT UNSIGNED NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_accessory (user_id, accessory_id),
  CONSTRAINT fk_accessory_rating_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_accessory_rating_accessory
    FOREIGN KEY (accessory_id) REFERENCES accessories(id) ON DELETE CASCADE,
  INDEX idx_accessory_rating_accessory (accessory_id, score)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 13. 场景商城目录（人工维护，供新旧混搭方案选择新品）
CREATE TABLE IF NOT EXISTS scene_catalog (
  id VARCHAR(64) PRIMARY KEY,
  scene_key VARCHAR(32) NOT NULL,
  category VARCHAR(32) NOT NULL,
  name VARCHAR(128) NOT NULL,
  price DECIMAL(8,2) NOT NULL,
  image_url VARCHAR(512),
  taobao_url VARCHAR(1024),
  taokouling VARCHAR(128) NOT NULL,
  season VARCHAR(16),
  keywords JSON,
  `from` VARCHAR(10) DEFAULT '#ffd1e8',
  `to` VARCHAR(10) DEFAULT '#c9b8ff',
  emoji VARCHAR(8) DEFAULT '👗',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_scene_catalog_scene (scene_key),
  INDEX idx_scene_catalog_category (scene_key, category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 14. 场景方案快照（保存为“我的搭配”模板，按用户隔离）
CREATE TABLE IF NOT EXISTS scene_outfits (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  scene_key VARCHAR(32) NOT NULL,
  title VARCHAR(128) NOT NULL,
  season VARCHAR(16),
  mode ENUM('pure','mixed') NOT NULL,
  filter_key VARCHAR(16) NOT NULL,
  weather JSON,
  composition JSON NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_scene_outfit_user_created (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 15. 购物车（规格 §4.5 §13 的唯一购物车数据域）
-- 功能二、三、四共用这张表，三种 item_type 分别指向不同的商品目录：
--   garment   → garments      按 user_id 隔离的旧衣
--   accessory → accessories   全局配饰目录
--   catalog   → scene_catalog 全局场景新品目录
-- 旧的 feature2_cart_items 已由 migrateCart() 搬迁后删除，不再存在。
CREATE TABLE IF NOT EXISTS cart_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  item_type ENUM('garment','accessory','catalog') NOT NULL,
  item_id VARCHAR(64) NOT NULL,
  quantity INT UNSIGNED NOT NULL DEFAULT 1,
  source_outfit_id VARCHAR(64),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_cart_user_item (user_id, item_type, item_id),
  CONSTRAINT fk_cart_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_cart_user (user_id, item_type, item_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 16. 定制服务设计师目录
CREATE TABLE IF NOT EXISTS designers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  designer_key VARCHAR(32) NOT NULL UNIQUE,
  name VARCHAR(64) NOT NULL,
  avatar_url VARCHAR(512),
  specialty VARCHAR(128),
  bio VARCHAR(512),
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 17. 定制咨询
CREATE TABLE IF NOT EXISTS custom_inquiries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  service_type VARCHAR(32) NOT NULL,
  requirements TEXT NOT NULL,
  budget VARCHAR(64),
  size_notes VARCHAR(512),
  reference_images JSON,
  status ENUM('submitted','contacted') NOT NULL DEFAULT 'submitted',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_custom_inquiry_user (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 18. 预约量体记录
CREATE TABLE IF NOT EXISTS custom_measurements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  service_type VARCHAR(32) NOT NULL,
  height DECIMAL(5,1) NOT NULL,
  weight DECIMAL(5,1) NOT NULL,
  bust DECIMAL(5,1) NOT NULL,
  waist DECIMAL(5,1) NOT NULL,
  hips DECIMAL(5,1) NOT NULL,
  shoulder DECIMAL(5,1) NOT NULL,
  front_image VARCHAR(512) NOT NULL,
  side_image VARCHAR(512) NOT NULL,
  back_image VARCHAR(512),
  detail_images JSON,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_custom_measurement_user (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 19. 定制申请与进度
CREATE TABLE IF NOT EXISTS custom_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  service_type VARCHAR(32) NOT NULL,
  source ENUM('inquiry','measurement') NOT NULL DEFAULT 'inquiry',
  requirements JSON,
  reference_images JSON,
  measurement_id INT NULL,
  status ENUM('submitted','design','sample','production','shipped') NOT NULL DEFAULT 'submitted',
  designer_id INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (measurement_id) REFERENCES custom_measurements(id) ON DELETE SET NULL,
  FOREIGN KEY (designer_id) REFERENCES designers(id) ON DELETE SET NULL,
  INDEX idx_custom_request_user (user_id, status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 20. 设计师一对一 IM
CREATE TABLE IF NOT EXISTS custom_messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  request_id INT NOT NULL,
  user_id INT NOT NULL,
  sender ENUM('user','designer','system') NOT NULL,
  designer_id INT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (request_id) REFERENCES custom_requests(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (designer_id) REFERENCES designers(id) ON DELETE SET NULL,
  INDEX idx_custom_message_request (request_id, created_at),
  INDEX idx_custom_message_user (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 21. 穿搭日记（规格 §11.1）
-- 「按日期记录 + 回看」：一天一条，所以 (user_id, wear_date) 上有唯一键 ——
-- 前端的保存动作是 upsert（PUT /api/diary/:date），靠这个唯一键做冲突判定，
-- 别改成普通索引，否则同一天连点两次保存会留下两条。
--
-- outfit_id 允许为空：只写一句「今天穿了牛仔外套」也是一条合法记录，
-- 不能逼用户先去存一套搭配才让他记日记。
-- 关联的搭配被删除时置空而不是级联删除 —— 删搭配不该把当天的日记一起删掉。
CREATE TABLE IF NOT EXISTS outfit_diary (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  wear_date DATE NOT NULL,
  outfit_id INT NULL,
  note VARCHAR(255) NULL,
  weather VARCHAR(32) NULL,
  mood VARCHAR(32) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (outfit_id) REFERENCES outfits(id) ON DELETE SET NULL,
  UNIQUE KEY uq_diary_user_date (user_id, wear_date),
  INDEX idx_diary_user_date (user_id, wear_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 22. AI 异步任务（阿里百炼 / DashScope）
-- 表名不叫 tryon_tasks：试衣、换脸、场景生成走的是同一套异步协议
-- （提交拿 task_id → 轮询 → 取图），只有 capability 和 model 不同。
-- 一张表装下所有能力，加新能力时不用再建表、不用改仓库层。
--
-- 为什么要落库而不是把 task_id 丢给前端自己存：
-- 1. 百炼的 task_id 只保 24 小时，过期后查不到结果，得靠自己留一份出图 URL；
-- 2. 「我的试衣记录」这类回看需要按用户查历史；
-- 3. 轮询接口要能校验这个 task_id 是不是当前用户的，否则拿到别人的 id 就能看别人的图。
--
-- image_url 单独拎出来做列（而不是只留在 result JSON 里）：列表页要按「有没有出图」
-- 筛选和展示，JSON 里取值没法走索引也没法在 SQL 里判空。
CREATE TABLE IF NOT EXISTS ai_tasks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  capability VARCHAR(32) NOT NULL,
  provider VARCHAR(32) NOT NULL DEFAULT 'bailian',
  model VARCHAR(64) NOT NULL,
  task_id VARCHAR(128) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
  input JSON NULL,
  result JSON NULL,
  image_url VARCHAR(1024) NULL,
  error_message VARCHAR(512) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uq_ai_task_id (task_id),
  INDEX idx_ai_task_user (user_id, capability, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 27. 收货地址（演示结算页）
--
-- 为什么不用 wx.chooseAddress：那个接口要求小程序通过特定服务类目的认证，
-- demo 号拿不到，调用直接返回 fail。所以地址只能自己录。
--
-- 这一版**没有**省市区三级字段：标准数据源是 modood/Administrative-divisions-of-China，
-- 三级 JSON 有 200–700KB，而主包体积已经超标。等分包方案定了再补 province/city/district 三列，
-- detail 这一列的语义（完整地址文本）届时不受影响。
CREATE TABLE IF NOT EXISTS shop_addresses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  receiver VARCHAR(32) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  detail VARCHAR(255) NOT NULL,
  is_default TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_shop_address_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_shop_address_user (user_id, is_default, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 28. 演示订单
--
-- 只演示「下单」这一步：没有支付、没有物流、没有退款。status 走
-- created → paid → shipped → done 四态，由演示按钮手动推进，不是真实状态机。
--
-- 金额三列全部落库而不是每次重算：优惠券规则以后会改，改完再回头算历史订单
-- 会算出和用户当时看到的不一样的数字。订单是「当时这笔账」的快照。
-- 单位是分，避免 DECIMAL 之外再引入浮点误差。
CREATE TABLE IF NOT EXISTS shop_orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  order_no VARCHAR(32) NOT NULL,
  status ENUM('created','paid','shipped','done','cancelled') NOT NULL DEFAULT 'created',
  receiver VARCHAR(32) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  address_detail VARCHAR(255) NOT NULL,
  coupon_key VARCHAR(32) NULL,
  coupon_label VARCHAR(64) NULL,
  goods_amount INT NOT NULL DEFAULT 0,
  discount_amount INT NOT NULL DEFAULT 0,
  pay_amount INT NOT NULL DEFAULT 0,
  remark VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_shop_order_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uq_shop_order_no (order_no),
  INDEX idx_shop_order_user (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 29. 订单明细
--
-- 商品名 / 单价 / 图都冗余存一份，不做外键回查：cart_items 的三种来源里
-- garment 是按用户隔离的旧衣、catalog 和 accessory 是会下架的目录，
-- 回查等于「商品下架后历史订单变空白」。订单行是成交那一刻的快照。
CREATE TABLE IF NOT EXISTS shop_order_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  item_type ENUM('garment','accessory','catalog') NOT NULL,
  item_id VARCHAR(64) NOT NULL,
  name VARCHAR(128) NOT NULL,
  image_url VARCHAR(512) NULL,
  unit_price INT NOT NULL DEFAULT 0,
  quantity INT UNSIGNED NOT NULL DEFAULT 1,
  CONSTRAINT fk_shop_order_item_order
    FOREIGN KEY (order_id) REFERENCES shop_orders(id) ON DELETE CASCADE,
  INDEX idx_shop_order_item_order (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
