<script setup lang="ts">
import { nextTick, ref } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import { sendChat, type ChatMessage } from '@/api/ai'

interface Msg extends ChatMessage {
  id: number
}

let uid = 1
const messages = ref<Msg[]>([
  {
    id: 0,
    role: 'assistant',
    content: '嗨，我是你的 AI 穿搭顾问「灵犀」～ 想问什么都可以，比如「约会穿什么」「小个子怎么显高」。',
  },
])
const input = ref('')
const loading = ref(false)
const listEl = ref<HTMLDivElement>()

const quick = ['约会穿什么？', '小个子怎么显高？', '通勤怎么穿显气质？', '这周降温怎么搭？']

function scrollToBottom() {
  nextTick(() => {
    if (listEl.value) listEl.value.scrollTop = listEl.value.scrollHeight
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
      content: `⚠️ 没连上 AI：${msg}\n请在 .env 里填好 key，并用 npm run dev:all 启动后端。`,
    })
  } finally {
    loading.value = false
    scrollToBottom()
  }
}
</script>

<template>
  <div class="page">
    <PageHeader title="AI 穿搭顾问" to="/home" sub="灵犀 · 你的私人穿搭助手" />

    <div ref="listEl" class="chat scroll-y hide-scrollbar">
      <div v-for="m in messages" :key="m.id" class="row" :class="m.role">
        <span v-if="m.role === 'assistant'" class="avatar">🤖</span>
        <div class="bubble">{{ m.content }}</div>
      </div>
      <div v-if="loading" class="row assistant">
        <span class="avatar">🤖</span>
        <div class="bubble typing"><span></span><span></span><span></span></div>
      </div>
    </div>

    <!-- 快捷问题 -->
    <div class="quick hide-scrollbar">
      <button v-for="q in quick" :key="q" class="q" @click="send(q)">{{ q }}</button>
    </div>

    <!-- 输入栏 -->
    <div class="composer">
      <input
        v-model="input"
        class="input"
        placeholder="问问今天穿什么…"
        @keyup.enter="send()"
      />
      <button class="send btn btn-primary" :disabled="loading || !input.trim()" @click="send()">
        发送
      </button>
    </div>
  </div>
</template>

<style scoped>
.page {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.chat {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 8px 16px 4px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.row {
  display: flex;
  gap: 8px;
  align-items: flex-end;
  max-width: 100%;
}
.row.user {
  flex-direction: row-reverse;
}
.avatar {
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-size: 18px;
  background: var(--surface);
  box-shadow: var(--shadow-card);
}
.bubble {
  max-width: 76%;
  padding: 10px 14px;
  border-radius: 18px;
  font-size: 14px;
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
}
.row.assistant .bubble {
  background: var(--surface);
  color: var(--text-1);
  border-bottom-left-radius: 4px;
  box-shadow: var(--shadow-card);
}
.row.user .bubble {
  background: var(--brand-gradient);
  color: #fff;
  border-bottom-right-radius: 4px;
}

.typing {
  display: flex;
  gap: 4px;
  align-items: center;
}
.typing span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--text-3);
  animation: blink 1.2s infinite both;
}
.typing span:nth-child(2) {
  animation-delay: 0.2s;
}
.typing span:nth-child(3) {
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
  flex-shrink: 0;
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 8px 16px;
}
.q {
  flex-shrink: 0;
  padding: 8px 14px;
  border-radius: 999px;
  background: var(--surface);
  box-shadow: var(--shadow-card);
  color: var(--purple-deep);
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
}

.composer {
  flex-shrink: 0;
  display: flex;
  gap: 10px;
  padding: 8px 16px calc(12px + var(--safe-bottom));
  background: rgba(255, 255, 255, 0.7);
  border-top: 1px solid var(--line);
}
.input {
  flex: 1;
  height: 46px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--line);
  background: #fff;
  padding: 0 18px;
  font-size: 15px;
  outline: none;
}
.input:focus {
  border-color: var(--pink);
}
.send {
  height: 46px;
  padding: 0 20px;
  flex-shrink: 0;
}
</style>
