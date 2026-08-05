<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import AvatarViewer from '@/components/AvatarViewer.vue'
import RadarChart from '@/components/RadarChart.vue'
import { useProfileStore } from '@/stores/profile'
import { PREFERENCE_QUESTIONS } from '@/data/questions'
import { fetchStyleReport, type StyleReport } from '@/api/ai'
import { buildLocalStyleReport } from '@/data/localReport'
import { MODEL_IMAGES } from '@/data/mock'

const router = useRouter()
const store = useProfileStore()

const report = ref<StyleReport | null>(null)
const loading = ref(false)
const error = ref('')
const source = ref<'ai' | 'local'>('ai')

/** 组装发给 AI 的可读画像 */
function buildPayload() {
  const prefs: Record<string, string> = {}
  for (const q of PREFERENCE_QUESTIONS) {
    const optId = store.profile.preferences[q.id]
    if (optId) prefs[q.title] = q.options.find((o) => o.id === optId)?.label ?? optId
  }
  return {
    styles: store.styleLabels,
    skin: store.skinLabel,
    face: store.faceLabel,
    bmi: store.bmi,
    body: { ...store.profile.body },
    preferences: prefs,
  }
}

async function generate() {
  loading.value = true
  error.value = ''
  source.value = 'ai'
  try {
    report.value = await fetchStyleReport(buildPayload())
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
    report.value = buildLocalStyleReport({
      styles: store.profile.styles,
      skinTone: store.profile.skinTone,
      faceShape: store.profile.faceShape,
      body: { ...store.profile.body },
      preferences: { ...store.profile.preferences },
      gender: store.profile.gender,
      hairstyle: store.profile.hairstyle,
    })
    source.value = 'local'
    error.value = ''
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  store.loadPersisted()
  generate()
})

// AI 有数据就用 AI 的，否则回退到本地示意
const radar = computed(() =>
  report.value?.radar?.length ? report.value.radar : store.radar,
)
const summary = computed(
  () => report.value?.summary || store.summary || '完成测试即可生成你的专属画像',
)
const modelSrc = computed(() =>
  store.profile.gender === 'male' ? MODEL_IMAGES.frontMale : MODEL_IMAGES.front,
)
const viewerLabel = computed(() =>
  store.profile.gender === 'male' ? '男性虚拟形象' : '女性虚拟形象',
)

function save() {
  store.persist()
  router.push('/home')
}
function retest() {
  store.reset()
  store.persist()
  router.push('/test')
}
</script>

<template>
  <div class="page">
    <header class="top">
      <button class="back" aria-label="返回" @click="router.back()">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
      <h1 class="title">我的专属风格报告</h1>
      <button class="retest" @click="retest">重测</button>
    </header>

    <div class="body scroll-y hide-scrollbar">
      <!-- AI 状态条 -->
      <div v-if="loading" class="ai-banner loading">
        <span class="spin">🤖</span> AI 正在生成你的专属风格报告…
      </div>
      <div v-else-if="error" class="ai-banner err">
        <span>⚠️ AI 没连上：{{ error }}</span>
        <button class="mini" @click="generate">重试</button>
      </div>
      <div v-else-if="report && source === 'ai'" class="ai-banner ok">
        <span>✨ 以下由 AI 实时生成</span>
        <button class="mini" @click="generate">换一份</button>
      </div>
      <div v-else-if="report && source === 'local'" class="ai-banner ok">
        <span>🧭 本地画像生成（AI 未连接）</span>
        <button class="mini" @click="generate">重试 AI</button>
      </div>

      <!-- 虚拟形象 -->
      <section class="card avatar-card">
        <AvatarViewer :src="modelSrc" :frames="{ front: modelSrc }" :label="viewerLabel" />
        <p class="summary">{{ summary }}</p>
      </section>

      <!-- 画像雷达图 -->
      <section class="card">
        <h2 class="sec-title">🧭 我的画像雷达</h2>
        <RadarChart :dimensions="radar" />
      </section>

      <!-- 推荐配色 -->
      <section v-if="report?.palette?.length" class="card">
        <h2 class="sec-title">🎨 推荐配色</h2>
        <div class="palette">
          <span v-for="c in report.palette" :key="c" class="sw" :style="{ background: c }" :title="c" />
        </div>
      </section>

      <!-- AI 穿搭推荐 -->
      <section v-if="report?.recommendations?.length" class="card">
        <h2 class="sec-title">👗 AI 穿搭推荐</h2>
        <div class="recos">
          <div v-for="(r, i) in report.recommendations" :key="i" class="reco">
            <div class="reco-head">
              <span class="reco-title">{{ r.title }}</span>
              <span class="reco-scene">{{ r.scene }}</span>
            </div>
            <div class="reco-pieces">
              <span v-for="(p, j) in r.pieces" :key="j" class="piece">{{ p }}</span>
            </div>
            <p class="reco-reason">{{ r.reason }}</p>
          </div>
        </div>
      </section>

      <!-- 造型建议 -->
      <section v-if="report?.tips?.length" class="card">
        <h2 class="sec-title">💡 造型建议</h2>
        <ul class="tips">
          <li v-for="(t, i) in report.tips" :key="i">{{ t }}</li>
        </ul>
      </section>

      <!-- 关键标签 -->
      <section class="card">
        <h2 class="sec-title">🏷️ 关键标签</h2>
        <div class="traits">
          <div class="trait">
            <span class="k">肤色</span><span class="v">{{ store.skinLabel || '—' }}</span>
          </div>
          <div class="trait">
            <span class="k">脸型</span><span class="v">{{ store.faceLabel || '—' }}</span>
          </div>
          <div class="trait">
            <span class="k">BMI</span><span class="v">{{ store.bmi }}</span>
          </div>
        </div>
        <div class="style-tags">
          <span v-for="s in store.styleLabels" :key="s" class="style-tag">{{ s }}</span>
          <span v-if="!store.styleLabels.length" class="style-tag empty">未选择风格</span>
        </div>
      </section>
    </div>

    <footer class="foot">
      <button class="btn btn-primary save" @click="save">保存并进入首页</button>
    </footer>
  </div>
