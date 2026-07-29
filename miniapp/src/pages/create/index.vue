<script setup lang="ts">
import { ref } from 'vue'
import PageHeader from '@/components/PageHeader/PageHeader.vue'
import TileImage from '@/components/TileImage/TileImage.vue'
import CreateBasicInfo from './CreateBasicInfo.vue'
import CreateToolRail from './CreateToolRail.vue'
import { STEPS } from '@/data/questions'
import { MODEL_IMAGES } from '@/data/mock'

const toast = ref('')
let timer: number | undefined

function showToast(msg: string) {
  toast.value = msg
  window.clearTimeout(timer)
  timer = window.setTimeout(() => {
    toast.value = ''
  }, 1600)
}

function onTool(label: string) {
  showToast(`「${label}」功能正在打磨中～`)
}

function goHome() {
  uni.switchTab({ url: '/pages/home/home' })
}

function goTest() {
  uni.navigateTo({ url: '/pages/test/index' })
}

function goFreeMatch() {
  uni.navigateTo({ url: '/pages/free-match/index' })
}
</script>

<template>
  <view class="page">
    <PageHeader title="个性化创建" to="/pages/home/home">
      <template #right>
        <view class="done" @tap="goHome">完成</view>
      </template>
    </PageHeader>

    <view class="body">
      <view class="stage-wrap">
        <!-- 左上白色圆角标签 -->
        <text class="avatar-tag">我的虚拟形象</text>

        <!-- 中央：正面全身模特 + 粉色椭圆台 -->
        <view class="model">
          <view class="figure">
            <TileImage
              :src="MODEL_IMAGES.front"
              from="#ffe3ef"
              to="#e7d4ff"
              emoji="🧍‍♀️"
              ratio="3 / 4"
              fit="contain"
            />
            <!-- 右上飘出的换发型气泡 -->
            <view class="bubble" @tap="showToast('AI 正在为你换发型～')">
              💇‍♀️ 换发型
            </view>
            <!-- 膝盖附近点击优化指示点 -->
            <view class="hint" @tap="showToast('AI 正在为你优化造型～')">
              <text class="dot"></text>
              点击优化 ·
            </view>
          </view>
          <view class="platform"></view>
        </view>

        <!-- 左侧浮层：基础信息（可编辑身材数据） -->
        <CreateBasicInfo class="panel panel-left" />

        <!-- 右侧竖排工具栏 -->
        <CreateToolRail class="panel panel-right" @tool="onTool" />

        <!-- 左侧中部：5 个测试入口 -->
        <view class="tests">
          <view
            v-for="s in STEPS"
            :key="s.key"
            class="test"
            @tap="goTest"
          >
            <text class="test-emoji">{{ s.emoji }}</text>
            <text class="test-label">{{ s.title }}</text>
          </view>
        </view>

        <!-- 右下：自由搭配入口 -->
        <view class="free" @tap="goFreeMatch">
          自由搭配 →
        </view>
      </view>

      <view v-if="toast" class="toast">{{ toast }}</view>
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

/* 左上标签 */
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

/* 中央模特 */
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
/* 粉色椭圆台子 */
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

/* 换发型气泡 */
.bubble {
  position: absolute;
  top: 8%;
  right: -36rpx;
  z-index: 3;
  padding: 10rpx 20rpx;
  border-radius: var(--radius-pill);
  background: var(--surface);
  box-shadow: var(--shadow-float);
  border: 2rpx solid var(--line);
  font-size: 22rpx;
  font-weight: 700;
  color: var(--purple-deep);
  transition: transform 0.15s ease;
}
.bubble:active {
  transform: scale(0.94);
}

/* 膝盖附近指示 */
.hint {
  position: absolute;
  bottom: 22%;
  left: -28rpx;
  z-index: 3;
  display: flex;
  align-items: center;
  gap: 8rpx;
  padding: 6rpx 16rpx;
  border-radius: var(--radius-pill);
  background: rgba(255, 255, 255, 0.82);
  backdrop-filter: blur(6px);
  box-shadow: var(--shadow-card);
  font-size: 20rpx;
  font-weight: 600;
  color: var(--text-2);
}
.hint .dot {
  width: 14rpx;
  height: 14rpx;
  border-radius: 50%;
  background: var(--brand-gradient);
  box-shadow: 0 0 0 6rpx rgba(255, 158, 200, 0.25);
}

/* 浮层通用定位：不遮住中间形象 */
.panel {
  position: absolute;
  z-index: 3;
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

/* 右下自由搭配 */
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
</style>
