<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '@/components/PageHeader.vue'
import TileImage from '@/components/TileImage.vue'
import CreateBasicInfo from './create/CreateBasicInfo.vue'
import CreateToolRail from './create/CreateToolRail.vue'
import { STEPS } from '@/data/questions'
import { MODEL_IMAGES } from '@/data/mock'

const router = useRouter()

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
</script>

<template>
  <div class="page">
    <PageHeader title="个性化创建" to="/home">
      <template #right>
        <button class="done" @click="router.push('/home')">完成</button>
      </template>
    </PageHeader>

    <div class="body">
      <div class="stage-wrap">
        <!-- 左上白色圆角标签 -->
        <span class="avatar-tag">我的虚拟形象</span>

        <!-- 中央：正面全身模特 + 粉色椭圆台 -->
        <div class="model">
          <div class="figure">
            <TileImage
              :src="MODEL_IMAGES.front"
              from="#ffe3ef"
              to="#e7d4ff"
              emoji="🧍‍♀️"
              ratio="3 / 4"
              fit="contain"
            />
            <!-- 右上飘出的换发型气泡 -->
            <button class="bubble" @click="showToast('AI 正在为你换发型～')">
              💇‍♀️ 换发型
            </button>
            <!-- 膝盖附近点击优化指示点 -->
            <button class="hint" @click="showToast('AI 正在为你优化造型～')">
              <span class="dot"></span>
              点击优化 ·
            </button>
          </div>
          <div class="platform"></div>
        </div>

        <!-- 左侧浮层：基础信息（可编辑身材数据） -->
        <CreateBasicInfo class="panel panel-left" />

        <!-- 右侧竖排工具栏 -->
        <CreateToolRail class="panel panel-right" @tool="onTool" />

        <!-- 左侧中部：5 个测试入口 -->
        <div class="tests">
          <button
            v-for="s in STEPS"
            :key="s.key"
            class="test"
            @click="router.push('/test')"
          >
            <span class="test-emoji">{{ s.emoji }}</span>
            <span class="test-label">{{ s.title }}</span>
          </button>
        </div>

        <!-- 右下：自由搭配入口 -->
        <button class="free" @click="router.push('/free-match')">
          自由搭配 →
        </button>
      </div>

      <transition name="toast">
        <div v-if="toast" class="toast">{{ toast }}</div>
      </transition>
    </div>
  </div>
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
  padding: 8px 12px 12px;
  display: flex;
  flex-direction: column;
}

.done {
  font-size: 15px;
  font-weight: 700;
  color: var(--purple-deep);
  padding: 4px 6px;
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
  top: 6px;
  left: 4px;
  z-index: 4;
  padding: 5px 12px;
  border-radius: var(--radius-pill);
  background: var(--surface);
  box-shadow: var(--shadow-card);
  border: 1px solid var(--line);
  font-size: 12px;
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
  width: 190px;
  max-width: 52vw;
}
/* 粉色椭圆台子 */
.platform {
  width: 168px;
  max-width: 48vw;
  height: 26px;
  margin-top: -10px;
  border-radius: 50%;
  background: radial-gradient(
    closest-side,
    rgba(255, 158, 200, 0.55),
    rgba(214, 160, 255, 0.28) 70%,
    transparent
  );
  box-shadow: 0 10px 20px rgba(255, 158, 200, 0.3);
}

/* 换发型气泡 */
.bubble {
  position: absolute;
  top: 8%;
  right: -18px;
  z-index: 3;
  padding: 5px 10px;
  border-radius: var(--radius-pill);
  background: var(--surface);
  box-shadow: var(--shadow-float);
  border: 1px solid var(--line);
  font-size: 11px;
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
  left: -14px;
  z-index: 3;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: var(--radius-pill);
  background: rgba(255, 255, 255, 0.82);
  backdrop-filter: blur(6px);
  box-shadow: var(--shadow-card);
  font-size: 10px;
  font-weight: 600;
  color: var(--text-2);
}
.hint .dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--brand-gradient);
  box-shadow: 0 0 0 3px rgba(255, 158, 200, 0.25);
}

/* 浮层通用定位：不遮住中间形象 */
.panel {
  position: absolute;
  z-index: 3;
}
.panel-left {
  top: 40px;
  left: 4px;
  max-height: calc(100% - 52px);
}
.panel-right {
  top: 40px;
  right: 4px;
}

.tests {
  position: absolute;
  left: 4px;
  bottom: 10px;
  z-index: 3;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.test {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 6px 10px;
  border-radius: var(--radius-pill);
  background: rgba(255, 255, 255, 0.78);
  backdrop-filter: blur(8px);
  box-shadow: var(--shadow-card);
  border: 1px solid var(--line);
  transition: transform 0.15s ease;
}
.test:active {
  transform: scale(0.94);
}
.test-emoji {
  font-size: 14px;
}
.test-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-2);
}

/* 右下自由搭配 */
.free {
  position: absolute;
  right: 4px;
  bottom: 10px;
  z-index: 3;
  padding: 9px 16px;
  border-radius: var(--radius-pill);
  background: var(--brand-gradient);
  color: var(--text-on-brand);
  font-size: 13px;
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
  bottom: 72px;
  transform: translateX(-50%);
  z-index: 10;
  max-width: 80%;
  padding: 9px 16px;
  border-radius: var(--radius-pill);
  background: rgba(47, 47, 58, 0.86);
  color: #fff;
  font-size: 13px;
  white-space: nowrap;
  box-shadow: var(--shadow-float);
}
.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translate(-50%, 6px);
}
</style>
