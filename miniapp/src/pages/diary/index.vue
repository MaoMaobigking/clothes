<script setup lang="ts">
/*
 * 穿搭日记（规格 §11.1）。
 *
 * 三块：月份切换 → 日历（有记录的日子带点）→ 本月记录倒序列表。
 * 点任意一天开底部面板记录/编辑，一人一天一条（后端是 upsert，重复点不会撞唯一键）。
 *
 * 日期一律按字符串处理，只在拼日历格子时做数字运算 ——
 * new Date('2026-08-18') 是按 UTC 零点解析的，东八区侥幸不出错，换个负时区就整体差一天。
 * 需要「这一天是星期几」时用 new Date(y, m-1, d) 这种**分量构造**，它按本地时区，不会漂。
 */
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { apiDeleteDiary, apiListDiary, apiSaveDiary, type DiaryEntry } from '@/api/diary'
import { apiListOutfits, type Outfit } from '@/api/wardrobe'
import { isAuthError } from '@/api/http'

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

/* 存的是 label 字符串本身（后端 weather 是 VARCHAR），icon 只用于渲染 */
const WEATHERS = [
  { label: '晴', icon: 'w-sun' },
  { label: '多云', icon: 'w-cloud-sun' },
  { label: '阴', icon: 'w-cloud' },
  { label: '雨', icon: 'w-rain' },
  { label: '雪', icon: 'w-snow' },
] as const

const MOODS = ['开心', '平静', '元气', '疲惫', '低落']

const NOTE_MAX = 255

function pad(n: number) {
  return n < 10 ? `0${n}` : String(n)
}
function fmt(y: number, m: number, d: number) {
  return `${y}-${pad(m)}-${pad(d)}`
}

const now = new Date()
const TODAY = fmt(now.getFullYear(), now.getMonth() + 1, now.getDate())

const year = ref(now.getFullYear())
const month = ref(now.getMonth() + 1) // 1-based，和 'YYYY-MM' 对齐

const entries = ref<DiaryEntry[]>([])
const loading = ref(false)

const monthKey = computed(() => `${year.value}-${pad(month.value)}`)

/** date → 记录。日历格子查点、面板回填都靠它 */
const byDate = computed(() => {
  const map: Record<string, DiaryEntry> = {}
  for (const e of entries.value) map[e.date] = e
  return map
})

/**
 * 日历格子。前面补 lead 个空格，让 1 号落在正确的星期列。
 * 空格用 day=0 表示，模板里 v-if="cell.day" 判断。
 */
const cells = computed(() => {
  const y = year.value
  const m = month.value
  // new Date(y, m, 0) = 下个月的第 0 天 = 本月最后一天（m 是 1-based，正好错位）
  const total = new Date(y, m, 0).getDate()
  const lead = new Date(y, m - 1, 1).getDay()
  const list: { day: number; date: string; has: boolean; isToday: boolean }[] = []
  for (let i = 0; i < lead; i += 1) list.push({ day: 0, date: '', has: false, isToday: false })
  for (let d = 1; d <= total; d += 1) {
    const date = fmt(y, m, d)
    list.push({ day: d, date, has: !!byDate.value[date], isToday: date === TODAY })
  }
  return list
})

async function loadMonth() {
  loading.value = true
  try {
    entries.value = await apiListDiary(monthKey.value)
  } catch (error) {
    entries.value = []
    if (!isAuthError(error)) {
      uni.showToast({ title: error instanceof Error ? error.message : '加载失败', icon: 'none' })
    }
  } finally {
    loading.value = false
  }
}

function shiftMonth(delta: number) {
  let m = month.value + delta
  let y = year.value
  if (m < 1) {
    m = 12
    y -= 1
  } else if (m > 12) {
    m = 1
    y += 1
  }
  year.value = y
  month.value = m
  loadMonth()
}

function backToday() {
  const changed = year.value !== now.getFullYear() || month.value !== now.getMonth() + 1
  year.value = now.getFullYear()
  month.value = now.getMonth() + 1
  if (changed) loadMonth()
}

