<script setup lang="ts">
/*
 * 搭配海报导出（规格 §8.9「生成当前搭配海报，支持保存图片」、
 * §10.10「海报包含真实搭配、场景背景和滤镜」）。
 *
 * 以前这里只有一句 toast「请长按分享卡片保存」，实际上什么都没生成。
 * 现在用 canvas 真画一张：场景底图 + 当前滤镜 + 真实衣物照片网格 + 日期 + 水印，
 * 再按端分流保存 —— 小程序走相册，H5 走浏览器下载，失败都有明确提示。
 *
 * 功能二不传 background / overlay 就是原来的品牌渐变底；
 * 功能四把场景底图和滤镜传进来，海报里就有场景和滤镜（§10.9 导出保留当前滤镜）。
 *
 * 用的是 uni 的旧版 canvas API（createCanvasContext + draw + canvasToTempFilePath），
 * 因为 type="2d" 在 H5 端和小程序端行为不一致，旧版两端都能跑。
 */
import { computed, getCurrentInstance, ref, watch } from 'vue'
import type { OutfitPiece } from '@/utils/outfitPieces'

const props = withDefaults(
  defineProps<{
    title: string
    pieces: OutfitPiece[]
    subtitle?: string
    /** 页脚左侧文字，一般是日期 */
    footnote?: string
    /** 场景底图（功能四）。画不出来就退回 gradient，不让整张海报失败 */
    background?: string
    /** 底色渐变，两个 hex */
    gradient?: [string, string]
    /** 滤镜遮罩，两段 rgba，和页面上的 stage-filter 同一组值 */
    overlay?: [string, string] | null
    /** 文件名，H5 下载用 */
    fileName?: string
  }>(),
  {
    subtitle: '',
    footnote: '',
    background: '',
    gradient: () => ['#fff1f7', '#ece2ff'],
    overlay: null,
    fileName: '',
  },
)

const CANVAS_ID = 'outfit-poster-canvas'
/** 画布逻辑尺寸（CSS px）。导出时按 2 倍输出，保证清晰度。 */
const W = 300
const H = 430
const PAD = 20
const COLS = 3
const GAP = 10
const MAX_ITEMS = 6

const instance = getCurrentInstance()
const drawing = ref(false)
const saving = ref(false)
const drawError = ref('')

function toast(title: string, icon: 'none' | 'success' = 'none') {
  uni.showToast({ title, icon })
}

/** 按字符数粗暴截断：measureText 在小程序端不够可靠，宁可保守 */
function ellipsis(text: string, max: number) {
  const value = text || ''
  return value.length > max ? `${value.slice(0, max)}…` : value
}

