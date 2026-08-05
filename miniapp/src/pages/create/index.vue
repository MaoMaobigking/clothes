<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import PageHeader from '@/components/PageHeader/PageHeader.vue'
import TileImage from '@/components/TileImage/TileImage.vue'
import BottomNav from '@/components/BottomNav/BottomNav.vue'
import CreateBasicInfo from './CreateBasicInfo.vue'
import CreateToolRail from './CreateToolRail.vue'
import { STEPS } from '@/data/questions'
import { AI_TOOLS, HAIR_STYLES, MODEL_IMAGES } from '@/data/mock'
import { useProfileStore } from '@/stores/profile'
import { useWardrobeStore } from '@/stores/wardrobe'
import type { Gender, HairStyleId } from '@/types'

const store = useProfileStore()
const wardrobe = useWardrobeStore()

const toast = ref('')
const activePanel = ref<'info' | 'body' | ''>('')
const showGender = ref(false)
const showHair = ref(false)
const showFav = ref(false)

let timer: number | undefined
let highlightTimer: number | undefined

onMounted(() => store.loadPersisted())

function showToast(msg: string) {
  toast.value = msg
  clearTimeout(timer)
  timer = setTimeout(() => {
    toast.value = ''
  }, 1600)
}

function save() {
  store.persist()
  showToast('已保存')
}

function complete() {
  save()
  setTimeout(() => {
    uni.navigateBack({
      fail: () => uni.switchTab({ url: '/pages/home/home' }),
    })
  }, 280)
}

function goTest(step: number) {
  uni.navigateTo({ url: `/pages/test/index?step=${step}` })
}

