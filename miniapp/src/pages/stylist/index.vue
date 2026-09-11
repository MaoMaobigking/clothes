<script setup lang="ts">
import setting from '@/setting'
import { nextTick, onUnmounted, ref } from 'vue'
import {
  SUPPORTS_CHAT_STREAM,
  sendChat,
  streamChat,
  streamChatWithTools,
  type ChatMessage,
  type ToolStep,
} from '@/api/ai'
import { activateOnKey } from '@/utils/a11y'

interface Msg extends ChatMessage {
  id: number
  /** 正在流式接收中：此时气泡显示光标，且不允许再发下一条 */
  streaming?: boolean
  /** 工具调用过程（批次 3）。只有开了工具模式的那几条消息有 */
  steps?: ToolStep[]
  /** 步骤条是否展开 */
  stepsOpen?: boolean
}

let uid = 1
const messages = ref<Msg[]>([
  {
    id: 0,
    role: 'assistant',
    content: `嗨，我是你的 AI 穿搭顾问「${setting.name}」～ 想问什么都可以，比如「约会穿什么」「小个子怎么显高」。`,
  },
])
const input = ref('')
const loading = ref(false)
const scrollTop = ref(0)

/*
 * 续聊的会话号。以前每轮都不带它，服务端 ensureSession 只好每条消息新建一个会话，
 * 聊十句在库里就是十个会话 —— 会话列表那个接口等于废了。存住它才是「一次对话」。
 */
const sessionId = ref<number | undefined>(undefined)

/** 正在进行的这一轮流式请求，用户点停止时 abort 它 */
let controller: AbortController | null = null

/*
 * 工具模式（批次 3）。开了走 /chat/tools —— 模型可以查衣橱、天气、画像再回答。
 *
 * 默认关闭，理由是实测成本：tool-calling 的 prompt token 是普通对话的 **20 倍**
 * （1055 vs 53，因为工具定义和上一轮结果每轮都要重发），一次对话最多 5 次往返。
 * 默认开就是默认按 20 倍烧钱，而大部分问题（「约会穿什么」）根本不需要查衣橱。
 */
const toolMode = ref(false)
const onToolModeKey = activateOnKey(
  () => (toolMode.value = !toolMode.value),
  () => loading.value,
)

const quick = ['约会穿什么？', '小个子怎么显高？', '通勤怎么穿显气质？', '这周降温怎么搭？']

function scrollToBottom() {
  nextTick(() => {
    // scroll-view 设置足够大的值强制滚动到底部
    scrollTop.value = scrollTop.value === 0 ? 1 : 0
    nextTick(() => {
      scrollTop.value = 99999
    })
  })
}

/** 停止生成。abort 会关掉连接，服务端监听到 close 后中止模型调用 —— 不是前端自己假装停 */
function stop() {
  controller?.abort()
}

/*
 * 离开页面也要停。否则用户返回上一页，这边还在流式接收，
 * 后端也还在为一个没人看的回答付钱。
 */
onUnmounted(stop)

