<script setup lang="ts">
/*
 * 搭配海报导出（规格 §8.9「分享：生成当前搭配海报，支持保存图片」）。
 *
 * 以前这里只有一句 toast「请长按分享卡片保存」，实际上什么都没生成。
 * 现在用 canvas 真画一张：标题 + 真实衣物照片网格 + 日期 + 水印，
 * 再按端分流保存 —— 小程序走相册，H5 走浏览器下载，失败都有明确提示。
 *
 * 用的是 uni 的旧版 canvas API（createCanvasContext + draw + canvasToTempFilePath），
 * 因为 type="2d" 在 H5 端和小程序端行为不一致，旧版两端都能跑。
 */
import { getCurrentInstance, ref, watch } from 'vue'
import type { Outfit } from '@/api/wardrobe'

const props = defineProps<{ outfit: Outfit | null }>()

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

function formatDate(value?: string) {
  const date = value ? new Date(value) : new Date()
  const d = Number.isNaN(date.getTime()) ? new Date() : date
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`
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
  const outfit = props.outfit
  if (!outfit) return
  drawing.value = true
  drawError.value = ''
  try {
    const items = outfit.items.slice(0, MAX_ITEMS)
    const paths = await Promise.all(items.map((entry) => toLocalPath(entry.garment.img)))

    const ctx: any = uni.createCanvasContext(CANVAS_ID, (instance as any)?.proxy || instance)

    // 底：品牌渐变
    const bg = ctx.createLinearGradient(0, 0, W, H)
    bg.addColorStop(0, '#fff1f7')
    bg.addColorStop(1, '#ece2ff')
    ctx.setFillStyle(bg)
    ctx.fillRect(0, 0, W, H)

    // 标题
    ctx.setFillStyle('#2f2a3d')
    ctx.setFontSize(19)
    ctx.setTextAlign('left')
    ctx.fillText(ellipsis(outfit.title, 12), PAD, PAD + 20)

    // 副标题：场景 / 场合
    ctx.setFillStyle('#6b6580')
    ctx.setFontSize(11)
    const sub = [outfit.scene, outfit.occasion].filter(Boolean).join(' · ')
    if (sub) ctx.fillText(ellipsis(sub, 26), PAD, PAD + 40)

    // 衣物网格
    const cell = (W - PAD * 2 - GAP * (COLS - 1)) / COLS
    const gridTop = PAD + 56
    items.forEach((entry, index) => {
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
        ctx.setFillStyle(entry.garment.primaryColor || entry.garment.from || '#e9e1f7')
        roundRectPath(ctx, x + 6, y + 6, cell - 12, cell - 12, 6)
        ctx.fill()
      }

      ctx.setFillStyle('#4a4360')
      ctx.setFontSize(10)
      ctx.setTextAlign('center')
      ctx.fillText(ellipsis(entry.garment.name, 6), x + cell / 2, y + cell + 15)
      ctx.setTextAlign('left')
    })

    // 页脚：日期 + 水印
    ctx.setFillStyle('#9a6bff')
    ctx.setFontSize(11)
    ctx.fillText(formatDate(outfit.createdAt), PAD, H - PAD - 14)
    ctx.setFillStyle('#a8a2ba')
    ctx.setFontSize(10)
    ctx.fillText('灵犀 AI 穿搭 · 旧衣智能搭配', PAD, H - PAD)

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
  if (!props.outfit || saving.value) return
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
      link.download = `${props.outfit.title || '搭配海报'}.png`
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

// 换一套搭配就重画预览
watch(
  () => props.outfit?.id,
  (id) => {
    if (id) setTimeout(draw, 50)
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
