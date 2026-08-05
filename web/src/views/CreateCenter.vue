<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '@/components/PageHeader.vue'
import TileImage from '@/components/TileImage.vue'
import BottomNav from '@/components/BottomNav.vue'
import CreateBasicInfo from './create/CreateBasicInfo.vue'
import CreateToolRail from './create/CreateToolRail.vue'
import { STEPS } from '@/data/questions'
import { AI_TOOLS, HAIR_STYLES, MODEL_IMAGES } from '@/data/mock'
import { useProfileStore } from '@/stores/profile'
import { useWardrobeStore } from '@/stores/wardrobe'
import type { Gender, HairStyleId } from '@/types'

const router = useRouter()
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
  window.clearTimeout(timer)
  timer = window.setTimeout(() => {
    toast.value = ''
  }, 1600)
}

function save() {
  store.persist()
  showToast('已保存')
}

function complete() {
  save()
  window.setTimeout(() => {
    if (window.history.state?.back) router.back()
    else router.push('/home')
  }, 280)
}

function goTest(step: number) {
  router.push(`/test?step=${step}`)
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
  window.clearTimeout(highlightTimer)
  highlightTimer = window.setTimeout(() => {
    activePanel.value = ''
  }, 1600)
  showToast(kind === 'info' ? '基础信息已聚焦' : '已聚焦身材参数')
  nextTick(() => {
    document.querySelector('.panel-left')?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    })
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
</script>

<template>
  <div class="page">
    <PageHeader title="个性化创建">
      <template #right>
        <button class="done" @click="complete">完成</button>
      </template>
    </PageHeader>

    <div class="body">
      <div class="stage-wrap">
        <span class="avatar-tag">我的虚拟形象</span>

        <div class="model">
          <div class="figure">
            <TileImage
              :src="modelSrc"
              from="#ffe3ef"
              to="#e7d4ff"
              emoji="🧍‍♀️"
              ratio="3 / 4"
              fit="contain"
            />
            <span class="gender-chip">{{ genderLabel }}</span>
            <span class="hair-chip">{{ hairLabel }}</span>
          </div>
          <div class="platform"></div>
        </div>

        <div class="panel panel-left" :class="{ highlight: activePanel }">
          <CreateBasicInfo />
        </div>

        <CreateToolRail class="panel panel-right" @tool="onTool" />

        <div class="tests">
          <button
            v-for="(s, i) in STEPS"
            :key="s.key"
            class="test"
            @click="goTest(i + 1)"
          >
            <span class="test-emoji">{{ s.emoji }}</span>
            <span class="test-label">{{ s.title }}</span>
          </button>
        </div>

        <button class="free" @click="router.push('/free-match')">
          自由搭配 →
        </button>
      </div>

      <transition name="toast">
        <div v-if="toast" class="toast">{{ toast }}</div>
      </transition>
    </div>

    <BottomNav active="" />

    <transition name="sheet">
      <div v-if="showGender" class="mask" @click.self="showGender = false">
        <div class="sheet">
          <h3 class="sheet-title">更换性别</h3>
          <div class="gender-options">
            <button
              class="gender-option"
              :class="{ on: store.profile.gender === 'female' }"
              @click="chooseGender('female')"
            >
              女
            </button>
            <button
              class="gender-option"
              :class="{ on: store.profile.gender === 'male' }"
              @click="chooseGender('male')"
            >
              男
            </button>
          </div>
          <button class="btn btn-ghost sheet-close" @click="showGender = false">取消</button>
        </div>
      </div>
    </transition>

    <transition name="sheet">
      <div v-if="showHair" class="mask" @click.self="showHair = false">
        <div class="sheet">
          <h3 class="sheet-title">造型优化 · 换发型</h3>
          <div class="hair-options">
            <button
              v-for="h in HAIR_STYLES"
              :key="h.id"
              class="hair-option"
              :class="{ on: store.profile.hairstyle === h.id }"
              @click="chooseHair(h)"
            >
              <span class="hair-emoji">{{ h.emoji }}</span>
              <span class="hair-label">{{ h.label }}</span>
            </button>
          </div>
          <button class="btn btn-ghost sheet-close" @click="showHair = false">取消</button>
        </div>
      </div>
    </transition>

    <transition name="sheet">
      <div v-if="showFav" class="mask" @click.self="showFav = false">
        <div class="sheet fav-sheet">
          <h3 class="sheet-title">收藏夹</h3>
          <div v-if="wardrobe.favoriteGarments.length" class="fav-grid">
            <div
              v-for="g in wardrobe.favoriteGarments"
              :key="g.id"
              class="fav-card"
            >
              <span class="fav-emoji">{{ g.emoji }}</span>
              <span class="fav-name">{{ g.name }}</span>
            </div>
          </div>
          <div v-else class="fav-empty">还没有收藏</div>
          <button class="btn btn-ghost sheet-close" @click="showFav = false">关闭</button>
        </div>
      </div>
    </transition>
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

.gender-chip,
.hair-chip {
  position: absolute;
  z-index: 3;
  padding: 3px 9px;
  border-radius: var(--radius-pill);
  background: rgba(255, 255, 255, 0.88);
  box-shadow: var(--shadow-card);
  border: 1px solid var(--line);
  font-size: 10px;
  font-weight: 700;
  color: var(--text-2);
}
.gender-chip {
  top: 4%;
  left: -12px;
}
.hair-chip {
  top: 4%;
  right: -12px;
}

.panel {
  position: absolute;
  z-index: 3;
  transition: transform 0.25s ease, box-shadow 0.25s ease;
}
.panel.highlight {
  transform: translateY(-3px) scale(1.02);
  box-shadow: 0 0 0 3px rgba(255, 143, 192, 0.35), var(--shadow-float);
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

.mask {
  position: absolute;
  inset: 0;
  z-index: 20;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: rgba(31, 25, 45, 0.36);
}
.sheet {
  width: 100%;
  max-width: 430px;
  padding: 18px 18px calc(18px + var(--safe-bottom));
  border-radius: 24px 24px 0 0;
  background: #fff;
  box-shadow: 0 -12px 40px rgba(70, 50, 110, 0.22);
}
.sheet-title {
  margin: 0 0 16px;
  font-size: 17px;
  font-weight: 800;
  color: var(--text-1);
}
.gender-options {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.gender-option {
  height: 88px;
  border-radius: var(--radius);
  background: var(--surface);
  border: 1px solid var(--line);
  box-shadow: var(--shadow-card);
  font-size: 20px;
  font-weight: 800;
  color: var(--text-2);
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
  gap: 10px;
}
.hair-option {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px 6px;
  border-radius: var(--radius);
  background: var(--surface);
  border: 1px solid var(--line);
  box-shadow: var(--shadow-card);
  color: var(--text-2);
  transition: transform 0.15s ease, border-color 0.15s ease;
}
.hair-option.on {
  border-color: var(--pink);
  color: var(--purple-deep);
  transform: translateY(-2px);
}
.hair-emoji {
  font-size: 28px;
}
.hair-label {
  font-size: 12px;
  font-weight: 700;
}
.sheet-close {
  width: 100%;
  margin-top: 16px;
}
.fav-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  max-height: 46vh;
  overflow-y: auto;
}
.fav-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 14px 8px;
  border-radius: var(--radius);
  background: var(--surface);
  border: 1px solid var(--line);
  box-shadow: var(--shadow-card);
}
.fav-emoji {
  font-size: 26px;
}
.fav-name {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-2);
  text-align: center;
}
.fav-empty {
  padding: 36px 0;
  text-align: center;
  color: var(--text-3);
  font-size: 13px;
}
.sheet-enter-active,
.sheet-leave-active {
  transition: opacity 0.22s ease;
}
.sheet-enter-active .sheet,
.sheet-leave-active .sheet {
  transition: transform 0.22s ease;
}
.sheet-enter-from,
.sheet-leave-to {
  opacity: 0;
}
.sheet-enter-from .sheet,
.sheet-leave-to .sheet {
  transform: translateY(24px);
}
</style>
