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
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. 身形档案
CREATE TABLE IF NOT EXISTS body_profiles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  skin VARCHAR(32),
  face VARCHAR(32),
  body_type VARCHAR(32),
  height DECIMAL(5,1),
  weight DECIMAL(5,1),
  bmi DECIMAL(4,1),
  bust DECIMAL(5,1),
  waist DECIMAL(5,1),
  thigh DECIMAL(5,1),
  calf DECIMAL(5,1),
  preferences JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
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
