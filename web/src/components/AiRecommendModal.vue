<script setup lang="ts">
defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  (e: 'view'): void
  (e: 'close'): void
}>()
</script>

<template>
  <transition name="modal">
    <div v-if="visible" class="mask" @click.self="emit('close')">
      <div class="sheet">
        <div class="spark">✨</div>
        <h3 class="title">智能推荐已生成</h3>
        <p class="desc">
          AI 已根据你的风格、肤色、脸型、体型和偏好，
          <br />生成了专属风格报告
        </p>
        <button class="btn btn-primary view" @click="emit('view')">
          查看我的专属风格报告
        </button>
        <button class="btn btn-text" @click="emit('close')">再改改</button>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.mask {
  position: absolute;
  inset: 0;
  background: rgba(47, 42, 61, 0.45);
  backdrop-filter: blur(2px);
  display: flex;
  align-items: flex-end;
  z-index: 50;
}

.sheet {
  width: 100%;
  background: var(--surface);
  border-radius: 28px 28px 0 0;
  padding: 28px 24px calc(24px + var(--safe-bottom));
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.spark {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: var(--brand-gradient);
  display: grid;
  place-items: center;
  font-size: 36px;
  box-shadow: var(--shadow-float);
  margin-top: -56px;
  animation: pop 0.4s ease;
}
@keyframes pop {
  from {
    transform: scale(0.4);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}

.title {
  margin: 6px 0 0;
  font-size: 20px;
  font-weight: 800;
  color: var(--text-1);
}
.desc {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  color: var(--text-2);
}
.view {
  width: 100%;
  margin-top: 12px;
}

/* 弹出动画 */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.25s ease;
}
.modal-enter-active .sheet,
.modal-leave-active .sheet {
  transition: transform 0.3s cubic-bezier(0.22, 1, 0.36, 1);
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
.modal-enter-from .sheet,
.modal-leave-to .sheet {
  transform: translateY(100%);
}
</style>
