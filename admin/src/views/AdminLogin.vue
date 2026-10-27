<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '../api'
const router = useRouter()
const password = ref(''),
  error = ref(''),
  loading = ref(false)
async function login() {
  if (loading.value) return
  loading.value = true
  error.value = ''
  try {
    const result = await api<{ token: string }>('/api/auth/admin-login', {
      method: 'POST',
      body: JSON.stringify({ password: password.value }),
    })
    localStorage.setItem('admin_token', result.token)
    await router.push('/')
  } catch (err) {
    error.value = (err as Error).message
  } finally {
    loading.value = false
  }
}
</script>
<template>
  <el-card style="max-width: 400px; margin: 100px auto">
    <h2>灵犀管理后台</h2>
    <form @submit.prevent="login">
      <el-input v-model="password" type="password" show-password placeholder="管理员密码" aria-label="管理员密码" />
      <el-alert v-if="error" :title="error" type="error" :closable="false" />
      <el-button native-type="submit" type="primary" :loading="loading" style="margin-top: 20px">登录</el-button>
    </form>
  </el-card>
</template>
