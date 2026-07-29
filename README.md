# AI 服装 · 智能穿搭 App（前端 Demo）

一个手机端的 AI 穿搭应用原型，覆盖 9 张设计稿的全部功能：个性化创建、身形测试、自由搭配、情景模拟、衣橱、商城、时尚杂志、时尚社群、我的。

技术栈：**Vite + Vue3 + TypeScript + Pinia + Vue Router + ECharts**，样式全手写（粉紫少女风）。所有"图片"用 `TileImage` 占位组件，放入真实图后自动切换。

---

## 一、怎么跑起来

```bash
npm install      # 第一次装依赖
npm run dev      # 启动，自动打开浏览器
```

打开后按 **F12 → 左上角"手机"图标**切到手机模式，或把窗口拉窄，效果最接近设计稿。

其他命令：`npm run build`（打包+类型检查）、`npm run type-check`、`npm run preview`。

## 二、怎么放真实图片（关键）

1. 打开根目录 **[IMAGE-MANIFEST.md](./IMAGE-MANIFEST.md)** —— 里面列清了每张图的**文件名、放哪个文件夹、内容、建议尺寸**。
2. 按清单把图片丢进 `public/images/` 对应子文件夹（文件名要一致）。
3. 刷新页面即可看到，**丢一张显示一张**；没放的图自动显示占位（渐变+emoji），不影响运行。

## 三、页面 & 路由

| 路由 | 页面 | 对应设计稿 | 底部导航 |
|---|---|---|---|
| `/home` | 首页 | 品牌落地页 | ✓ 首页 |
| `/ai` | AI 工作流 | Ai 入口聚合 | ✓ Ai |
| `/closet` | 我的衣橱 | 图③ | ✓ 衣橱 |
| `/mall` | 商城 | 图⑥ 耳饰 | ✓ 商城 |
| `/me` | 我的 | 个人中心 | ✓ 我的 |
| `/create` | 个性化创建 | 图② | 二级页 |
| `/test` | 身形测试（5 步向导） | 功能一 | 二级页 |
| `/result` | 风格报告（雷达图+形象） | 功能一 | 二级页 |
| `/free-match` | 自由搭配 | 图④ | 二级页 |
| `/scene` | 情景模拟（虚拟试穿/AI推荐） | 图⑤⑦ | 二级页 |
| `/magazine` | 时尚杂志 | 图⑧ | 二级页 |
| `/community` | 时尚社群 | 图⑨ | 二级页 |

## 四、目录结构

```
public/images/            ← 真实图片放这里（见 IMAGE-MANIFEST.md）
src/
├─ data/
│  ├─ mock.ts             ← 全站数据（每条都带 img 路径）
│  └─ questions.ts        ← 5 步测试的题目/选项
├─ stores/                ← Pinia：profile(画像) / wardrobe(衣橱) / cart(购物车)
├─ types/                 ← 类型定义
├─ components/            ← 共享组件
│  ├─ TileImage.vue        图片占位（支持 :src 真实图 + 缺图回退）
│  ├─ ProductCard.vue      商品/衣物卡
│  ├─ PageHeader.vue       二级页顶栏
│  ├─ SegTabs.vue          分段切换
│  ├─ SectionTitle.vue     小节标题
│  ├─ BottomNav.vue        底部 5 tab
│  ├─ AvatarViewer.vue     可旋转 3D 形象占位
│  ├─ RadarChart.vue       ECharts 雷达图
│  ├─ AppHeader / StepIndicator / StepShell / StepFooter / OptionCard / AiRecommendModal
├─ steps/                 ← 身形测试 5 步（风格/肤色/脸型/体型/偏好）
└─ views/                 ← 页面（见上表）
   ├─ create/  free/  scene/  mall/   ← 各页专属子组件
```

## 五、说明

- **参考文档**：[MOCKUP-SPEC.md](./MOCKUP-SPEC.md)（9 张图逐页结构规格）、[DESIGN_SPEC.md](./DESIGN_SPEC.md)（组件/规范）。
- **虚拟形象**：个性化创建/结果页用可旋转的矢量占位；拿到真 3D 模型（.glb）后只需替换 `AvatarViewer.vue` 内部。
- **雷达图分数**：结果页 5 维分值是示意算法（`stores/profile.ts` 的 `radar`），接真实 AI 画像接口后替换即可。
- **交互都是前端 mock**：一键购买/保存/换脸等按钮目前是轻提示，等接后端。
