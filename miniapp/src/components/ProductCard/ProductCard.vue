<script setup lang="ts">
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
  <view class="pcard" @tap="emit('click')">
    <view class="thumb">
      <TileImage :from="from" :to="to" :emoji="emoji" :ratio="ratio" :src="src" />
      <text v-if="tag" class="tag">{{ tag }}</text>
      <view class="fav" :class="{ on: fav }" aria-label="收藏" @tap.stop="emit('fav')">
        <UiIcon name="heart" :size="32" :tone="fav ? 'brand' : 'muted'" :stroke-width="fav ? 2.6 : 1.7" />
      </view>
    </view>
    <view class="name">{{ title }}</view>
    <view v-if="price !== undefined" class="price">
      <text class="price-symbol">¥</text>
      {{ price.toFixed(2) }}
    </view>
  </view>
</template>

<style scoped>
/*
 * 商品卡。uv-ui 没有 card / goods-card 组件，这个只能自绘 —— 但视觉规格对齐它：
 * 白底 + 发丝边 + 8rpx 圆角，分离感靠边框不靠阴影。
 */
.pcard {
  padding: 12rpx;
  overflow: hidden;
  background: var(--surface);
  border: var(--hairline);
  border-radius: var(--radius);
  transition: opacity 0.15s ease;
}

/*
 * 按压反馈从 transform: scale(0.97) 改成透明度。
 * uv-ui 全库的按压态就是 .uv-hover-class { opacity: 0.7 }，没有缩放动效；
 * 而且缩放会让发丝边在动画中出现锯齿。
 */
.pcard:active {
  opacity: 0.7;
}

.thumb {
  position: relative;
}

/*
 * 角标。原来是 rgba(0,0,0,0.35) 的半透黑药丸 ——
 * 换成 uv-ui 的 primary 实底小标签（它的 uv-tags 就是这个形态）。
 */
.tag {
  position: absolute;
  top: 12rpx;
  left: 12rpx;
  padding: 4rpx 12rpx;
  font-size: var(--fs-xs);
  color: #fff;
  background: var(--pink-deep);
  border-radius: var(--radius-sm);
}

/* 收藏键：白底圆钮 + 发丝边，去掉投影 */
.fav {
  position: absolute;
  top: 12rpx;
  right: 12rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56rpx;
  height: 56rpx;
  background: rgb(255 255 255 / 92%);
  border: var(--hairline);
  border-radius: 50%;
}

.fav.on {
  background: #fff;
}

/* 商品名：uv-ui 不给正文加粗，两行截断 */
.name {
  display: -webkit-box;
  margin-top: 14rpx;
  margin-left: 4rpx;
  overflow: hidden;
  -webkit-line-clamp: 2;
  font-size: var(--fs-md);
  line-height: 1.4;
  color: var(--text-1);
  -webkit-box-orient: vertical;
}

/*
 * 价格是全卡唯一的主色元素，所以这里保留 bold ——
 * 电商场景下价格必须最先被看到，这一处偏离 uv-ui 的「不加粗」是有意的。
 * 用 --price 而不是 --pink-deep：语义上是价格色，将来调价格不牵连按钮。
 */
.price {
  margin-top: 8rpx;
  margin-bottom: 8rpx;
  margin-left: 4rpx;
  font-size: var(--fs-2xl);
  font-weight: 700;
  color: var(--price);
}

.price-symbol {
  margin-right: 2rpx;
  font-size: var(--fs-sm);
}
</style>
