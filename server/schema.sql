-- AI 服装 · MySQL 数据库建表脚本
-- 使用方法：docker exec -i mysql_container mysql -uroot -p<密码> lingxi < schema.sql
-- 或在 MySQL 客户端中执行 source schema.sql

CREATE DATABASE IF NOT EXISTS lingxi CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE lingxi;

-- 1. 用户表
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  openid VARCHAR(64) UNIQUE,
  nickname VARCHAR(64),
  avatar_url VARCHAR(512),
  role VARCHAR(32) NOT NULL DEFAULT 'user',
  membership_level VARCHAR(32) NOT NULL DEFAULT 'standard',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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

-- 7. 功能二购物车（独立表，避免与其他模块共用表结构）
CREATE TABLE IF NOT EXISTS feature2_cart_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  source_outfit_id INT NULL,
  garment_id VARCHAR(64) NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (source_outfit_id) REFERENCES outfits(id) ON DELETE SET NULL,
  FOREIGN KEY (garment_id) REFERENCES garments(id) ON DELETE CASCADE,
  INDEX idx_feature2_cart_user (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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

-- 15. 购物车（配饰、衣橱与场景新品统一入口）
-- 功能三和功能四共用这张表；item_type 后续可按业务扩展。
CREATE TABLE IF NOT EXISTS cart_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  item_type ENUM('garment','accessory') NOT NULL,
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
