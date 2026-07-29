# 部署上线指南

## 架构总览

```
用户 → 微信小程序 (uni-app) ──→ Nginx (HTTPS) ──→ Node.js (Express, port 8787)
                            ──→ FastAPI  (可选, port 8788)
                                                 ├── MySQL (3306)
                                                 └── SQLite (开发默认)
```

## 一、后端部署（阿里云轻量 / 腾讯云）

### 1. 环境准备

```bash
# 安装 Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 安装 MySQL
sudo apt-get install -y mysql-server
sudo mysql_secure_installation

# 或者用 Docker
docker run -d -p 3306:3306 \
  -e MYSQL_ROOT_PASSWORD=yourpassword \
  -e MYSQL_DATABASE=lingxi \
  --name lingxi-mysql mysql:8
```

### 2. 数据库初始化

```bash
mysql -u root -p < server/schema.sql
```

### 3. 配置环境变量

```bash
# 生产 .env
cp .env .env.production
# 编辑 .env.production:
#   DB_TYPE=mysql
#   MYSQL_HOST=localhost
#   MYSQL_PASSWORD=yourpassword
#   JWT_SECRET=随机生成的长字符串
#   AI_API_KEY=你的真实key
```

### 4. 启动后端

```bash
# 安装 PM2
npm install -g pm2

# 启动 Node 后端
pm2 start server/index.mjs --name "lingxi-api" \
  --node-args="--experimental-sqlite" \
  --env-file .env.production

# 可选：启动 Python AI 层
cd ai-server && pm2 start "venv/bin/uvicorn main:app --host 0.0.0.0 --port 8788" --name "lingxi-ai"

pm2 save && pm2 startup
```

### 5. Nginx 反向代理 + HTTPS

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    location /api/ {
        proxy_pass http://127.0.0.1:8787;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # SSE 支持
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 300s;
    }

    location / {
        root /var/www/lingxi-h5;
        try_files $uri $uri/ /index.html;
    }
}
```

HTTPS 证书（Let's Encrypt 免费）：
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

## 二、小程序上线

### 1. 编译生产包

```bash
cd miniapp
npm run build:mp-weixin
```

### 2. 微信开发者工具操作

1. 打开微信开发者工具 → 导入 `miniapp/dist/build/mp-weixin`
2. 填入 AppID（在 mp.weixin.qq.com 注册获取）
3. 在「开发管理 → 开发设置」配置：
   - 服务器域名：`https://your-domain.com`（request/upload/download）
   - 业务域名：`https://your-domain.com`
4. 点击「上传」提交代码
5. 在微信公众平台 → 版本管理 → 提交审核
6. 审核通过后点击「发布」

### 3. 注意事项

- 个人主体小程序仅支持部分类目
- 所有请求域名必须是 HTTPS
- 图片/文件资源建议上传到云存储（OSS/COS）

## 三、H5 前端部署

```bash
# 构建 H5
cd miniapp
npm run build:h5

# 部署到 Nginx
scp -r dist/build/h5/* user@server:/var/www/lingxi-h5/
```

## 四、管理后台部署

```bash
cd admin
npm run build
scp -r dist/* user@server:/var/www/lingxi-admin/
```

Nginx 配置中添加：
```nginx
server {
    listen 443 ssl;
    server_name admin.your-domain.com;
    root /var/www/lingxi-admin;
    # ... SSL 配置同上
    location / { try_files $uri $uri/ /index.html; }
}
```

## 五、快速检查清单

- [ ] 服务器防火墙开放 80/443 端口
- [ ] MySQL 已初始化 schema.sql
- [ ] .env.production 已配置真实密钥
- [ ] PM2 进程正常运行 (`pm2 status`)
- [ ] Nginx HTTPS 证书有效 (`certbot certificates`)
- [ ] 小程序后台已配置合法域名
- [ ] 真机扫码测试通过

## 六、监控 & 日志

```bash
# PM2 日志
pm2 logs lingxi-api

# Nginx 日志
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```