function today() {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`
}

/**
 * 底色偏暗就用浅色字。
 * 夜晚滤镜的底是 #17182b，再用原来的深灰字等于什么都看不见。
 */
function isDarkColor(hex: string) {
  const value = String(hex || '').replace('#', '')
  if (value.length < 6) return false
  const r = parseInt(value.slice(0, 2), 16)
  const g = parseInt(value.slice(2, 4), 16)
  const b = parseInt(value.slice(4, 6), 16)
  return (r * 299 + g * 587 + b * 114) / 1000 < 140
}

/**
 * 拿到能被 drawImage 接受的本地路径。
 * 小程序不能直接画网络图，必须先 getImageInfo 落地；失败就返回空，
 * 让调用方画色块占位，而不是整张海报画不出来。
 */
function toLocalPath(src?: string): Promise<string> {
  if (!src) return Promise.resolve('')
  return new Promise((resolve) => {
    uni.getImageInfo({
      src,
      success: (res) => resolve(res.path || ''),
      fail: () => resolve(''),
    })
  })
}

/** 圆角矩形路径。小程序 CanvasContext 的 arcTo 支持度不稳，用 arc 拼。 */
function roundRectPath(ctx: any, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.arc(x + w - r, y + r, r, -Math.PI / 2, 0)
  ctx.lineTo(x + w, y + h - r)
  ctx.arc(x + w - r, y + h - r, r, 0, Math.PI / 2)
  ctx.lineTo(x + r, y + h)
  ctx.arc(x + r, y + h - r, r, Math.PI / 2, Math.PI)
  ctx.lineTo(x, y + r)
  ctx.arc(x + r, y + r, r, Math.PI, Math.PI * 1.5)
  ctx.closePath()
}

async function draw(): Promise<void> {
  if (!props.pieces.length && !props.title) return
  drawing.value = true
  drawError.value = ''
  try {
    const items = props.pieces.slice(0, MAX_ITEMS)
    const [paths, bgPath] = await Promise.all([
      Promise.all(items.map((piece) => toLocalPath(piece.img))),
      toLocalPath(props.background),
    ])

    const ctx: any = uni.createCanvasContext(CANVAS_ID, (instance as any)?.proxy || instance)

    // 底：场景照片优先，缺素材退回渐变（§4.3 不塞无关图片）
    if (bgPath) {
      ctx.drawImage(bgPath, 0, 0, W, H)
      // 照片上直接压字读不清，铺一层暗色蒙版
      ctx.setFillStyle('rgba(28, 20, 44, 0.42)')
      ctx.fillRect(0, 0, W, H)
    } else {
      const bg = ctx.createLinearGradient(0, 0, W, H)
      bg.addColorStop(0, props.gradient[0])
      bg.addColorStop(1, props.gradient[1])
      ctx.setFillStyle(bg)
      ctx.fillRect(0, 0, W, H)
    }

    // 当前滤镜（§10.9：导出保留页面上看到的那一层）
    if (props.overlay) {
      const filter = ctx.createLinearGradient(0, 0, W, H)
      filter.addColorStop(0, props.overlay[0])
      filter.addColorStop(1, props.overlay[1])
      ctx.setFillStyle(filter)
      ctx.fillRect(0, 0, W, H)
    }

    const dark = Boolean(bgPath) || isDarkColor(props.gradient[0]) || isDarkColor(props.gradient[1])
    const ink = {
      title: dark ? '#ffffff' : '#2f2a3d',
      sub: dark ? 'rgba(255,255,255,0.82)' : '#6b6580',
      item: dark ? 'rgba(255,255,255,0.9)' : '#4a4360',
      accent: dark ? '#ffd9f0' : '#9a6bff',
      foot: dark ? 'rgba(255,255,255,0.66)' : '#a8a2ba',
    }

    // 标题
    ctx.setFillStyle(ink.title)
    ctx.setFontSize(19)
    ctx.setTextAlign('left')
    ctx.fillText(ellipsis(props.title, 12), PAD, PAD + 20)

    // 副标题：场景 / 天气 / 场合
    if (props.subtitle) {
      ctx.setFillStyle(ink.sub)
      ctx.setFontSize(11)
      ctx.fillText(ellipsis(props.subtitle, 26), PAD, PAD + 40)
    }

    // 衣物网格
    const cell = (W - PAD * 2 - GAP * (COLS - 1)) / COLS
    const gridTop = PAD + 56
    items.forEach((piece, index) => {
      const col = index % COLS
      const row = Math.floor(index / COLS)
      const x = PAD + col * (cell + GAP)
      const y = gridTop + row * (cell + 28)

      // 白底卡片
      ctx.setFillStyle('#ffffff')
      roundRectPath(ctx, x, y, cell, cell, 8)
      ctx.fill()

      const local = paths[index]
      if (local) {
        ctx.save()
        roundRectPath(ctx, x, y, cell, cell, 8)
        ctx.clip()
        ctx.drawImage(local, x, y, cell, cell)
        ctx.restore()
      } else {
        // 没照片就用这件衣服自己的配色画占位，不塞无关图片（规格 §4.3）
        ctx.setFillStyle(piece.from || '#e9e1f7')
        roundRectPath(ctx, x + 6, y + 6, cell - 12, cell - 12, 6)
        ctx.fill()
      }

      ctx.setFillStyle(ink.item)
      ctx.setFontSize(10)
      ctx.setTextAlign('center')
      ctx.fillText(ellipsis(piece.name, 6), x + cell / 2, y + cell + 15)
      ctx.setTextAlign('left')
    })

    // 页脚：日期 + 水印
    ctx.setFillStyle(ink.accent)
    ctx.setFontSize(11)
    ctx.fillText(props.footnote || today(), PAD, H - PAD - 14)
    ctx.setFillStyle(ink.foot)
    ctx.setFontSize(10)
    ctx.fillText('灵犀 AI 穿搭 · 真实衣物搭配', PAD, H - PAD)

    await new Promise<void>((resolve) => {
      ctx.draw(false, () => setTimeout(resolve, 80))
    })
  } catch (error) {
    drawError.value = error instanceof Error ? error.message : '海报绘制失败'
  } finally {
    drawing.value = false
  }
}

function canvasToFile(): Promise<string> {
  return new Promise((resolve, reject) => {
    uni.canvasToTempFilePath(
      {
        canvasId: CANVAS_ID,
        destWidth: W * 2,
        destHeight: H * 2,
        fileType: 'png',
        success: (res) => resolve(res.tempFilePath),
        fail: (err: any) => reject(new Error(err?.errMsg || '海报导出失败')),
      },
      (instance as any)?.proxy || instance,
    )
  })
}

async function savePoster() {
  if (saving.value) return
  saving.value = true
  try {
    await draw()
    if (drawError.value) throw new Error(drawError.value)
    const filePath = await canvasToFile()

    // #ifdef MP-WEIXIN
    await new Promise<void>((resolve, reject) => {
      uni.saveImageToPhotosAlbum({
        filePath,
        success: () => {
          toast('海报已存入相册', 'success')
          resolve()
        },
        fail: (err: any) => {
          const msg = String(err?.errMsg || '')
          // 用户拒过相册权限后不会再弹授权框，只能引导去设置页打开
          if (msg.includes('auth deny') || msg.includes('authorize')) {
            uni.showModal({
              title: '需要相册权限',
              content: '保存海报需要「保存到相册」权限，去设置里打开？',
              confirmText: '去设置',
              success: (res) => {
                if (res.confirm) uni.openSetting({})
              },
            })
            reject(new Error('未授权保存到相册'))
            return
          }
          reject(new Error(msg || '保存失败'))
        },
      })
    })
    // #endif

    // #ifndef MP-WEIXIN
    // H5：canvasToTempFilePath 给的是 dataURL，直接触发浏览器下载；
    // 下载被拦时把图显示出来让用户长按保存，不至于什么都拿不到。
    try {
      const link = document.createElement('a')
      link.href = filePath
      link.download = `${props.fileName || props.title || '搭配海报'}.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      toast('海报已下载', 'success')
    } catch {
      uni.previewImage({ urls: [filePath] })
      toast('已打开海报，长按可保存')
    }
    // #endif
  } catch (error) {
    toast(error instanceof Error ? error.message : '海报保存失败')
  } finally {
    saving.value = false
  }
}

