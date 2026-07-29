<script setup lang="ts">
import TileImage from '@/components/TileImage.vue'

withDefaults(
  defineProps<{
    title: string
    price?: number
    emoji?: string
    from?: string
    to?: string
    tag?: string
    fav?: boolean
    ratio?: string
    /** 真实图片路径（缺图自动回退占位） */
    src?: string
  }>(),
  {
    price: undefined,
    emoji: '',
    from: '#ffd1e8',
    to: '#c9b8ff',
    tag: '',
    fav: false,
    ratio: '1 / 1',
    src: '',
  },
)

const emit = defineEmits<{
  (e: 'click'): void
  (e: 'fav'): void
}>()
</script>

<template>
  <div class="pcard" @click="emit('click')">
    <div class="thumb">
      <TileImage :from="from" :to="to" :emoji="emoji" :ratio="ratio" :src="src" />
      <span v-if="tag" class="tag">{{ tag }}</span>
      <button
        class="fav"
        :class="{ on: fav }"
        aria-label="收藏"
        @click.stop="emit('fav')"
      >
        {{ fav ? '❤️' : '🤍' }}
      </button>
    </div>
    <p class="name">{{ title }}</p>
    <p v-if="price !== undefined" class="price">
      <em>¥</em>{{ price.toFixed(2) }}
    </p>
  </div>
</template>

<style scoped>
.pcard {
  background: var(--surface);
  border-radius: var(--radius);
  padding: 8px;
  box-shadow: var(--shadow-card);
  transition: transform 0.15s ease;
}
.pcard:active {
  transform: scale(0.97);
}
.thumb {
  position: relative;
}
.tag {
  position: absolute;
  top: 8px;
  left: 8px;
  font-size: 11px;
  font-weight: 700;
  color: #fff;
  background: rgba(0, 0, 0, 0.35);
  padding: 3px 8px;
  border-radius: 999px;
}
.fav {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.85);
  display: grid;
  place-items: center;
  font-size: 15px;
  box-shadow: var(--shadow-card);
}
.fav.on {
  background: #fff;
}
.name {
  margin: 8px 4px 2px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-1);
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.price {
  margin: 2px 4px 4px;
  font-size: 16px;
  font-weight: 800;
  color: var(--pink-deep);
}
.price em {
  font-size: 12px;
  font-style: normal;
  margin-right: 1px;
}
</style>
