# 微信云托管镜像。
#
# 构建上下文 = deploy/pack-cloudrun.mjs 打出来的 zip 根目录，布局是：
#   Dockerfile
#   package.json / package-lock.json   ← 根清单，server 是它的 workspace
#   server/                            ← 后端代码
#   images/                            ← 139 张演示图，Express 挂在 /images
#
# 这个布局不是随便定的：server/index.mjs 里 imagesDir 找的是 <server 的上一级>/images，
# 所以 server 和 images 必须是同级目录。

# 基础镜像抽成 ARG，是为了「换镜像源只改这一行」。
#
# 构建期一共只剩一个外网依赖，就是拉这个基础镜像（原来还有一个，见下面 TZ 那段）。
# 云托管构建集群拉 Docker Hub 会偶发超时/限流，症状是构建几十秒内就 fail、
# 构建日志里根本没有 `Step 1/N`，只有 `failed to solve` / `i/o timeout` /
# `pull access denied` 之类一行。真是这条挂了，就把默认值换成：
#
#   mirror.ccs.tencentyun.com/library/node:20-alpine
#
# 那是腾讯云的 Docker Hub 镜像源，只在腾讯云网内可达（云托管跑在腾讯云上，
# 所以它那边通、你本机不通）。换成它之后本机就没法 docker build 验证了，
# 本机验证请把默认值改回 node:20-alpine。
ARG NODE_IMAGE=node:20-alpine
FROM ${NODE_IMAGE}

# 容器默认 UTC。订单时间、日志时间会整整差 8 小时，演示时很容易被当成 bug。
#
# 这里刻意【不装 tzdata】。node:20-alpine 里连 /usr/share/zoneinfo 和 /etc/localtime
# 都没有，但 Node 20 自带 full-icu，本地时间取的是 ICU 的时区库而不是系统 zoneinfo，
# 光给 TZ 就够了。实测（2026-08-18，node:20-alpine 未装 tzdata）：
#   new Date().toString()          → ... GMT+0800 (China Standard Time)
#   new Date().getTimezoneOffset() → -480
# 装 tzdata 要在构建期访问 dl-cdn.alpinelinux.org，凭空多一个能让构建挂掉的外网依赖，
# 换来的东西 Node 根本不用。
ENV TZ=Asia/Shanghai

WORKDIR /app

# 先只拷依赖清单再装，改业务代码时这一层能命中缓存，重新部署会快很多。
# 根 package.json 里 server 是 workspace，所以两个 package.json 都得先到位。
COPY package.json package-lock.json ./
COPY server/package.json ./server/package.json
# --omit=dev 顺带把根目录的 playwright（几百 MB）挡在外面
RUN npm ci --omit=dev --ignore-scripts

COPY server ./server
COPY images ./images

WORKDIR /app/server

# 云托管默认按 80 端口探活，并且会把 PORT 注入进来。
# server/index.mjs 里已经是 Number(process.env.PORT || 8787)，无需改代码。
ENV PORT=80
EXPOSE 80

# 不能写成 npm start —— 那个脚本带 --env-file=.env，而容器里没有 .env 文件，
# node 会直接报 ENOENT 退出。容器的环境变量由云托管控制台注入。
CMD ["node", "index.mjs"]
