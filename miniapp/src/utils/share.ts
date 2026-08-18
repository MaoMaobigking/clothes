/*
 * 分享相关的两件小事：复制文案 + 「怎么发朋友圈」的说明。
 *
 * ── 为什么要有这个文件 ──
 * 微信小程序**没有**发朋友圈的 API：onShareAppMessage 只能转发给好友 / 群，
 * onShareTimeline（分享到朋友圈）是「单页模式」的一张卡片，不是真的发一条朋友圈，
 * 而且 H5 端连这个都没有。所以「一键发朋友圈」在任何实现下都做不到 ——
 * 唯一可行的路径是「保存图片到相册 → 用户自己去朋友圈发」。
 *
 * 这个限制以前在界面上一个字都没写（全仓搜「朋友圈」零命中），
 * 用户点完「保存图片」不知道下一步该干嘛，验收时也解释不清。
 * 所以把说明抽成常量，三处保存入口共用一份，别各写各的措辞。
 *
 * copyText 是从 pages/scene 挪上来的原封装：三个页面各写一遍 setClipboardData
 * 没有意义，H5 端 uni 内部还要走 execCommand 兜底，只该有一处。
 */

/** 保存图片后怎么发朋友圈。文案统一，改一处三处都变。 */
export const MOMENT_HINT = '小程序不能直接发朋友圈：保存图片后，去微信朋友圈选这张图发布'

/** 试衣结果这类「图在服务器上、要长按存」的场景，措辞略有不同 */
export const MOMENT_HINT_PREVIEW = '点图放大后长按保存，再去微信朋友圈发布'

/**
 * 复制到剪贴板。
 * uni 在 H5 端会自动降级到 execCommand，两端都不用自己判平台。
 */
export function copyText(text: string, successMessage = '已复制') {
  const data = String(text || '').trim()
  if (!data) {
    uni.showToast({ title: '没有可复制的内容', icon: 'none' })
    return
  }
  uni.setClipboardData({
    data,
    success: () => uni.showToast({ title: successMessage, icon: 'none' }),
    fail: () => uni.showToast({ title: '复制失败，请手动选中', icon: 'none' }),
  })
}
