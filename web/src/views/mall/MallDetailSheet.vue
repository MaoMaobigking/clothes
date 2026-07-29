<script setup lang="ts">
import TileImage from '@/components/TileImage.vue'
import type { MallProduct } from '@/data/mock'

defineProps<{
  product: MallProduct | null
  fav: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'fav'): void
  (e: 'add'): void
}>()
</script>

<template>
  <transition name="sheet">
    <div v-if="product" class="mask" @click.self="emit('close')">
      <div class="sheet">
        <div class="grip" />
        <div class="preview">
          <TileImage
            :from="product.from"
            :to="product.to"
            :emoji="product.emoji"
            :src="product.img"
            ratio="1 / 1"
            rounded="var(--radius-lg)"
          />
        </div>

        <div class="info">
          <div class="head">
            <h3 class="name">{{ product.name }}</h3>
            <button class="fav" :class="{ on: fav }" @click="emit('fav')">
              {{ fav ? '❤️' : '🤍' }}
            </button>
          </div>
          <span v-if="product.tag" class="tag">{{ product.tag }}</span>
          <p class="desc">
            精选材质 · 亲肤不过敏，粉紫少女风必备单品，百搭日常与约会造型～
          </p>
          <p class="price"><em>¥</em>{{ product.price.toFixed(2) }}</p>
        </div>

        <div class="actions">
          <button class="btn btn-ghost" @click="emit('close')">再逛逛</button>
          <button class="btn btn-primary" @click="emit('add')">加入购物车</button>
        </div>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.mask {
  position: absolute;
  inset: 0;
  z-index: 30;
  background: rgba(40, 24, 48, 0.35);
  display: flex;
  align-items: flex-end;
}
.sheet {
  width: 100%;
  background: var(--surface);
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  padding: 10px 16px calc(16px + var(--safe-bottom));
  box-shadow: var(--shadow-float);
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.grip {
  width: 40px;
  height: 4px;
  border-radius: 999px;
  background: var(--line);
  margin: 2px auto 4px;
}
.preview {
  width: 46%;
  align-self: center;
}
.info {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.name {
  margin: 0;
  font-size: 18px;
  font-weight: 800;
  color: var(--text-1);
}
.fav {
  flex-shrink: 0;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: var(--surface-soft);
  display: grid;
  place-items: center;
  font-size: 18px;
  box-shadow: var(--shadow-card);
}
.fav.on {
  background: #fff;
}
.tag {
  align-self: flex-start;
  font-size: 12px;
  font-weight: 700;
  color: var(--text-on-brand);
  background: var(--brand-gradient);
  padding: 3px 10px;
  border-radius: var(--radius-pill);
}
.desc {
  margin: 0;
  font-size: 13px;
  color: var(--text-2);
  line-height: 1.6;
}
.price {
  margin: 2px 0 0;
  font-size: 24px;
  font-weight: 800;
  color: var(--pink-deep);
}
.price em {
  font-size: 15px;
  font-style: normal;
  margin-right: 2px;
}
.actions {
  display: flex;
  gap: 12px;
}
.actions .btn {
  flex: 1;
  height: 46px;
}

.sheet-enter-active,
.sheet-leave-active {
  transition: opacity 0.2s ease;
}
.sheet-enter-active .sheet,
.sheet-leave-active .sheet {
  transition: transform 0.25s ease;
}
.sheet-enter-from,
.sheet-leave-to {
  opacity: 0;
}
.sheet-enter-from .sheet,
.sheet-leave-to .sheet {
  transform: translateY(100%);
}
</style>
