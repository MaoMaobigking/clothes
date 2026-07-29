<template>
  <el-container style="height:100vh">
    <el-aside width="220px" style="background:#1d1e2c;color:#fff">
      <div style="padding:20px;font-size:20px;font-weight:800;text-align:center">🛍️ 灵犀管理</div>
      <el-menu :default-active="route.path" background-color="#1d1e2c" text-color="#b0b8d0" active-text-color="#ff7eb3" router>
        <el-menu-item index="/"><el-icon><HomeFilled /></el-icon> 仪表盘</el-menu-item>
        <el-menu-item index="/garments"><el-icon><ShoppingBag /></el-icon> 衣服库管理</el-menu-item>
        <el-menu-item index="/users"><el-icon><User /></el-icon> 用户数据</el-menu-item>
        <el-menu-item index="/ai-stats"><el-icon><TrendCharts /></el-icon> AI 调用统计</el-menu-item>
      </el-menu>
    </el-aside>
    <el-container>
      <el-header style="background:#fff;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #eee">
        <span style="font-weight:700;font-size:16px">AI 服装 · 管理后台</span>
        <el-button @click="logout">退出</el-button>
      </el-header>
      <el-main style="background:#f5f5f5"><router-view /></el-main>
    </el-container>
  </el-container>
</template>

<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
const route = useRoute()
const router = useRouter()
function logout() { localStorage.removeItem('admin_token'); router.push('/login') }
</script>