/** '2026-08-18' → '08-18 周二'。分量构造，避开 UTC 解析 */
function labelOf(date: string) {
  const parts = date.split('-').map(Number)
  const w = WEEKDAYS[new Date(parts[0], parts[1] - 1, parts[2]).getDay()]
  return `${pad(parts[1])}-${pad(parts[2])} 周${w}`
}

/* ---------- 记录面板 ---------- */

const editing = ref(false)
const editDate = ref('')
const editNote = ref('')
const editWeather = ref('')
const editMood = ref('')
const editOutfitId = ref<number | null>(null)
/** 已有记录才显示「删除」，新建时那个按钮是噪音 */
const editExisting = ref(false)
const saving = ref(false)

/** 可选搭配：只拉已保存的，懒加载一次。拉不到不挡记录，心得照样能写 */
const outfits = ref<Outfit[]>([])
const outfitsLoaded = ref(false)

const noteLen = computed(() => [...editNote.value].length)
const canSave = computed(
  () =>
    !saving.value &&
    (!!editNote.value.trim() || !!editWeather.value || !!editMood.value || editOutfitId.value !== null),
)
const editTitle = computed(() => (editDate.value ? labelOf(editDate.value) : ''))

async function ensureOutfits() {
  if (outfitsLoaded.value) return
  outfitsLoaded.value = true
  try {
    outfits.value = await apiListOutfits(true)
  } catch {
    // 未登录时请求层已经跳登录页了，这里静默
    outfits.value = []
  }
}

function openEditor(date: string) {
  if (!date) return
  const found = byDate.value[date]
  editDate.value = date
  editExisting.value = !!found
  editNote.value = found?.note || ''
  editWeather.value = found?.weather || ''
  editMood.value = found?.mood || ''
  editOutfitId.value = found?.outfitId ?? null
  editing.value = true
  ensureOutfits()
}

function closeEditor() {
  if (saving.value) return
  editing.value = false
}

function pickWeather(label: string) {
  editWeather.value = editWeather.value === label ? '' : label
}
function pickMood(label: string) {
  editMood.value = editMood.value === label ? '' : label
}
function pickOutfit(id: number) {
  editOutfitId.value = editOutfitId.value === id ? null : id
}

async function save() {
  if (!canSave.value) return
  saving.value = true
  try {
    /*
     * 四项全传，不是只传改过的。后端是 PATCH 语义（没传的字段沿用旧值），
     * 只传改动的话，「把天气取消掉」这个操作根本传不出去 —— 旧值会被保留。
     */
    await apiSaveDiary(editDate.value, {
      outfitId: editOutfitId.value,
      note: editNote.value.trim(),
      weather: editWeather.value,
      mood: editMood.value,
    })
    editing.value = false
    uni.showToast({ title: '已记录', icon: 'none' })
    await loadMonth()
  } catch (error) {
    if (!isAuthError(error)) {
      uni.showToast({ title: error instanceof Error ? error.message : '保存失败', icon: 'none' })
    }
  } finally {
    saving.value = false
  }
}

function remove() {
  uni.showModal({
    title: '删除这天的记录？',
    content: `${editTitle.value} 的穿搭记录将被删除`,
    confirmColor: '#ff5c9d',
    success: async (res) => {
      if (!res.confirm) return
      saving.value = true
      try {
        await apiDeleteDiary(editDate.value)
        editing.value = false
        uni.showToast({ title: '已删除', icon: 'none' })
        await loadMonth()
      } catch (error) {
        if (!isAuthError(error)) {
          uni.showToast({ title: error instanceof Error ? error.message : '删除失败', icon: 'none' })
        }
      } finally {
        saving.value = false
      }
    },
  })
}

/** 支持 ?date=YYYY-MM-DD 直接进记录态（情景模拟页那个入口用） */
onLoad(async (query) => {
  const date = String(query?.date || '').trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const parts = date.split('-').map(Number)
    year.value = parts[0]
    month.value = parts[1]
    await loadMonth()
    openEditor(date)
    return
  }
  loadMonth()
})
</script>

