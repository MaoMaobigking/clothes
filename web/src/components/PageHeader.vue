<script setup lang="ts">
import { useRouter } from 'vue-router'

const props = withDefaults(
  defineProps<{
    title: string
    /** 返回目标路由；不传则 router.back() */
    to?: string
    sub?: string
  }>(),
  { to: '', sub: '' },
)

const router = useRouter()

function back() {
  if (props.to) router.push(props.to)
  else router.back()
}
</script>

<template>
  <header class="ph">
    <button class="back" aria-label="返回" @click="back">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path
          d="M15 18l-6-6 6-6"
          stroke="currentColor"
          stroke-width="2.2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </button>
    <div class="mid">
      <h1 class="title">{{ title }}</h1>
      <p v-if="sub" class="sub">{{ sub }}</p>
    </div>
    <div class="right">
      <slot name="right" />
    </div>
  </header>
</template>

<style scoped>
.ph {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: calc(env(safe-area-inset-top, 12px) + 10px) 16px 10px;
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
  flex-shrink: 0;
}
.mid {
  flex: 1;
  text-align: center;
  overflow: hidden;
}
.title {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
  color: var(--text-1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sub {
  margin: 2px 0 0;
  font-size: 12px;
  color: var(--text-2);
}
.right {
  min-width: 36px;
  display: flex;
  justify-content: flex-end;
}
</style>