</template>

<style scoped>
.page {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.top {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: calc(env(safe-area-inset-top, 12px) + 10px) 16px 10px;
  flex-shrink: 0;
}
.back {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: rgba(255, 255, 255, 0.7);
  color: var(--text-1);
  box-shadow: var(--shadow-card);
}
.title {
  flex: 1;
  margin: 0;
  text-align: center;
  font-size: 17px;
  font-weight: 700;
}
.retest {
  font-size: 13px;
  font-weight: 600;
  color: var(--purple-deep);
  background: rgba(255, 255, 255, 0.7);
  padding: 7px 12px;
  border-radius: 999px;
}

.body {
  flex: 1;
  min-height: 0;
  padding: 6px 16px 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

/* AI 状态条 */
.ai-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 14px;
  border-radius: var(--radius);
  font-size: 13px;
  font-weight: 600;
}
.ai-banner.loading {
  background: rgba(177, 140, 255, 0.14);
  color: var(--purple-deep);
}
.ai-banner.ok {
  background: rgba(255, 126, 179, 0.12);
  color: var(--pink-deep);
}
.ai-banner.err {
  background: #fff3f0;
  color: #d9694f;
}
.spin {
  display: inline-block;
  animation: spin 1.2s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.mini {
  flex-shrink: 0;
  font-size: 12px;
  font-weight: 700;
  color: inherit;
  background: rgba(255, 255, 255, 0.6);
  padding: 4px 10px;
  border-radius: 999px;
}

.card {
  background: var(--surface);
  border-radius: var(--radius-lg);
  padding: 18px;
  box-shadow: var(--shadow-card);
}
.avatar-card {
  padding-top: 8px;
}
.summary {
  margin: 4px 0 0;
  text-align: center;
  font-size: 15px;
  font-weight: 700;
  color: var(--text-1);
}

.sec-title {
  margin: 0 0 10px;
  font-size: 15px;
  font-weight: 800;
  color: var(--text-1);
}

/* 配色 */
.palette {
  display: flex;
  gap: 10px;
}
.sw {
  flex: 1;
  height: 40px;
  border-radius: 10px;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.06);
}

/* 推荐 */
.recos {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.reco {
  background: #f8f5ff;
  border-radius: var(--radius);
  padding: 12px 14px;
}
.reco-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.reco-title {
  font-size: 15px;
  font-weight: 800;
  color: var(--text-1);
}
.reco-scene {
  font-size: 11px;
  font-weight: 700;
  color: #fff;
  background: var(--brand-gradient);
  padding: 2px 8px;
  border-radius: 999px;
}
.reco-pieces {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}
.piece {
  font-size: 12px;
  color: var(--purple-deep);
  background: #fff;
  border: 1px solid var(--line);
  padding: 4px 10px;
  border-radius: 999px;
}
.reco-reason {
  margin: 0;
  font-size: 12px;
  color: var(--text-2);
  line-height: 1.5;
}

/* 建议 */
.tips {
  margin: 0;
  padding-left: 18px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.tips li {
  font-size: 13px;
  color: var(--text-1);
  line-height: 1.5;
}

.traits {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin-bottom: 14px;
}
.trait {
  background: #f6f2fd;
  border-radius: var(--radius);
  padding: 12px;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.trait .k {
  font-size: 12px;
  color: var(--text-3);
}
.trait .v {
  font-size: 16px;
  font-weight: 800;
  color: var(--purple-deep);
}

.style-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.style-tag {
  padding: 7px 14px;
  border-radius: 999px;
  background: rgba(255, 126, 179, 0.12);
  color: var(--pink-deep);
  font-size: 13px;
  font-weight: 600;
}
.style-tag.empty {
  background: #f0edf6;
  color: var(--text-3);
}

.foot {
  flex-shrink: 0;
  padding: 12px 16px calc(14px + var(--safe-bottom));
  background: linear-gradient(180deg, rgba(255, 255, 255, 0) 0%, rgba(255, 255, 255, 0.55) 40%);
}
.save {
  width: 100%;
}
</style>
