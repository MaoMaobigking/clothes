<script setup lang="ts">
import setting from '@/setting'
import { nextTick, ref } from 'vue'
import { sendChat, type ChatMessage } from '@/api/ai'

interface Msg extends ChatMessage {
  id: number
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

async function send(text?: string) {
  const content = (text ?? input.value).trim()
  if (!content || loading.value) return
  messages.value.push({ id: uid++, role: 'user', content })
  input.value = ''
  loading.value = true
  scrollToBottom()
  try {
    const history = messages.value.map((m) => ({ role: m.role, content: m.content }))
    const reply = await sendChat(history)
    messages.value.push({ id: uid++, role: 'assistant', content: reply || '（AI 没有返回内容）' })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    messages.value.push({
      id: uid++,
      role: 'assistant',
      content: `没连上 AI：${msg}\n请在 .env 里填好 key，并用 npm run dev:all 启动后端。`,
    })
  } finally {
    loading.value = false
    scrollToBottom()
  }
}
</script>

<template>
  <view class="page">
    <PageHeader title="AI 穿搭顾问" to="/pages/home/home" :sub="`${setting.name} · ${setting.slogan}`" />

    <scroll-view scroll-y :scroll-top="scrollTop" class="chat hide-scrollbar">
      <view v-for="m in messages" :key="m.id" class="row" :class="m.role">
        <UiIcon v-if="m.role === 'assistant'" class="avatar" name="robot" :size="40" tone="purple" />
        <view class="bubble">{{ m.content }}</view>
      </view>
      <view v-if="loading" class="row assistant">
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

    <!-- 输入栏 -->
    <view class="composer">
      <input v-model="input" class="input" placeholder="问问今天穿什么…" :disabled="loading" @confirm="send()" />
      <view class="send btn btn-primary" :class="{ 'btn-disabled': loading || !input.trim() }" @tap="send()">发送</view>
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
  max-width: 76%;
  padding: 20rpx 28rpx;
  font-size: 28rpx;
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
  font-size: 26rpx;
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
  font-size: 30rpx;
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
</style>
