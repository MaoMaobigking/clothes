# 微信开发者工具打开指南

## 前置条件

1. 安装 [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
2. 注册微信小程序账号（个人主体即可），获取 AppID

## 步骤

### 1. 编译小程序代码

```bash
cd miniapp
npm run build:mp-weixin
```

编译产物在 `miniapp/dist/build/mp-weixin/`。

### 2. 打开微信开发者工具

1. 启动微信开发者工具，扫码登录
2. 点击「导入项目」
3. 项目目录选择二选一：
   - 直接打开仓库根目录：`e:\ai服装`（已配置 `miniprogramRoot`）
   - 或打开编译产物：`e:\ai服装\miniapp\dist\build\mp-weixin`
4. AppID 填入你的小程序 AppID（或选择「测试号」）
5. 点击「导入」

### 3. 预览 & 调试

- 点击工具栏「预览」生成二维码，手机扫码即可真机预览
- 模拟器可切换不同机型测试适配效果
- 「调试器」面板可查看 console / network / storage

### 4. 开发模式（热更新）

```bash
cd miniapp
npm run dev:mp-weixin
```

然后在微信开发者工具中打开 `miniapp/dist/dev/mp-weixin`，修改代码后自动编译。

## H5 模式（浏览器调试）

如果暂时没有微信开发者工具，可以先用 H5 模式在浏览器中调试：

```bash
cd miniapp
npm run dev:h5
```

浏览器打开 `http://localhost:5173` 即可预览。

## 后端联调

后端使用共享的 `server/` 目录（Express + SQLite），无需额外配置：

```bash
# 在项目根目录
npm run dev:all
```

前端 H5 的 `/api/*` 请求通过 Vite 代理转发到 `localhost:8787`。
小程序模式下需配置合法域名（上线前）。

## 注意事项

1. **图片路径**：uni-app 的图片放在 `miniapp/src/static/images/` 下，编译后自动拷贝到 `dist/` 对应目录
2. **AppID**：`manifest.json` 中需填入真实 AppID 才能使用微信登录等功能
3. **合法域名**：小程序正式版要求所有请求域名在后台配置为 HTTPS，开发阶段可在「详情→本地设置」中勾选「不校验合法域名」
4. **RadarChart**：H5 使用 ECharts，小程序使用 Canvas 2D 手绘（简化版）
5. **AvatarViewer**：简化为静态 TileImage 占位，Three.js 不支持小程序