<template>
  <view class="page">
    <PageHeader title="穿搭日记" to="/pages/me/me">
      <template #right>
        <view class="today-btn" hover-class="op7" @tap="backToday">今天</view>
      </template>
    </PageHeader>

    <view class="body scroll-y hide-scrollbar">
      <!-- 月份切换 -->
      <view class="month-bar">
        <view class="mb-arrow" hover-class="op7" @tap="shiftMonth(-1)">
          <UiIcon name="chevron-left" :size="36" tone="soft" />
        </view>
        <text class="mb-title">{{ year }} 年 {{ month }} 月</text>
        <view class="mb-arrow" hover-class="op7" @tap="shiftMonth(1)">
          <UiIcon name="chevron-right" :size="36" tone="soft" />
        </view>
      </view>

      <!-- 日历 -->
      <view class="cal">
        <view class="cal-week">
          <text v-for="w in WEEKDAYS" :key="w" class="cw">{{ w }}</text>
        </view>
        <view class="cal-grid">
          <view
            v-for="(cell, i) in cells"
            :key="i"
            class="cal-cell"
            :class="{ blank: !cell.day, today: cell.isToday }"
            :hover-class="cell.day ? 'op7' : 'none'"
            @tap="openEditor(cell.date)"
          >
            <text v-if="cell.day" class="cd">{{ cell.day }}</text>
            <view v-if="cell.has" class="dot" />
          </view>
        </view>
        <view class="cal-tip">点任意一天记录当天穿搭，带小点的是已有记录</view>
      </view>

      <!-- 本月记录 -->
      <view class="sec">
        <text class="sec-t">本月记录</text>
        <text class="sec-n">{{ entries.length }} 天</text>
      </view>

      <view v-if="loading" class="empty">加载中...</view>
      <view v-else-if="!entries.length" class="empty">
        <UiIcon name="book" :size="72" tone="light" />
        <text class="empty-t">这个月还没有记录</text>
        <text class="empty-s">点上面日历里的任意一天开始写</text>
      </view>

      <view v-else class="list">
        <view v-for="e in entries" :key="e.date" class="row" hover-class="op7" @tap="openEditor(e.date)">
          <view class="row-date">
            <text class="rd-d">{{ e.date.slice(8) }}</text>
            <text class="rd-w">{{ labelOf(e.date).slice(-2) }}</text>
          </view>
          <view class="row-main">
            <view class="row-tags">
              <text v-if="e.weather" class="tag">{{ e.weather }}</text>
              <text v-if="e.mood" class="tag tag-mood">{{ e.mood }}</text>
              <text v-if="e.outfitTitle" class="tag tag-fit">{{ e.outfitTitle }}</text>
            </view>
            <text v-if="e.note" class="row-note">{{ e.note }}</text>
            <text v-else class="row-note row-note-empty">（没写心得）</text>
          </view>
          <UiIcon name="chevron-right" :size="32" tone="light" />
        </view>
      </view>
    </view>

    <!-- 记录面板：做成弹层而不是单独一页，省一个 pages.json 条目，也省一次跳转 -->
    <view v-if="editing" class="mask" @tap="closeEditor" />
    <view v-if="editing" class="sheet">
      <view class="sh-head">
        <text class="sh-title">{{ editTitle }}</text>
        <view class="sh-close" hover-class="op7" @tap="closeEditor">
          <UiIcon name="close" :size="34" tone="muted" />
        </view>
      </view>

      <view class="sh-body scroll-y hide-scrollbar">
        <view class="f-label">天气</view>
        <view class="chips">
          <view
            v-for="w in WEATHERS"
            :key="w.label"
            class="chip"
            :class="{ on: editWeather === w.label }"
            hover-class="op7"
            @tap="pickWeather(w.label)"
          >
            <UiIcon :name="w.icon" :size="30" :tone="editWeather === w.label ? 'brand' : 'muted'" />
            <text class="chip-t">{{ w.label }}</text>
          </view>
        </view>

        <view class="f-label">心情</view>
        <view class="chips">
          <view
            v-for="m in MOODS"
            :key="m"
            class="chip"
            :class="{ on: editMood === m }"
            hover-class="op7"
            @tap="pickMood(m)"
          >
            <text class="chip-t">{{ m }}</text>
          </view>
        </view>

        <view class="f-label">今天穿的</view>
        <!--
          scroll-view 不能是 flex 容器（小程序端 display:flex 会让它失去横向滚动），
          所以用 white-space:nowrap + 子项 inline-block。
        -->
        <scroll-view v-if="outfits.length" class="fit-scroll" scroll-x :show-scrollbar="false">
          <view
            v-for="o in outfits"
            :key="o.id"
            class="fit"
            :class="{ on: editOutfitId === o.id }"
            hover-class="op7"
            @tap="pickOutfit(o.id)"
          >
            <text class="fit-t">{{ o.title || '未命名搭配' }}</text>
            <text class="fit-s">{{ o.scene || `${o.items.length} 件` }}</text>
          </view>
        </scroll-view>
        <view v-else class="fit-empty">衣橱里还没有已保存的搭配，先去「自由搭配」存一套</view>

        <view class="f-label">心得</view>
        <textarea
          v-model="editNote"
          class="area"
          :maxlength="NOTE_MAX"
          placeholder="今天这身怎么样？记一句"
          placeholder-class="ph"
        />
        <view class="counter">{{ noteLen }}/{{ NOTE_MAX }}</view>
      </view>

      <view class="sh-foot">
        <view v-if="editExisting" class="btn-del" hover-class="op7" @tap="remove">
          <UiIcon name="trash" :size="32" tone="muted" />
        </view>
        <view class="btn-save" :class="{ disabled: !canSave }" hover-class="op7" @tap="save">
          {{ saving ? '保存中...' : '保存' }}
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.body {
  flex: 1;
  min-height: 0;
  padding: 12rpx 32rpx 48rpx;
}
.op7 {
  opacity: 0.7;
}

