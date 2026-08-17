<script setup lang="ts">
import { ref } from 'vue'
import { BODY_FIELDS } from '@/data/questions'
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
        <text class="val">{{ store.profile.body[f.key] }}<text class="unit">{{ f.unit }}</text></text>
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
  background: var(--surface-glass);
  backdrop-filter: blur(8px);
  border-radius: var(--radius);
  padding: 16rpx 14rpx;
  box-shadow: var(--shadow-card);
  border: 2rpx solid var(--line);
}
.head {
  display: flex;
  align-items: center;
  gap: 8rpx;
  margin: 0 0 14rpx 4rpx;
}
.head-text {
  font-size: 26rpx;
  font-weight: 800;
  color: var(--text-1);
}
.rows {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}
.row {
  display: flex;
  align-items: center;
  gap: 6rpx;
  height: 44rpx;
}
.label {
  width: 64rpx;
  flex-shrink: 0;
  font-size: 20rpx;
  color: var(--text-2);
}
.check {
  width: 26rpx;
  height: 26rpx;
  flex-shrink: 0;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--brand-gradient);
  color: #fff;
  font-size: 16rpx;
  font-weight: 900;
  line-height: 1;
}
.pm {
  width: 34rpx;
  height: 34rpx;
  flex-shrink: 0;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--surface);
  color: var(--purple-deep);
  font-size: 24rpx;
  font-weight: 700;
  box-shadow: var(--shadow-soft);
}
.val {
  flex: 1;
  text-align: center;
  font-size: 22rpx;
  font-weight: 700;
  color: var(--text-1);
  white-space: nowrap;
}
.unit {
  margin-left: 2rpx;
  font-size: 18rpx;
  font-style: normal;
  color: var(--text-3);
}
.save {
  height: 60rpx;
  width: 100%;
  margin-top: 16rpx;
  font-size: 25rpx;
}
.save.ok {
  filter: saturate(0.85);
}
</style>
