<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { api } from '../api'
const data = ref<any>(null),
  error = ref('')
const max = computed(() => Math.max(1, ...(data.value?.daily || []).map((d: any) => Number(d.calls))))
async function load() {
  error.value = ''
  try {
    data.value = await api('/api/admin/overview')
  } catch (err) {
    error.value = (err as Error).message
  }
}
onMounted(load)
</script>
<template>
  <el-card>
    <h2>运营概览</h2>
    <el-button @click="load">刷新</el-button>
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <template v-if="data">
      <el-row :gutter="24" style="margin: 24px 0">
        <el-col :span="6"><el-statistic title="用户" :value="data.users" /></el-col>
        <el-col :span="6"><el-statistic title="衣物" :value="data.garments" /></el-col>
        <el-col :span="6"><el-statistic title="演示订单" :value="data.orders" /></el-col>
        <el-col :span="6"><el-statistic title="AI 调用" :value="data.aiCalls" /></el-col>
      </el-row>
      <p>AI 失败 {{ data.failures }} 次，平均耗时 {{ data.latency }} 毫秒</p>
      <h3>近七天 AI 调用</h3>
      <el-empty v-if="!data.daily.length" description="暂无调用记录" />
      <div v-for="day in data.daily" :key="day.day" style="margin: 12px 0">
        <span>{{ String(day.day).slice(0, 10) }} · {{ day.calls }} 次（失败 {{ day.failures }} 次）</span>
        <el-progress :percentage="Math.round((Number(day.calls) / max) * 100)" :show-text="false" />
      </div>
    </template>
  </el-card>
</template>