.today-btn {
  padding: 8rpx 22rpx;
  border-radius: var(--radius-pill);
  background: #f3f4f6;
  font-size: 24rpx;
  color: var(--text-2);
}

/* 月份切换 */
.month-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 32rpx;
  padding: 16rpx 0 20rpx;
}
.mb-arrow {
  width: 60rpx;
  height: 60rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--surface);
  box-shadow: var(--shadow-card);
}
.mb-title {
  min-width: 220rpx;
  text-align: center;
  font-size: 30rpx;
  font-weight: 500;
  color: var(--text-1);
}

/* 日历 */
.cal {
  padding: 20rpx 16rpx 16rpx;
  border-radius: var(--radius-lg);
  background: var(--surface);
  box-shadow: var(--shadow-card);
}
.cal-week {
  display: flex;
}
.cw {
  flex: 1;
  text-align: center;
  font-size: 22rpx;
  color: var(--text-3);
}
.cal-grid {
  display: flex;
  flex-wrap: wrap;
  margin-top: 8rpx;
}
.cal-cell {
  /* 7 列。用百分比而不是 grid：小程序低版本基础库对 grid 支持不全 */
  width: 14.28%;
  height: 84rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.cal-cell.blank {
  /* 占位格不响应点击 */
  pointer-events: none;
}
.cd {
  font-size: 26rpx;
  color: var(--text-1);
  line-height: 1;
}
.cal-cell.today .cd {
  width: 46rpx;
  height: 46rpx;
  line-height: 46rpx;
  text-align: center;
  border-radius: 50%;
  background: var(--brand-gradient);
  color: #fff;
}
.dot {
  width: 8rpx;
  height: 8rpx;
  margin-top: 6rpx;
  border-radius: 50%;
  background: var(--pink-deep);
}
.cal-tip {
  margin-top: 12rpx;
  text-align: center;
  font-size: 20rpx;
  color: var(--text-3);
}

/* 列表 */
.sec {
  display: flex;
  align-items: baseline;
  gap: 12rpx;
  margin: 36rpx 0 16rpx;
}
.sec-t {
  font-size: 28rpx;
  font-weight: 500;
  color: var(--text-1);
}
.sec-n {
  font-size: 22rpx;
  color: var(--text-3);
}

.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10rpx;
  padding: 64rpx 0;
  font-size: 24rpx;
  color: var(--text-3);
}
.empty-t {
  font-size: 26rpx;
  color: var(--text-2);
}
.empty-s {
  font-size: 22rpx;
  color: var(--text-3);
}

