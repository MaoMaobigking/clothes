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
  FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. 衣橱（含前端渐变色字段）
CREATE TABLE IF NOT EXISTS garments (
  id VARCHAR(64) PRIMARY KEY,
  user_id INT NOT NULL DEFAULT 1,
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
  FOREIGN KEY (user_id) REFERENCES users(id),
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
  FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 8. 聊天消息 ★
CREATE TABLE IF NOT EXISTS chat_messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  session_id INT NOT NULL,
  role ENUM('user','assistant') NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE,
  INDEX idx_session_id (session_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
