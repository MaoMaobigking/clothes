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
/*
 * 全局样式只在这里汇总，具体内容拆到 styles/ 下三个文件：
 *   tokens.css      设计变量（颜色 / 圆角 / 阴影 / 间距 / 层级）—— 改主题就改这个
 *   base.css        页面骨架 .page / .body、滚动、横滑
 *   components.css  通用类 .card / .chip / .empty / .mask / .sheet / .toast …
 *
 * 页面的 scoped style 里只写「这一页独有」的东西；
 * 凡是别处也会用到的，提到 components.css，别复制。
 */
@import './styles/tokens.css';
@import './styles/base.css';
@import './styles/components.css';
</style>
