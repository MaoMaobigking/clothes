<script setup lang="ts">
import TileImage from '@/components/TileImage/TileImage.vue'
import type { MallProduct } from '@/data/mock'

defineProps<{
  product: MallProduct | null
  fav: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'fav'): void
  (e: 'add'): void
  (e: 'accessory'): void
}>()
</script>

<template>
  <view v-if="product" class="mask" @tap="emit('close')">
    <view class="sheet" @tap.stop>
      <view class="grip" />
      <view class="preview">
        <TileImage
          :from="product.from"
          :to="product.to"
          :emoji="product.emoji"
          :src="product.img"
          ratio="1 / 1"
          rounded="var(--radius-lg)"
        />
      </view>

      <view class="info">
        <view class="head">
          <text class="name">{{ product.name }}</text>
          <view class="fav" :class="{ on: fav }" @tap="emit('fav')">
            <text>{{ fav ? '❤️' : '🤍' }}</text>
          </view>
        </view>
        <text v-if="product.tag" class="tag">{{ product.tag }}</text>
        <text class="desc">
          精选材质 · 亲肤不过敏，粉紫少女风必备单品，百搭日常与约会造型～
        </text>
        <text class="price"><text class="price-symbol">¥</text>{{ product.price.toFixed(2) }}</text>
      </view>

      <view class="actions">
        <view class="btn btn-ghost" @tap="emit('close')">
          <text>再逛逛</text>
        </view>
        <view class="btn btn-ghost" @tap="emit('accessory')">
          <text>配配饰</text>
        </view>
        <view class="btn btn-primary" @tap="emit('add')">
          <text>加入购物车</text>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.mask {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 30;
  background: rgba(40, 24, 48, 0.35);
  display: flex;
  align-items: flex-end;
}
.sheet {
  width: 100%;
  background: var(--surface);
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  padding: 20rpx 32rpx calc(32rpx + env(safe-area-inset-bottom, 0px));
  box-shadow: var(--shadow-float);
  display: flex;
  flex-direction: column;
  gap: 28rpx;
  animation: sheetIn 0.25s ease;
}
@keyframes sheetIn {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}
.grip {
  width: 80rpx;
  height: 8rpx;
  border-radius: 999px;
  background: var(--line);
  margin: 4rpx auto 8rpx;
}
.preview {
  width: 46%;
  align-self: center;
}
.info {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
}
.name {
  margin: 0;
  font-size: 36rpx;
  font-weight: 800;
  color: var(--text-1);
}
.fav {
  flex-shrink: 0;
  width: 76rpx;
  height: 76rpx;
  border-radius: 50%;
  background: var(--surface-soft);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 36rpx;
  box-shadow: var(--shadow-card);
}
.fav.on {
  background: #fff;
}
.tag {
  align-self: flex-start;
  font-size: 24rpx;
  font-weight: 700;
  color: var(--text-on-brand);
  background: var(--brand-gradient);
  padding: 6rpx 20rpx;
  border-radius: var(--radius-pill);
}
.desc {
  margin: 0;
  font-size: 26rpx;
  color: var(--text-2);
  line-height: 1.6;
}
.price {
  margin: 4rpx 0 0;
  font-size: 48rpx;
  font-weight: 800;
  color: var(--pink-deep);
}
.price-symbol {
  font-size: 30rpx;
  font-style: normal;
  margin-right: 4rpx;
}
.actions {
  display: flex;
  gap: 24rpx;
}
.actions .btn {
  flex: 1;
  height: 92rpx;
}
</style>
