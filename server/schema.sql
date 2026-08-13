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
  role VARCHAR(16) NOT NULL DEFAULT 'user',
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
  FOREIGN KEY (garment_id) REFERENCES garments(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 7. AI 顾问会话 ★
CREATE TABLE IF NOT EXISTS chat_sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  title VARCHAR(128),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  -- 「历史对话」列表页按 user_id + 时间倒序查
  INDEX idx_user_created (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 8. 聊天消息 ★
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

-- 9. AI 调用日志（可观测性）
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
