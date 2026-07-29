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
  <div class="card scroll-y hide-scrollbar">
    <p class="head">📋 基础信息</p>

    <div class="rows">
      <div v-for="f in BODY_FIELDS" :key="f.key" class="row">
        <div class="row-top">
          <span class="label">{{ f.label }}</span>
          <span class="check" aria-hidden="true">✓</span>
        </div>
        <div class="stepper">
          <button class="pm" aria-label="减少" @click="dec(f)">－</button>
          <span class="val">{{ store.profile.body[f.key] }}<i>{{ f.unit }}</i></span>
          <button class="pm" aria-label="增加" @click="inc(f)">＋</button>
        </div>
      </div>
    </div>

    <button class="btn btn-primary save" :class="{ ok: saved }" @click="save">
      {{ saved ? '已保存 ✓' : '保存' }}
    </button>
  </div>
</template>

<style scoped>
.card {
  width: 150px;
  background: rgba(255, 255, 255, 0.78);
  backdrop-filter: blur(8px);
  border-radius: var(--radius);
  padding: 10px;
  box-shadow: var(--shadow-float);
  border: 1px solid var(--line);
}
.head {
  margin: 0 0 8px;
  font-size: 13px;
  font-weight: 800;
  color: var(--text-1);
}
.rows {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.row-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.label {
  font-size: 11px;
  color: var(--text-2);
}
.check {
  width: 15px;
  height: 15px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: var(--brand-gradient);
  color: #fff;
  font-size: 9px;
  font-weight: 900;
  line-height: 1;
  box-shadow: var(--shadow-card);
}
.stepper {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
}
.pm {
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  border-radius: 50%;
  background: var(--surface);
  color: var(--purple-deep);
  font-size: 14px;
  font-weight: 700;
  box-shadow: var(--shadow-card);
}
.val {
  flex: 1;
  text-align: center;
  font-size: 13px;
  font-weight: 700;
  color: var(--text-1);
}
.val i {
  margin-left: 1px;
  font-size: 10px;
  font-style: normal;
  color: var(--text-3);
}
.save {
  height: 34px;
  width: 100%;
  margin-top: 10px;
  font-size: 13px;
}
.save.ok {
  filter: saturate(0.85);
}
</style>
