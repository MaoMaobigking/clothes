<script>
/*
 * 启动守卫（规格 §5）。
 *
 * 请求层已经不再自动建号，所以启动时没有 token 就必须先去登录页，
 * 否则首页一挂载就是一串 401。
 *
 * 跳转统一走 redirectToLogin()：小程序 onLaunch 阶段首页还没创建完，
 * 在那时候直接 reLaunch 会被吞掉、整屏白屏，redirectToLogin 里等页面栈就绪再跳。
 *
 * 有 token 也只是「本地有」——服务重启换了 JWT 密钥、或者库被重置过，
 * token 就成了空壳。这里异步验一次；验不过时请求层的 401 拦截会把人送回登录页。
 */
import { fetchMe } from '@/api/auth'
import { getToken, redirectToLogin } from '@/api/http'

export default {
  onLaunch() {
    // 底部导航用的是自定义 BottomNav，原生 tab 栏只留 pages.json 里的声明供
    // switchTab 路由用，栏本身要藏掉，否则屏幕底部会出现两条（详见 BottomNav.vue）
    setTimeout(() => uni.hideTabBar({ animation: false, fail: () => {} }), 0)

    if (!getToken()) {
      redirectToLogin()
      return
    }
    fetchMe().catch(() => {
      // 401 由 request() 统一清 token 并跳登录页，这里不重复跳，避免和它抢路由
    })
  },
  onShow() {},
  onHide() {},
}
</script>

<style>
/* ============ 全局主题（用 CSS 变量，H5 与微信小程序都支持） ============ */
page {
  /* 背景渐变 */
  --bg-gradient: linear-gradient(170deg, #ffe6f2 0%, #f0e4ff 45%, #e3ecff 100%);
  /* 主色 */
  --pink: #ff7eb3;
  --pink-deep: #ff5c9d;
  --purple: #b892ff;
  --purple-deep: #9a6bff;
  --mint: #a9dcd6;
  --mint-deep: #7fc9c1;
  --brand-gradient: linear-gradient(135deg, #ff8fc0 0%, #b18cff 100%);
  /* 文字 */
  --text-1: #2f2a3d;
  --text-2: #6b6580;
  --text-3: #a8a2ba;
  --text-on-brand: #ffffff;
  /* 面 */
  --surface: #ffffff;
  --surface-soft: rgba(255, 255, 255, 0.72);
  --line: #efe9f6;
  /* 圆角（rpx） */
  --radius-sm: 24rpx;
  --radius: 36rpx;
  --radius-lg: 48rpx;
  --radius-pill: 9999rpx;
  /* 阴影 */
  --shadow-card: 0 8rpx 24rpx rgba(150, 120, 200, 0.14);
  --shadow-float: 0 12rpx 32rpx rgba(150, 120, 200, 0.22);

  background: var(--bg-gradient);
  min-height: 100%;
  font-family: -apple-system, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
  color: var(--text-1);
}

view,
text,
button,
input,
textarea,
scroll-view {
  box-sizing: border-box;
}

/* 通用胶囊按钮（用 view 承载，避免小程序 button 默认样式） */
.btn {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 96rpx;
  padding: 0 48rpx;
  border-radius: var(--radius-pill);
  font-size: 32rpx;
  font-weight: 600;
}
.btn-primary {
  background: var(--brand-gradient);
  color: var(--text-on-brand);
  box-shadow: 0 16rpx 40rpx rgba(177, 140, 255, 0.4);
}
.btn-ghost {
  background: var(--surface);
  color: var(--text-2);
  box-shadow: var(--shadow-card);
}
.btn-disabled {
  background: #e6e0ef;
  color: #b7b0c6;
  box-shadow: none;
}
</style>
