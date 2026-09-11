<script setup lang="ts">
/*
 * 工具调用过程的步骤条（批次 3.2）。
 *
 * 折叠时只显示一行「正在查你的衣橱…」，展开能看到每一轮调了什么、传了什么参数、
 * 返回了什么摘要。
 *
 * ── 为什么值得做 ──
 * tool-calling 这条路一次对话最多 5 轮往返，实测 prompt token 是普通对话的 20 倍，
 * 时间上也是好几秒。这几秒里如果只有一个转圈，用户不知道它是在干活还是卡死了。
 * 把过程摊开之后，等待从「无法解释的延迟」变成「看得见的步骤」。
 *
 * ── 数据从哪来 ──
 * 后端每轮推两条事件：执行前 tool_start（带入参），执行后 tool_end（带结果摘要）。
 * 这里按 round + name 把两条合并成一行，用 tool_end 有没有到来判断这一步完没完。
 */
import { computed } from 'vue'
import type { ToolStep } from '@/api/ai'
import { activateOnKey } from '@/utils/a11y'

const props = defineProps<{
  steps: ToolStep[]
  /** 展开状态由父组件管（同一条消息里只有一个步骤条，状态放这儿没必要） */
  expanded: boolean
}>()

const emit = defineEmits<{ toggle: [] }>()

/** 工具名 → 人话。没收录的就显示原名，不编 */
const TOOL_LABELS: Record<string, string> = {
  list_wardrobe: '查你的衣橱',
  get_weather: '查天气',
  get_profile: '看你的画像',
  remember_preference: '记下你的偏好',
}

interface MergedStep {
  key: string
  round: number
  name: string
  label: string
  args?: Record<string, unknown>
  summary?: string
  /** tool_end 还没到 = 这一步还在跑 */
  running: boolean
}

const merged = computed<MergedStep[]>(() => {
  const map = new Map<string, MergedStep>()
  for (const s of props.steps) {
    /*
     * 同一轮里同名工具可能被调用多次（模型一次要了两个城市的天气）。
     * 光用 round+name 做 key 会把它们叠成一条，所以 tool_start 来一条就新建一条，
     * tool_end 去补**最后一条还没结束的**同名步骤。
     */
    if (s.type === 'tool_start') {
      const key = `${s.round}-${s.name}-${map.size}`
      map.set(key, {
        key,
        round: s.round,
        name: s.name,
        label: TOOL_LABELS[s.name] || s.name,
        args: s.args,
        running: true,
      })
      continue
    }
    const pending = [...map.values()].reverse().find((m) => m.round === s.round && m.name === s.name && m.running)
    if (pending) {
      pending.summary = s.summary
      pending.running = false
    }
  }
  return [...map.values()]
})

/** 折叠时那一行摘要：优先显示正在跑的那个，全跑完了就报总数 */
const headline = computed(() => {
  const running = merged.value.find((m) => m.running)
  if (running) return `正在${running.label}…`
  if (merged.value.length === 0) return ''
  const rounds = Math.max(...merged.value.map((m) => m.round))
  return `已调用 ${merged.value.length} 个工具，共 ${rounds} 轮`
})

const anyRunning = computed(() => merged.value.some((m) => m.running))

function fmtArgs(args?: Record<string, unknown>) {
  if (!args || Object.keys(args).length === 0) return '无参数'
  return Object.entries(args)
    .map(([k, v]) => `${k}=${typeof v === 'string' ? v : JSON.stringify(v)}`)
    .join('，')
}

const onToggleKey = activateOnKey(() => emit('toggle'))
</script>

<template>
  <view v-if="merged.length" class="steps">
    <view
      class="steps-head"
      role="button"
      tabindex="0"
      :aria-expanded="expanded ? 'true' : 'false'"
      :aria-label="expanded ? '收起工具调用过程' : '展开工具调用过程'"
      @keydown="onToggleKey"
      @tap="emit('toggle')"
    >
      <!-- 跑动时是个转圈，跑完变成对勾 —— 不用颜色单独承载状态（色盲也要能分辨） -->
      <text class="steps-dot" :class="{ running: anyRunning }" aria-hidden="true">{{ anyRunning ? '◐' : '✓' }}</text>
      <text class="steps-title">{{ headline }}</text>
      <text class="steps-arrow" :class="{ open: expanded }" aria-hidden="true">›</text>
    </view>

    <view v-if="expanded" class="steps-body">
      <view v-for="m in merged" :key="m.key" class="step">
        <text class="step-round">第 {{ m.round }} 轮</text>
        <view class="step-main">
          <text class="step-name">
            {{ m.label }}
            <text class="step-raw">· {{ m.name }}</text>
          </text>
          <text class="step-args">入参：{{ fmtArgs(m.args) }}</text>
          <text v-if="m.running" class="step-pending">执行中…</text>
          <text v-else class="step-summary">返回：{{ m.summary || '（空）' }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.steps {
  margin-bottom: 12rpx;
  overflow: hidden;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius-md, 16rpx);
}

.steps-head {
  display: flex;
  gap: 12rpx;
  align-items: center;
  padding: 16rpx 20rpx;
}

.steps-dot {
  flex-shrink: 0;
  font-size: var(--fs-md);
  color: var(--text-2);
}

.steps-dot.running {
  animation: spin 1.2s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.steps-title {
  flex: 1;
  font-size: var(--fs-sm, 24rpx);
  color: var(--text-2);
}

.steps-arrow {
  flex-shrink: 0;
  font-size: var(--fs-lg);
  color: var(--text-3);
  transition: transform 0.2s;
}

.steps-arrow.open {
  transform: rotate(90deg);
}

.steps-body {
  padding: 0 20rpx 16rpx;
  border-top: 1px solid var(--line);
}

.step {
  display: flex;
  gap: 16rpx;
  padding: 16rpx 0;
}

.step + .step {
  border-top: 1px dashed var(--line);
}

.step-round {
  flex-shrink: 0;
  font-size: var(--fs-sm, 24rpx);
  color: var(--text-3);
}

.step-main {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 6rpx;
  min-width: 0;
}

.step-name {
  font-size: var(--fs-md);
  font-weight: 500;
  color: var(--text-1);
}

.step-raw {
  font-size: var(--fs-sm, 24rpx);
  font-weight: 400;
  color: var(--text-3);
}

.step-args,
.step-summary,
.step-pending {
  font-size: var(--fs-sm, 24rpx);
  line-height: 1.5;
  color: var(--text-2);
  word-break: break-all;
}

.step-pending {
  color: var(--text-3);
}
</style>
