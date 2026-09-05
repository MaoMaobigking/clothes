# 微信开发者工具打开指南

> ⚠️ **两套产物目录，别混用。**
>
> | 命令 | 产物目录 |
> | --- | --- |
> | `npm run dev:mp-weixin` | `miniapp/dist/dev/mp-weixin/` |
> | `npm run build:mp-weixin` | `miniapp/dist/build/mp-weixin/` |
>
> 微信开发者工具打开哪个目录，就只读那个目录的代码。跑 dev 命令却把工具开在 build 目录（或反过来），表现是**「改了代码模拟器毫无反应」，而且不报任何错**——曾经因此白改了 4 天。
>
> 根目录 `project.config.json` 的 `miniprogramRoot` 指向 **build**，所以「用工具打开仓库根目录」等于走 build 流程。要走 dev 热更新，必须让工具直接打开 `miniapp/dist/dev/mp-weixin`。
>
> 想知道工具当前开在哪个目录：看哪个产物目录里有工具自己写的 `project.private.config.json`。
>
> 另外注意 `dev:mp-weixin` / `build:mp-weixin` 这些脚本在 `miniapp/package.json` 里，**根目录直接敲会报 `Missing script`**。根目录有对应的转发脚本：`npm run mp:dev` / `npm run mp:build`。

## 前置条件

1. 安装 [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
2. 注册微信小程序账号（个人主体即可），获取 AppID

## 步骤

### 1. 编译小程序代码

```bash
cd miniapp
npm run build:mp-weixin    # 或在根目录：npm run mp:build
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

### 4. 开发模式（热更新，日常迭代走这条）

```bash
cd miniapp
npm run dev:mp-weixin      # 或在根目录：npm run mp:dev
```

这条命令会**常驻 watch，终端不要关**。首次编译约 15 秒，看到 `DONE Build complete. Watching for changes...` 即成功（uv-ui 会刷一批 Sass `@import` / `variable-exists` 弃用警告，是依赖自身的问题，不影响编译）。

然后：

1. 微信开发者工具打开 `miniapp/dist/dev/mp-weixin` —— **是 dev，不是 build**
2. 工具「设置 → 通用 → 文件保存时自动编译」勾上
3. 改 `miniapp/src/` 下的文件 → 终端自动重编译 → 模拟器自动刷新

产物是编译生成的 wxml / wxss / js，**不要在开发者工具里直接改产物**：下次编译就被覆盖，而且改动无法回流到源码。源码只有 `miniapp/src/`，开发者工具在这套流程里只负责跑模拟器、看调试器、生成预览二维码和上传。

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