.list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}
.row {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 22rpx 24rpx;
  border-radius: var(--radius);
  background: var(--surface);
  box-shadow: var(--shadow-card);
}
.row-date {
  flex-shrink: 0;
  width: 76rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.rd-d {
  font-size: 34rpx;
  font-weight: 500;
  color: var(--pink-deep);
  line-height: 1.1;
}
.rd-w {
  font-size: 20rpx;
  color: var(--text-3);
}
.row-main {
  flex: 1;
  min-width: 0;
}
.row-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
}
.tag {
  padding: 2rpx 14rpx;
  border-radius: var(--radius-pill);
  background: #f3f4f6;
  font-size: 20rpx;
  color: var(--text-2);
}
.tag-mood {
  background: #fff2f7;
  color: #b82a5f;
}
.tag-fit {
  background: #eef7f3;
  color: #0f7a58;
  max-width: 300rpx;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.row-note {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  color: var(--text-2);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.row-note-empty {
  color: var(--text-4);
}

/* 记录面板 */
.mask {
  position: fixed;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 90;
}
.sheet {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 91;
  max-height: 78vh;
  display: flex;
  flex-direction: column;
  border-radius: 28rpx 28rpx 0 0;
  background: #fff;
  padding-bottom: env(safe-area-inset-bottom);
}
.sh-head {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28rpx 32rpx 8rpx;
}
.sh-title {
  font-size: 30rpx;
  font-weight: 500;
  color: var(--text-1);
}
.sh-close {
  width: 56rpx;
  height: 56rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}
.sh-body {
  flex: 1;
  min-height: 0;
  padding: 0 32rpx 8rpx;
}

.f-label {
  margin: 22rpx 0 12rpx;
  font-size: 24rpx;
  font-weight: 500;
  color: var(--text-1);
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 14rpx;
}
.chip {
  display: flex;
  align-items: center;
  gap: 6rpx;
  padding: 12rpx 22rpx;
  border-radius: var(--radius-pill);
  background: #f3f4f6;
  /* 未选中也留一圈同宽透明边，选中时才不会把整格顶大 */
  border: 2rpx solid transparent;
}
.chip.on {
  background: #fff2f7;
  border-color: var(--pink-deep);
}
.chip-t {
  font-size: 24rpx;
  color: var(--text-2);
}
.chip.on .chip-t {
  color: #b82a5f;
}

.fit-scroll {
  white-space: nowrap;
}
.fit {
  display: inline-block;
  width: 240rpx;
  margin-right: 16rpx;
  padding: 18rpx 20rpx;
  border-radius: var(--radius);
  background: #f3f4f6;
  border: 2rpx solid transparent;
  vertical-align: top;
  box-sizing: border-box;
}
.fit.on {
  background: #fff2f7;
  border-color: var(--pink-deep);
}
.fit-t {
  display: block;
  font-size: 25rpx;
  color: var(--text-1);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.fit-s {
  display: block;
  margin-top: 4rpx;
  font-size: 20rpx;
  color: var(--text-3);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.fit-empty {
  padding: 20rpx;
  border-radius: var(--radius);
  background: #f3f4f6;
  font-size: 22rpx;
  color: var(--text-3);
}

.area {
  width: 100%;
  height: 160rpx;
  padding: 20rpx;
  border-radius: var(--radius);
  background: #f3f4f6;
  font-size: 25rpx;
  color: var(--text-1);
  box-sizing: border-box;
}
.ph {
  color: var(--text-4);
}
.counter {
  margin-top: 8rpx;
  text-align: right;
  font-size: 20rpx;
  color: var(--text-3);
}

.sh-foot {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 16rpx 32rpx 28rpx;
}
.btn-del {
  width: 92rpx;
  height: 88rpx;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-pill);
  background: #f3f4f6;
}
.btn-save {
  flex: 1;
  height: 88rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-pill);
  background: var(--brand-gradient);
  color: #fff;
  font-size: 28rpx;
  font-weight: 500;
  box-shadow: var(--shadow-float);
}
.btn-save.disabled {
  opacity: 0.5;
}

.hide-scrollbar::-webkit-scrollbar {
  display: none;
}
</style>
