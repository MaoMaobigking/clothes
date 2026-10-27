<script setup lang="ts">
import { ref } from 'vue'
import { BODY_FIELDS } from '@/constants/questions'
import type { BodyField } from '@/types'
import { useProfileStore } from '@/stores/profile'

const store = useProfileStore()

function dec(f: BodyField) {
  const next = store.profile.body[f.key] - f.step
  if (next >= f.min) store.setBody(f.key, next)
}

function inc(f: BodyField) {
  const next = store.profile.body[f.key] + f.step
  if (next <= f.max) store.setBody(f.key, next)
}

const saved = ref(false)
let timer: number | undefined

function save() {
  store.persist()
  saved.value = true
  clearTimeout(timer)
  timer = setTimeout(() => {
    saved.value = false
  }, 1600)
}
</script>

<template>
  <view class="card scroll-y hide-scrollbar">
    <view class="head">
      <UiIcon name="doc" :size="30" tone="brand" />
      <text class="head-text">基础信息</text>
    </view>

    <view class="rows">
      <!--
        设计稿里这块是「一行一个参数 + 右侧圆勾」的紧凑列表。
        之前每个参数占「标签行 + 步进器行」两层，8 个参数把整块拉到 800rpx 以上，
        直接盖住中间的模特和左下的五步测试入口。这里压成单行。
      -->
      <view v-for="f in BODY_FIELDS" :key="f.key" class="row">
        <text class="label">{{ f.label }}</text>
        <view class="pm" aria-label="减少" @tap="dec(f)">－</view>
        <text class="val">
          {{ store.profile.body[f.key] }}
          <text class="unit">{{ f.unit }}</text>
        </text>
        <view class="pm" aria-label="增加" @tap="inc(f)">＋</view>
        <text class="check" aria-hidden="true">✓</text>
      </view>
    </view>

    <view class="btn btn-primary save" :class="{ ok: saved }" @tap="save">
      {{ saved ? '已保存 ✓' : '保存' }}
    </view>
  </view>
</template>

<style scoped>
.card {
  /* 设计稿里这块只占屏宽约 38%，主角是中间的模特。之前 330rpx 太宽，
     把模特挤成一条。步进器缩小、标签缩窄，压到 288rpx。 */
  width: 288rpx;
  padding: 16rpx 14rpx;
  background: var(--surface-glass);
  border: 2rpx solid var(--line);
  backdrop-filter: blur(8px);
}

.head {
  display: flex;
  gap: 8rpx;
  align-items: center;
  margin: 0 0 14rpx 4rpx;
}

.head-text {
  font-size: var(--fs-md);
  font-weight: 500;
  color: var(--text-1);
}

.rows {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}

.row {
  display: flex;
  gap: 6rpx;
  align-items: center;
  height: 44rpx;
}

.label {
  flex-shrink: 0;
  width: 64rpx;
  font-size: var(--fs-xs);
  color: var(--text-2);
}

.check {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 26rpx;
  height: 26rpx;
  font-size: var(--fs-2xs);
  font-weight: 700;
  line-height: 1;
  color: #fff;
  background: var(--brand-gradient);
  border-radius: 50%;
}

.pm {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 34rpx;
  height: 34rpx;
  font-size: var(--fs-base);
  font-weight: 700;
  color: var(--purple-deep);
  background: var(--surface);
  border-radius: 50%;
  box-shadow: var(--shadow-soft);
}

.val {
  flex: 1;
  font-size: var(--fs-sm);
  font-weight: 700;
  color: var(--text-1);
  text-align: center;
  white-space: nowrap;
}

.unit {
  margin-left: 2rpx;
  font-size: var(--fs-2xs);
  font-style: normal;
  color: var(--text-3);
}

.save {
  width: 100%;
  height: 60rpx;
  margin-top: 16rpx;
  font-size: var(--fs-base);
}

.save.ok {
  filter: saturate(0.85);
}
</style>
