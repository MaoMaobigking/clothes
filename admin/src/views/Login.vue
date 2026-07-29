<template>
  <el-card style="max-width:400px;margin:100px auto">
    <h2 style="text-align:center">管理员登录</h2>
    <el-form :model="form" style="margin-top:20px">
      <el-form-item><el-input v-model="form.username" placeholder="用户名" /></el-form-item>
      <el-form-item><el-input v-model="form.password" type="password" placeholder="密码" show-password /></el-form-item>
      <el-form-item><el-button type="primary" @click="login" style="width:100%">登录</el-button></el-form-item>
    </el-form>
  </el-card>
</template>

<script setup lang="ts">
import { reactive } from 'vue'
import { useRouter } from 'vue-router'
const router = useRouter()
const form = reactive({ username: 'admin', password: 'admin123' })
function login() {
  if (form.username === 'admin' && form.password === 'admin123') {
    localStorage.setItem('admin_token', 'mock-jwt-admin')
    router.push('/')
  }
}
</script>
