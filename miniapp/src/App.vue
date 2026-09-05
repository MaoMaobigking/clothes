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
 *
 * 另外挂了三个「白屏自曝」钩子（onError / onPageNotFound / onUnhandledRejection）。
 * 小程序启动阶段一旦抛错，模拟器就是一整块白，Console 里那行红字还经常被后续日志顶掉，
 * 排查只能靠猜。这三个钩子把错误直接弹到屏幕上，白屏至少变成「白屏 + 一句话原因」。
 */
import { fetchMe } from '@/api/auth'
import { getToken, redirectToLogin } from '@/utils/request'

// 同一条错误只弹一次，否则渲染循环里抛错会把弹窗刷爆
const reported = new Set()

function reportFatal(kind, detail) {
  const text = String(
    detail && typeof detail === 'object' ? detail.stack || detail.message || JSON.stringify(detail) : detail,
  ).slice(0, 400)
  const key = `${kind}:${text}`
  if (reported.has(key)) return
  reported.add(key)

  console.error(`[启动失败] ${kind}`, detail)
  // onLaunch 阶段还没有页面，showModal 会被丢掉，推到下一个 tick
  setTimeout(() => {
    uni.showModal({
      title: `启动失败 · ${kind}`,
      content: text || '(没有错误信息)',
      showCancel: false,
      confirmText: '知道了',
      fail: () => {},
    })
  }, 300)
}

export default {
  onLaunch() {
    /*
     * 这里曾经有一句 setTimeout(() => uni.hideTabBar(...), 0)。
     *
     * 删掉了，因为它是白屏的根因：onLaunch 阶段页面栈还是空的，
     * 此时调 hideTabBar，基础库内部分发回调时拿到 undefined，抛
     *   TypeError: Cannot read property 'errMsg' of undefined
     *     at H (WAServiceMainContext.js)
     * 这是 appServiceSDKScriptError，整个 appService 脚本挂掉 → 全屏白。
     * 传了 fail 也没用 —— 异常发生在基础库自己的回调分发里，轮不到 fail。
     *
     * 而且它本来就是多余的：5 个 tab 页全都渲染 BottomNav，
     * 那个组件 onMounted 就会藏原生栏，switchTab 之后还会再藏一次
     * （见 components/BottomNav/BottomNav.vue）。
     */
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

  // 小程序运行时抛出的未捕获异常（含各页面 setup / 渲染阶段）
  onError(err) {
    reportFatal('JS 异常', err)
  },

  // reLaunch/navigateTo 到了一个不在 pages.json 里的路径 —— 典型白屏成因
  onPageNotFound(res) {
    reportFatal('页面不存在', `${res?.path || '(未知路径)'}\n检查它在不在 pages.json 的 pages 列表里`)
  },

  onUnhandledRejection(res) {
    reportFatal('未处理的 Promise', res?.reason)
  },
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
