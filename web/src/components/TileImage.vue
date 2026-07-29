<script setup lang="ts">
import { ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    from?: string
    to?: string
    emoji?: string
    /** CSS aspect-ratio，如 '3 / 4' */
    ratio?: string
    label?: string
    rounded?: string
    /** 真实图片路径（放在 public/images 下）。缺图/加载失败会自动回退到渐变+emoji */
    src?: string
    /** 图片填充方式 */
    fit?: 'cover' | 'contain'
    alt?: string
  }>(),
  {
    from: '#ffd1e8',
    to: '#c9b8ff',
    emoji: '',
    ratio: '1 / 1',
    label: '',
    rounded: 'var(--radius)',
    src: '',
    fit: 'cover',
    alt: '',
  },
)

// 图片加载失败 → 回退占位
const failed = ref(false)
watch(
  () => props.src,
  () => {
    failed.value = false
  },
)
</script>

<template>
  <div
    class="tile"
    :style="{
      background: `linear-gradient(140deg, ${from}, ${to})`,
      aspectRatio: ratio,
      borderRadius: rounded,
    }"
  >
    <!-- 有真实图片时显示图片；失败则落到下方占位 -->
    <img
      v-if="src && !failed"
      class="img"
      :src="src"
      :alt="alt || label"
      :style="{ objectFit: fit }"
      @error="failed = true"
    />
    <span v-else-if="emoji" class="emoji">{{ emoji }}</span>

    <span v-if="label" class="label">{{ label }}</span>
    <slot />
  </div>
</template>

<style scoped>
.tile {
  position: relative;
  width: 100%;
  display: grid;
  place-items: center;
  overflow: hidden;
}
.img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.emoji {
  font-size: clamp(28px, 22%, 64px);
  filter: drop-shadow(0 3px 6px rgba(0, 0, 0, 0.14));
}
.label {
  position: absolute;
  bottom: 8px;
  left: 8px;
  font-size: 12px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.95);
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
}
</style>
