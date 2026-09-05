<template>
  <div>
    <h2>用户数据</h2>
    <el-table :data="users" border stripe style="width: 100%; margin-top: 16px">
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column prop="nickname" label="昵称" />
      <el-table-column prop="openid" label="OpenID" />
      <el-table-column prop="garments" label="衣橱件数" width="100" />
      <el-table-column prop="reports" label="风格报告" width="100" />
      <el-table-column label="操作" width="120">
        <template #default><el-button size="small">查看详情</el-button></template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
const users = ref([
  { id: 1, nickname: '时尚探索家', openid: 'mock_openid_dev', garments: 18, reports: 3 },
  { id: 2, nickname: '穿搭达人', openid: 'oxABCD1234', garments: 25, reports: 5 },
])
</script>