async function send(text?: string) {
  const content = (text ?? input.value).trim()
  if (!content || loading.value) return
  messages.value.push({ id: uid++, role: 'user', content })
  input.value = ''
  loading.value = true
  scrollToBottom()

  const history = messages.value.map((m) => ({ role: m.role, content: m.content }))

  try {
    if (SUPPORTS_CHAT_STREAM) {
      await sendStreaming(history)
    } else {
      // 小程序端：接口拿不到中间分片，退回一次性返回
      const res = await sendChat(history, sessionId.value)
      if (res.sessionId) sessionId.value = res.sessionId
      messages.value.push({ id: uid++, role: 'assistant', content: res.reply || '（AI 没有返回内容）' })
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    messages.value.push({
      id: uid++,
      role: 'assistant',
      content: `没连上 AI：${msg}\n请在 .env 里填好 key，并用 npm run dev:all 启动后端。`,
    })
  } finally {
    loading.value = false
    controller = null
    scrollToBottom()
  }
}

async function sendStreaming(history: ChatMessage[]) {
  // 先放一个空气泡，让逐字输出有地方落
  const bubble: Msg = { id: uid++, role: 'assistant', content: '', streaming: true }
  // 工具模式下步骤条默认展开一次：第一次用的人得看见它在干什么，才知道这个开关有什么用
  if (toolMode.value) {
    bubble.steps = []
    bubble.stepsOpen = true
  }
  messages.value.push(bubble)

  controller = new AbortController()
  const call = toolMode.value ? streamChatWithTools : streamChat
  try {
    const result = await call({
      messages: history,
      sessionId: sessionId.value,
      signal: controller.signal,
      onSession: (id) => (sessionId.value = id),
      onStep: (step) => {
        // 只有 /chat/tools 会推。数组是在上面建好的，这里直接追加
        bubble.steps?.push(step)
        scrollToBottom()
      },
      onDelta: (delta) => {
        bubble.content += delta
        scrollToBottom()
      },
    })
    /*
     * 用最终全文覆盖一次拼出来的内容：服务端的 fullText 是权威值。
     * 中途停止时保留已生成的部分 —— 那是有效内容，不该被清掉。
     */
    if (result.text) bubble.content = result.text
    if (!bubble.content) {
      bubble.content = result.aborted ? '（已停止）' : '（AI 没有返回内容）'
    }
  } catch (err) {
    // 一个字都没吐出来、也没有任何步骤时，空气泡留着没意义，撤掉让外层统一报错
    if (!bubble.content && !bubble.steps?.length) {
      messages.value = messages.value.filter((m) => m.id !== bubble.id)
    }
    throw err
  } finally {
    bubble.streaming = false
  }
}
</script>

<template>
  <view class="page">
    <PageHeader title="AI 穿搭顾问" to="/pages/home/home" :sub="`${setting.name} · ${setting.slogan}`" />

    <scroll-view scroll-y :scroll-top="scrollTop" class="chat hide-scrollbar">
      <view v-for="m in messages" :key="m.id" class="row" :class="m.role">
        <UiIcon v-if="m.role === 'assistant'" class="avatar" name="robot" :size="40" tone="purple" />
        <view class="col">
          <!-- 工具调用过程摆在气泡上方：它发生在回答之前，顺序要和时间一致 -->
          <ToolSteps
            v-if="m.steps?.length"
            :steps="m.steps"
            :expanded="!!m.stepsOpen"
            @toggle="m.stepsOpen = !m.stepsOpen"
          />
          <view v-if="m.content || !m.steps?.length" class="bubble" :class="{ streaming: m.streaming }">
            {{ m.content }}
          </view>
        </view>
      </view>
      <!-- 只在「还没有任何字吐出来」时显示打字动画；开始流式之后气泡自己会动 -->
      <view v-if="loading && !messages[messages.length - 1]?.streaming" class="row assistant">
        <UiIcon class="avatar" name="robot" :size="40" tone="purple" />
        <view class="bubble typing">
          <text></text>
          <text></text>
          <text></text>
        </view>
      </view>
    </scroll-view>

    <!-- 快捷问题 -->
    <view class="quick hide-scrollbar">
      <view v-for="q in quick" :key="q" class="q" @tap="send(q)">{{ q }}</view>
    </view>

    <!--
      工具模式开关。只在 H5 出现 —— 小程序端整条流式链路都走不通（见 SUPPORTS_CHAT_STREAM），
      过程事件自然也收不到，摆个开关只会让人以为坏了。
    -->
    <view v-if="SUPPORTS_CHAT_STREAM" class="toolbar">
      <view
        class="tool-toggle"
        :class="{ on: toolMode, 'btn-disabled': loading }"
        role="switch"
        :tabindex="loading ? -1 : 0"
        :aria-checked="toolMode ? 'true' : 'false'"
        aria-label="工具模式：让 AI 查衣橱和天气后再回答"
        @keydown="onToolModeKey"
        @tap="!loading && (toolMode = !toolMode)"
      >
        <text class="tool-dot" :class="{ on: toolMode }" aria-hidden="true"></text>
        <text>查衣橱和天气再回答</text>
      </view>
      <text class="tool-hint">{{ toolMode ? '会多花几秒，但建议更贴你' : '关闭时直接回答，更快' }}</text>
    </view>

    <!-- 输入栏 -->
    <view class="composer">
      <input v-model="input" class="input" placeholder="问问今天穿什么…" :disabled="loading" @confirm="send()" />
      <view v-if="loading && SUPPORTS_CHAT_STREAM" class="send btn btn-stop" @tap="stop">停止</view>
      <view v-else class="send btn btn-primary" :class="{ 'btn-disabled': loading || !input.trim() }" @tap="send()">
        发送
      </view>
    </view>
  </view>
</template>

<style scoped>
.chat {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 28rpx;
  min-height: 0;
  padding: 16rpx 32rpx 8rpx;
  overflow-y: auto;
}

.row {
  display: flex;
  gap: 16rpx;
  align-items: flex-end;
  max-width: 100%;
}

.row.user {
  flex-direction: row-reverse;
}

/* 气泡和步骤条的竖排容器。宽度限制从 .bubble 挪到这里，好让步骤条也跟着收窄 */
.col {
  display: flex;
  flex-direction: column;
  min-width: 0;
  max-width: 76%;
}

.row.user .col {
  align-items: flex-end;
}

.avatar {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: 64rpx;
  height: 64rpx;
  font-size: 36rpx;
  background: var(--surface);
  border-radius: 50%;
  box-shadow: var(--shadow-card);
}

.bubble {
  max-width: 100%;
  padding: 20rpx 28rpx;
  font-size: var(--fs-lg);
  line-height: 1.55;
  word-break: break-word;
  white-space: pre-wrap;
  border-radius: var(--radius-lg);
}

.row.assistant .bubble {
  color: var(--text-1);
  background: var(--surface);
  border-bottom-left-radius: 8rpx;
  box-shadow: var(--shadow-card);
}

.row.user .bubble {
  color: #fff;
  background: var(--brand-gradient);
  border-bottom-right-radius: 8rpx;
}

/* 流式接收中：末尾接一个闪烁光标，告诉用户还在写而不是卡住了 */
.bubble.streaming::after {
  display: inline-block;
  width: 3rpx;
  height: 1em;
  vertical-align: text-bottom;
  content: '';
  background: var(--text-2);
  animation: caret 1s step-end infinite;
}

@keyframes caret {
  50% {
    opacity: 0;
  }
}

.typing {
  display: flex;
  gap: 8rpx;
  align-items: center;
}

.typing text {
  width: 12rpx;
  height: 12rpx;
  background: var(--text-3);
  border-radius: 50%;
  animation: blink 1.2s infinite both;
}

.typing text:nth-child(2) {
  animation-delay: 0.2s;
}

.typing text:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes blink {
  0%,
  80%,
  100% {
    opacity: 0.25;
  }

  40% {
    opacity: 1;
  }
}

.quick {
  display: flex;
  flex-shrink: 0;
  gap: 16rpx;
  padding: 16rpx 32rpx;
  overflow-x: auto;
}

.q {
  flex-shrink: 0;
  padding: 16rpx 28rpx;
  font-size: var(--fs-md);
  font-weight: 500;
  color: var(--purple-deep);
  white-space: nowrap;
  background: var(--surface);
  border-radius: var(--radius-pill);
  box-shadow: var(--shadow-card);
}

.composer {
  display: flex;
  flex-shrink: 0;
  gap: 20rpx;
  padding: 16rpx 32rpx calc(24rpx + env(safe-area-inset-bottom, 0px));
  background: rgb(255 255 255 / 70%);
  border-top: 1px solid var(--line);
}

.input {
  flex: 1;
  height: 92rpx;
  padding: 0 36rpx;
  font-size: var(--fs-xl);
  outline: none;
  background: #fff;
  border: 1px solid var(--line);
  border-radius: var(--radius-pill);
}

.input:focus {
  border-color: var(--pink);
}

.send {
  flex-shrink: 0;
  height: 92rpx;
  padding: 0 40rpx;
}

.btn-disabled {
  pointer-events: none;
  opacity: 0.5;
}

.btn-stop {
  display: grid;
  place-items: center;
  color: var(--text-1);
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius-pill);
}

/* 工具模式开关 */
.toolbar {
  display: flex;
  flex-shrink: 0;
  gap: 16rpx;
  align-items: center;
  padding: 0 32rpx 8rpx;
}

.tool-toggle {
  display: flex;
  gap: 12rpx;
  align-items: center;
  padding: 10rpx 24rpx;
  font-size: var(--fs-sm, 24rpx);
  color: var(--text-2);
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius-pill);
}

.tool-toggle.on {
  color: var(--text-1);
  border-color: var(--text-2);
}

/*
 * 状态点。开启时除了变色还**加粗描边** —— 只靠颜色区分开关状态过不了
 * WCAG 1.4.1（不能把颜色作为唯一的信息载体），色觉障碍用户看不出来。
 */
.tool-dot {
  width: 16rpx;
  height: 16rpx;
  background: transparent;
  border: 2rpx solid var(--text-3);
  border-radius: 50%;
}

.tool-dot.on {
  background: var(--text-1);
  border-color: var(--text-1);
  box-shadow: 0 0 0 3rpx var(--line);
}

.tool-hint {
  flex: 1;
  font-size: var(--fs-sm, 24rpx);
  color: var(--text-3);
}
</style>