function goFreeMatch() {
  uni.navigateTo({ url: '/pages/free-match/index' })
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

const modelSrc = computed(() =>
  store.profile.gender === 'male' ? MODEL_IMAGES.frontMale : MODEL_IMAGES.front,
)
const genderLabel = computed(() => (store.profile.gender === 'male' ? '男' : '女'))
const hairLabel = computed(
  () => HAIR_STYLES.find((h) => h.id === store.profile.hairstyle)?.label ?? '直发',
)

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

function onMaskTap(kind: 'gender' | 'hair' | 'fav', e: any) {
  if (e.target === e.currentTarget) {
    if (kind === 'gender') showGender.value = false
    if (kind === 'hair') showHair.value = false
    if (kind === 'fav') showFav.value = false
  }
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
        <text class="avatar-tag">我的虚拟形象</text>

        <view class="model">
          <view class="figure">
            <TileImage
              :src="modelSrc"
              from="#ffe3ef"
              to="#e7d4ff"
              emoji="🧍‍♀️"
              ratio="3 / 4"
              fit="contain"
            />
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
          <view
            v-for="(s, i) in STEPS"
            :key="s.key"
            class="test"
            @tap="goTest(i + 1)"
          >
            <text class="test-emoji">{{ s.emoji }}</text>
            <text class="test-label">{{ s.title }}</text>
          </view>
        </view>

        <view class="free" @tap="goFreeMatch">
          自由搭配 →
        </view>
      </view>

      <view v-if="toast" class="toast">{{ toast }}</view>
    </view>

    <BottomNav active="" />

    <view v-if="showGender" class="mask" @tap="onMaskTap('gender', $event)">
      <view class="sheet" @tap.stop>
        <view class="sheet-title">更换性别</view>
        <view class="gender-options">
          <view
            class="gender-option"
            :class="{ on: store.profile.gender === 'female' }"
            @tap="chooseGender('female')"
          >
            女
          </view>
          <view
            class="gender-option"
            :class="{ on: store.profile.gender === 'male' }"
            @tap="chooseGender('male')"
          >
            男
          </view>
        </view>
        <view class="btn btn-ghost sheet-close" @tap="showGender = false">取消</view>
      </view>
    </view>

    <view v-if="showHair" class="mask" @tap="onMaskTap('hair', $event)">
      <view class="sheet" @tap.stop>
        <view class="sheet-title">造型优化 · 换发型</view>
        <view class="hair-options">
          <view
            v-for="h in HAIR_STYLES"
            :key="h.id"
            class="hair-option"
            :class="{ on: store.profile.hairstyle === h.id }"
            @tap="chooseHair(h)"
          >
            <text class="hair-emoji">{{ h.emoji }}</text>
            <text class="hair-label">{{ h.label }}</text>
          </view>
        </view>
        <view class="btn btn-ghost sheet-close" @tap="showHair = false">取消</view>
      </view>
    </view>

    <view v-if="showFav" class="mask" @tap="onMaskTap('fav', $event)">
      <view class="sheet fav-sheet" @tap.stop>
        <view class="sheet-title">收藏夹</view>
        <view v-if="wardrobe.favoriteGarments.length" class="fav-grid">
          <view
            v-for="g in wardrobe.favoriteGarments"
            :key="g.id"
            class="fav-card"
          >
            <text class="fav-emoji">{{ g.emoji }}</text>
            <text class="fav-name">{{ g.name }}</text>
          </view>
        </view>
        <view v-else class="fav-empty">还没有收藏</view>
        <view class="btn btn-ghost sheet-close" @tap="showFav = false">关闭</view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.page {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.body {
  position: relative;
  flex: 1;
  min-height: 0;
  padding: 16rpx 24rpx 24rpx;
  display: flex;
  flex-direction: column;
}

.done {
  font-size: 30rpx;
  font-weight: 700;
  color: var(--purple-deep);
  padding: 8rpx 12rpx;
}

.stage-wrap {
  position: relative;
  flex: 1;
  min-height: 0;
  display: grid;
  place-items: center;
  overflow: hidden;
}

.avatar-tag {
  position: absolute;
  top: 12rpx;
  left: 8rpx;
  z-index: 4;
  padding: 10rpx 24rpx;
  border-radius: var(--radius-pill);
  background: var(--surface);
  box-shadow: var(--shadow-card);
  border: 2rpx solid var(--line);
  font-size: 24rpx;
  font-weight: 700;
  color: var(--text-1);
}

.model {
  display: flex;
  flex-direction: column;
  align-items: center;
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
  border-radius: 50%;
  background: radial-gradient(
    closest-side,
    rgba(255, 158, 200, 0.55),
    rgba(214, 160, 255, 0.28) 70%,
    transparent
  );
  box-shadow: 0 20rpx 40rpx rgba(255, 158, 200, 0.3);
}

.gender-chip,
.hair-chip {
  position: absolute;
  z-index: 3;
  padding: 6rpx 18rpx;
  border-radius: var(--radius-pill);
  background: rgba(255, 255, 255, 0.88);
  box-shadow: var(--shadow-card);
  border: 2rpx solid var(--line);
  font-size: 20rpx;
  font-weight: 700;
  color: var(--text-2);
}
.gender-chip {
  top: 4%;
  left: -24rpx;
}
.hair-chip {
  top: 4%;
  right: -24rpx;
}

.panel {
  position: absolute;
  z-index: 3;
  transition: transform 0.25s ease, box-shadow 0.25s ease;
}
.panel.highlight {
  transform: translateY(-6rpx) scale(1.02);
  box-shadow: 0 0 0 6rpx rgba(255, 143, 192, 0.35), var(--shadow-float);
}
.panel-left {
  top: 80rpx;
  left: 8rpx;
  max-height: calc(100% - 104rpx);
}
.panel-right {
  top: 80rpx;
  right: 8rpx;
}

.tests {
  position: absolute;
  left: 8rpx;
  bottom: 20rpx;
  z-index: 3;
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}
.test {
  display: flex;
  align-items: center;
  gap: 10rpx;
  padding: 12rpx 20rpx;
  border-radius: var(--radius-pill);
  background: rgba(255, 255, 255, 0.78);
  backdrop-filter: blur(8px);
  box-shadow: var(--shadow-card);
  border: 2rpx solid var(--line);
  transition: transform 0.15s ease;
}
.test:active {
  transform: scale(0.94);
}
.test-emoji {
  font-size: 28rpx;
}
.test-label {
  font-size: 22rpx;
  font-weight: 600;
  color: var(--text-2);
}

.free {
  position: absolute;
  right: 8rpx;
  bottom: 20rpx;
  z-index: 3;
  padding: 18rpx 32rpx;
  border-radius: var(--radius-pill);
  background: var(--brand-gradient);
  color: var(--text-on-brand);
  font-size: 26rpx;
  font-weight: 700;
  box-shadow: var(--shadow-float);
  transition: transform 0.15s ease;
}
.free:active {
  transform: scale(0.94);
}

.toast {
  position: absolute;
  left: 50%;
  bottom: 144rpx;
  transform: translateX(-50%);
  z-index: 10;
  max-width: 80%;
  padding: 18rpx 32rpx;
  border-radius: var(--radius-pill);
  background: rgba(47, 47, 58, 0.86);
  color: #fff;
  font-size: 26rpx;
  white-space: nowrap;
  box-shadow: var(--shadow-float);
}

.mask {
  position: fixed;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  z-index: 20;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: rgba(31, 25, 45, 0.36);
}
.sheet {
  width: 100%;
  padding: 36rpx 36rpx calc(36rpx + env(safe-area-inset-bottom, 0px));
  border-radius: 48rpx 48rpx 0 0;
  background: #fff;
  box-shadow: 0 -24rpx 80rpx rgba(70, 50, 110, 0.22);
}
.sheet-title {
  margin-bottom: 32rpx;
  font-size: 34rpx;
  font-weight: 800;
  color: var(--text-1);
}
.gender-options {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24rpx;
}
.gender-option {
  height: 176rpx;
  border-radius: var(--radius);
  background: var(--surface);
  border: 2rpx solid var(--line);
  box-shadow: var(--shadow-card);
  font-size: 40rpx;
  font-weight: 800;
  color: var(--text-2);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.15s ease, border-color 0.15s ease;
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
  align-items: center;
  gap: 16rpx;
  padding: 32rpx 12rpx;
  border-radius: var(--radius);
  background: var(--surface);
  border: 2rpx solid var(--line);
  box-shadow: var(--shadow-card);
  color: var(--text-2);
  transition: transform 0.15s ease, border-color 0.15s ease;
}
.hair-option.on {
  border-color: var(--pink);
  color: var(--purple-deep);
  transform: translateY(-4rpx);
}
.hair-emoji {
  font-size: 56rpx;
}
.hair-label {
  font-size: 24rpx;
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
  align-items: center;
  gap: 16rpx;
  padding: 28rpx 16rpx;
  border-radius: var(--radius);
  background: var(--surface);
  border: 2rpx solid var(--line);
  box-shadow: var(--shadow-card);
}
.fav-emoji {
  font-size: 52rpx;
}
.fav-name {
  font-size: 22rpx;
  font-weight: 600;
  color: var(--text-2);
  text-align: center;
}
.fav-empty {
  padding: 72rpx 0;
  text-align: center;
  color: var(--text-3);
  font-size: 26rpx;
}
</style>