/** 换搭配、换滤镜、换场景都要重画 */
const signature = computed(() =>
  [
    props.title,
    props.background,
    props.overlay?.join('|') || '',
    props.pieces.map((piece) => piece.id).join(','),
  ].join('#'),
)

watch(
  signature,
  (value) => {
    if (value) setTimeout(draw, 50)
  },
  { immediate: true },
)

defineExpose({ savePoster, draw })
</script>

<template>
  <view class="poster-wrap">
    <canvas
      :id="CANVAS_ID"
      :canvas-id="CANVAS_ID"
      class="poster-canvas"
      :style="{ width: `${W}px`, height: `${H}px` }"
    />
    <view v-if="drawing" class="poster-hint">海报生成中…</view>
    <view v-else-if="drawError" class="poster-hint err">{{ drawError }}</view>
  </view>
</template>

<style scoped>
.poster-wrap {
  position: relative;
  display: flex;
  justify-content: center;
}
.poster-canvas {
  border-radius: var(--radius);
  box-shadow: var(--shadow-card);
  background: #fff;
}
.poster-hint {
  position: absolute;
  left: 50%;
  bottom: 16rpx;
  transform: translateX(-50%);
  padding: 8rpx 20rpx;
  border-radius: 999rpx;
  background: rgba(45, 33, 60, 0.7);
  color: #fff;
  font-size: 20rpx;
  font-weight: 700;
}
.poster-hint.err {
  background: #d9694f;
}
</style>
