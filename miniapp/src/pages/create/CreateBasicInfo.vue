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
  saved.value = true
  window.clearTimeout(timer)
  timer = window.setTimeout(() => {
    saved.value = false
  }, 1600)
}
</script>

<template>
  <view class="card scroll-y hide-scrollbar">
    <view class="head">📋 基础信息</view>

    <view class="rows">
      <view v-for="f in BODY_FIELDS" :key="f.key" class="row">
        <view class="row-top">
          <text class="label">{{ f.label }}</text>
          <text class="check" aria-hidden="true">✓</text>
        </view>
        <view class="stepper">
          <view class="pm" aria-label="减少" @tap="dec(f)">－</view>
          <text class="val">{{ store.profile.body[f.key] }}<text class="unit">{{ f.unit }}</text></text>
          <view class="pm" aria-label="增加" @tap="inc(f)">＋</view>
        </view>
      </view>
    </view>

    <view class="btn btn-primary save" :class="{ ok: saved }" @tap="save">
      {{ saved ? '已保存 ✓' : '保存' }}
    </view>
  </view>
</template>

<style scoped>
.card {
  width: 300rpx;
  background: rgba(255, 255, 255, 0.78);
  backdrop-filter: blur(8px);
  border-radius: var(--radius);
  padding: 20rpx;
  box-shadow: var(--shadow-float);
  border: 2rpx solid var(--line);
}
.head {
  margin: 0 0 16rpx;
  font-size: 26rpx;
  font-weight: 800;
  color: var(--text-1);
}
.rows {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}
.row {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}
.row-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.label {
  font-size: 22rpx;
  color: var(--text-2);
}
.check {
  width: 30rpx;
  height: 30rpx;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: var(--brand-gradient);
  color: #fff;
  font-size: 18rpx;
  font-weight: 900;
  line-height: 1;
  box-shadow: var(--shadow-card);
}
.stepper {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8rpx;
}
.pm {
  width: 48rpx;
  height: 48rpx;
  flex-shrink: 0;
  border-radius: 50%;
  background: var(--surface);
  color: var(--purple-deep);
  font-size: 28rpx;
  font-weight: 700;
  box-shadow: var(--shadow-card);
}
.val {
  flex: 1;
  text-align: center;
  font-size: 26rpx;
  font-weight: 700;
  color: var(--text-1);
}
.unit {
  margin-left: 2rpx;
  font-size: 20rpx;
  font-style: normal;
  color: var(--text-3);
}
.save {
  height: 68rpx;
  width: 100%;
  margin-top: 20rpx;
  font-size: 26rpx;
}
.save.ok {
  filter: saturate(0.85);
}
</style>
