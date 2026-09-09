<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { STEPS } from '@/constants/questions'
import { AI_TOOLS, HAIR_STYLES, MODEL_IMAGES } from '@/constants/ui'
import { useProfileStore } from '@/stores/profile'
import { useWardrobeStore } from '@/stores/wardrobe'
import type { Gender, HairStyleId } from '@/types'
import { iconForEmoji } from '@/utils/icons'
import { useToast } from '@/composables/useToast'
import { back, go } from '@/utils/nav'

const store = useProfileStore()
const wardrobe = useWardrobeStore()

const { toast, showToast } = useToast()
const activePanel = ref<'info' | 'body' | ''>('')
const showGender = ref(false)
const showHair = ref(false)
const showFav = ref(false)

let highlightTimer: number | undefined

onMounted(() => store.loadPersisted())

function save() {
  store.persist()
  showToast('已保存')
}

function complete() {
  save()
  setTimeout(() => {
    back()
  }, 280)
}

function goTest(step: number) {
  go('test', { step })
}

function goFreeMatch() {
  go('freeMatch')
}

function onTool(tool: (typeof AI_TOOLS)[number]) {
  if (tool.disabled) {
    showToast('拍照换脸暂未开放')
    return
  }
  if (tool.key === 'info') focusPanel('info')
  else if (tool.key === 'body') focusPanel('body')
  else if (tool.key === 'gender') showGender.value = true
  else if (tool.key === 'style') showHair.value = true
  else if (tool.key === 'fav') showFav.value = true
}

function focusPanel(kind: 'info' | 'body') {
  activePanel.value = kind
  clearTimeout(highlightTimer)
  highlightTimer = setTimeout(() => {
    activePanel.value = ''
  }, 1600)
  showToast(kind === 'info' ? '基础信息已聚焦' : '已聚焦身材参数')
  nextTick(() => {
    uni.pageScrollTo({ scrollTop: 0, duration: 200 })
  })
}

const modelSrc = computed(() => (store.profile.gender === 'male' ? MODEL_IMAGES.frontMale : MODEL_IMAGES.front))
const genderLabel = computed(() => (store.profile.gender === 'male' ? '男' : '女'))
const hairLabel = computed(() => HAIR_STYLES.find((h) => h.id === store.profile.hairstyle)?.label ?? '直发')

function chooseGender(gender: Gender) {
  store.setGender(gender)
  showGender.value = false
  showToast(gender === 'male' ? '已切换为男性形象' : '已切换为女性形象')
}

function chooseHair(hairstyle: (typeof HAIR_STYLES)[number]) {
  store.setHairstyle(hairstyle.id as HairStyleId)
  showHair.value = false
  showToast(`已应用${hairstyle.label}发型`)
}
</script>

<template>
  <view class="page">
    <PageHeader title="个性化创建">
      <template #right>
        <view class="done" @tap="complete">完成</view>
      </template>
    </PageHeader>

    <view class="body">
      <view class="stage-wrap">
        <text class="avatar-tag tag-pill">我的虚拟形象</text>

        <view class="model">
          <view class="figure">
            <!--
              模特是抠好的透明底立绘，不要 TileImage 的粉紫渐变底：
              图片本身不是 3:4，contain 之后左右会露出一条渐变色带（截图里那条粉边）。
              缺图时 from/to 仍会兜底，这里靠 emoji 提示。
            -->
            <TileImage :src="modelSrc" from="transparent" to="transparent" emoji="🧍‍♀️" ratio="3 / 4" fit="contain" />
            <text class="gender-chip">{{ genderLabel }}</text>
            <text class="hair-chip">{{ hairLabel }}</text>
          </view>
          <view class="platform"></view>
        </view>

        <view class="panel panel-left" :class="{ highlight: activePanel }">
          <CreateBasicInfo />
        </view>

        <CreateToolRail class="panel panel-right" @tool="onTool" />

        <view class="tests">
          <view v-for="(s, i) in STEPS" :key="s.key" class="test" @tap="goTest(i + 1)">
            <UiIcon :name="s.icon" :size="30" tone="purple" />
            <text class="test-label">{{ s.title }}</text>
          </view>
        </view>

        <view class="free" @tap="goFreeMatch">自由搭配 →</view>
      </view>

      <view v-if="toast" class="toast">{{ toast }}</view>
    </view>

    <BottomNav active="" />

    <Sheet v-if="showGender" title="更换性别" @close="showGender = false">
      <view class="gender-options">
        <view class="gender-option" :class="{ on: store.profile.gender === 'female' }" @tap="chooseGender('female')">
          女
        </view>
        <view class="gender-option" :class="{ on: store.profile.gender === 'male' }" @tap="chooseGender('male')">
          男
        </view>
      </view>
      <view class="btn btn-ghost sheet-close" @tap="showGender = false">取消</view>
    </Sheet>

    <Sheet v-if="showHair" title="造型优化 · 换发型" @close="showHair = false">
      <view class="hair-options">
        <view
          v-for="h in HAIR_STYLES"
          :key="h.id"
          class="hair-option"
          :class="{ on: store.profile.hairstyle === h.id }"
          @tap="chooseHair(h)"
        >
          <UiIcon class="hair-emoji" :name="h.icon" :size="52" tone="soft" />
          <text class="hair-label">{{ h.label }}</text>
        </view>
      </view>
      <view class="btn btn-ghost sheet-close" @tap="showHair = false">取消</view>
    </Sheet>

    <Sheet v-if="showFav" title="收藏夹" @close="showFav = false">
      <view v-if="wardrobe.favoriteGarments.length" class="fav-grid">
        <view v-for="g in wardrobe.favoriteGarments" :key="g.id" class="fav-card">
          <UiIcon class="fav-emoji" :name="iconForEmoji(g.emoji) ?? 'image'" :size="48" tone="muted" />
          <text class="fav-name">{{ g.name }}</text>
        </view>
      </view>
      <view v-else class="fav-empty">还没有收藏</view>
      <view class="btn btn-ghost sheet-close" @tap="showFav = false">关闭</view>
    </Sheet>
  </view>
</template>

<style scoped>
.body {
  position: relative;
  display: flex;
  flex-direction: column;
  padding: 16rpx 24rpx 24rpx;
}

.done {
  padding: 8rpx 12rpx;
  font-size: var(--fs-xl);
  font-weight: 700;
  color: var(--purple-deep);
}

.stage-wrap {
  position: relative;
  display: grid;
  flex: 1;
  place-items: center;
  min-height: 0;
  overflow: hidden;
}

/* 外观走全局 .tag-pill，这里只管定位 */
.avatar-tag {
  position: absolute;
  top: 12rpx;
  left: 8rpx;
  z-index: 4;
}

.model {
  display: flex;
  flex-direction: column;
  align-items: center;

  /* 设计稿里模特偏右，给左侧的基础信息面板让出位置 */
  transform: translateX(30rpx);
}

.figure {
  position: relative;
  width: 380rpx;
  max-width: 52vw;
}

.platform {
  width: 336rpx;
  max-width: 48vw;
  height: 52rpx;
  margin-top: -20rpx;
  background: radial-gradient(closest-side, rgb(255 158 200 / 55%), rgb(214 160 255 / 28%) 70%, transparent);
  border-radius: 50%;
  box-shadow: 0 20rpx 40rpx rgb(255 158 200 / 30%);
}

.gender-chip,
.hair-chip {
  position: absolute;
  z-index: 3;
  padding: 6rpx 18rpx;
  font-size: var(--fs-xs);
  font-weight: 700;
  color: var(--text-2);
  background: rgb(255 255 255 / 88%);
  border: 2rpx solid var(--line);
  border-radius: var(--radius-pill);
  box-shadow: var(--shadow-card);
}

.gender-chip {
  top: 6%;
  left: 0;
}

.hair-chip {
  top: 6%;

  /* 别再往外挂，否则会钻到右侧工具栏底下 */
  right: 0;
}

.panel {
  position: absolute;
  z-index: 3;
  transition:
    transform 0.25s ease,
    box-shadow 0.25s ease;
}

.panel.highlight {
  box-shadow:
    0 0 0 6rpx rgb(255 143 192 / 35%),
    var(--shadow-float);
  transform: translateY(-6rpx) scale(1.02);
}

.panel-left {
  top: 80rpx;
  left: 8rpx;

  /* 给左下角的五步测试留出位置，别再压上去 */
  max-height: calc(100% - 420rpx);
}

.panel-right {
  top: 80rpx;
  right: 8rpx;
}

.tests {
  position: absolute;
  bottom: 20rpx;
  left: 8rpx;
  z-index: 3;
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.test {
  display: flex;
  gap: 8rpx;
  align-items: center;
  padding: 8rpx 16rpx;
  background: var(--surface-glass);
  border-radius: var(--radius-pill);
  box-shadow: var(--shadow-soft);
  backdrop-filter: blur(8px);
  transition: transform 0.15s ease;
}

.test:active {
  transform: scale(0.94);
}

.test-label {
  font-size: var(--fs-xs);
  font-weight: 500;
  color: var(--text-2);
}

.free {
  position: absolute;
  right: 8rpx;
  bottom: 20rpx;
  z-index: 3;
  padding: 18rpx 32rpx;
  font-size: var(--fs-md);
  font-weight: 700;
  color: var(--text-on-brand);
  background: var(--brand-gradient);
  border-radius: var(--radius-pill);
  box-shadow: var(--shadow-float);
  transition: transform 0.15s ease;
}

.free:active {
  transform: scale(0.94);
}

.gender-options {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24rpx;
}

.gender-option {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 176rpx;
  font-size: 40rpx;
  font-weight: 500;
  color: var(--text-2);
  background: var(--surface);
  border: 2rpx solid var(--line);
  border-radius: var(--radius);
  box-shadow: var(--shadow-card);
  transition:
    transform 0.15s ease,
    border-color 0.15s ease;
}

.gender-option.on {
  color: #fff;
  background: var(--brand-gradient);
  border-color: transparent;
}

.hair-options {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20rpx;
}

.hair-option {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  align-items: center;
  padding: 32rpx 12rpx;
  color: var(--text-2);
  background: var(--surface);
  border: 2rpx solid var(--line);
  border-radius: var(--radius);
  box-shadow: var(--shadow-card);
  transition:
    transform 0.15s ease,
    border-color 0.15s ease;
}

.hair-option.on {
  color: var(--purple-deep);
  border-color: var(--pink);
  transform: translateY(-4rpx);
}

.hair-emoji {
  font-size: 56rpx;
}

.hair-label {
  font-size: var(--fs-base);
  font-weight: 700;
}

.sheet-close {
  width: 100%;
  margin-top: 32rpx;
}

.fav-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20rpx;
  max-height: 46vh;
  overflow-y: auto;
}

.fav-card {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  align-items: center;
  padding: 28rpx 16rpx;
  background: var(--surface);
  border: 2rpx solid var(--line);
  border-radius: var(--radius);
  box-shadow: var(--shadow-card);
}

.fav-emoji {
  font-size: 52rpx;
}

.fav-name {
  font-size: var(--fs-sm);
  font-weight: 500;
  color: var(--text-2);
  text-align: center;
}

.fav-empty {
  padding: 72rpx 0;
  font-size: var(--fs-md);
  color: var(--text-3);
  text-align: center;
}
</style>
