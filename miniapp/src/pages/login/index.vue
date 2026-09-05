<script setup lang="ts">
import setting from '@/setting'
/*
 * 登录页（规格 §5.1~5.4）。
 *
 * 这里是全 App 唯一的身份入口 —— 请求层已经不再自动建号，
 * 没走过这一页就没有 token，任何业务接口都进不去。
 *
 * 四条路径按端区分：
 *   小程序：微信一键注册/登录为主，账号密码为辅
 *   H5：没有微信运行环境，主推账号密码 + 演示账号选择器（§5.4）
 */
import { onMounted, ref } from 'vue'
import { fetchDemoAccounts, type DemoAccount } from '@/api/auth'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()

const account = ref('')
const password = ref('')
const errorText = ref('')
const notice = ref('')

/** 登录后要去哪。被路由守卫踢回来时带 redirect，否则回首页。 */
const redirect = ref('/pages/home/home')

const demoAccounts = ref<DemoAccount[]>([])
const demoLoading = ref(false)
const demoError = ref('')

// 演示账号选择器只在 H5 兜底入口出现，小程序端不暴露
let showDemoPicker = false
// #ifdef H5
showDemoPicker = true
// #endif

// 只有小程序拿得到真的微信 code，H5 上不摆这个按钮
let showWechat = false
// #ifdef MP-WEIXIN
showWechat = true
// #endif

function toErrorText(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

/** 登录成功后统一收尾：tabBar 页也能用 reLaunch，页面栈一并清掉 */
function afterLogin(nickname?: string) {
  errorText.value = ''
  uni.showToast({ title: nickname ? `欢迎，${nickname}` : '登录成功', icon: 'none' })
  uni.reLaunch({ url: redirect.value })
}

async function submitPassword() {
  if (auth.loading) return
  const name = account.value.trim()
  if (!name || !password.value) {
    errorText.value = '请输入账号和密码'
    return
  }
  errorText.value = ''
  try {
    const result = await auth.signInWithPassword(name, password.value)
    afterLogin(result.nickname)
  } catch (error) {
    errorText.value = toErrorText(error, '登录失败，请稍后重试')
  }
}

async function submitWechat() {
  if (auth.loading) return
  errorText.value = ''
  try {
    const result = await auth.signInWithWechat()
    // 首次登录即注册，之后同一个微信回到同一个账号（§5.1）
    afterLogin(result.isNewUser ? '新朋友' : result.nickname)
  } catch (error) {
    errorText.value = toErrorText(error, '微信登录失败，可改用账号密码登录')
  }
}

/** 开发身份：只在登录页保留，用来手测数据隔离（换 tag 就是换一个人） */
async function submitDev() {
  if (auth.loading) return
  errorText.value = ''
  try {
    const result = await auth.signInAsDev()
    afterLogin(result.nickname)
  } catch (error) {
    errorText.value = toErrorText(error, '开发身份创建失败，请确认后端已启动')
  }
}

/** 演示账号一键登录（§5.4）。后端在非生产环境才下发密码。 */
async function useDemo(item: DemoAccount) {
  account.value = item.account
  if (!item.password) {
    password.value = ''
    notice.value = '当前环境不下发演示密码，请手动输入'
    return
  }
  password.value = item.password
  await submitPassword()
}

async function loadDemoAccounts() {
  if (!showDemoPicker) return
  demoLoading.value = true
  demoError.value = ''
  try {
    demoAccounts.value = await fetchDemoAccounts()
  } catch (error) {
    demoError.value = toErrorText(error, '演示账号加载失败，请确认后端已启动')
  } finally {
    demoLoading.value = false
  }
}

onMounted(() => {
  const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : []
  const options = (pages[pages.length - 1] as any)?.options || {}
  if (options.redirect) {
    try {
      redirect.value = decodeURIComponent(options.redirect)
    } catch {
      // redirect 解不开就老实回首页
    }
  }
  if (options.reason === 'expired') notice.value = '登录状态已失效，请重新登录'
  loadDemoAccounts()
})
</script>

<template>
  <view class="page">
    <view class="body scroll-y hide-scrollbar">
      <!-- 品牌区 -->
      <view class="brand">
        <UiIcon class="brand-logo" name="cat-skirt" :size="96" tone="brand" :stroke-width="1.5" />
        <text class="brand-title">{{ setting.fullName }}</text>
        <text class="brand-sub">登录后你的衣橱、画像和搭配都会留在账号里</text>
      </view>

      <!-- 账号密码 -->
      <view class="card">
        <text class="card-title">账号密码登录</text>
        <input v-model="account" class="field" maxlength="64" placeholder="账号" placeholder-class="field-ph" />
        <input
          v-model="password"
          class="field"
          password
          maxlength="64"
          placeholder="密码"
          placeholder-class="field-ph"
          @confirm="submitPassword"
        />

        <text v-if="errorText" class="error">{{ errorText }}</text>
        <text v-else-if="notice" class="notice">{{ notice }}</text>

        <view
          class="btn btn-primary"
          :class="{ 'btn-disabled': auth.loading }"
          hover-class="btn-hover"
          @tap="submitPassword"
        >
          {{ auth.loading ? '登录中…' : '登录' }}
        </view>

        <view v-if="showWechat" class="btn btn-ghost wx-btn" hover-class="btn-hover" @tap="submitWechat">
          微信一键注册 / 登录
        </view>
      </view>

      <!-- 演示账号（§5.4，仅 H5 兜底入口） -->
      <view v-if="showDemoPicker" class="card">
        <text class="card-title">演示账号</text>
        <text class="card-sub">评委现场可直接选，数据已提前预置</text>

        <text v-if="demoLoading" class="hint">加载中…</text>
        <text v-else-if="demoError" class="error">{{ demoError }}</text>
        <text v-else-if="!demoAccounts.length" class="hint">暂无演示账号，可在后端执行 npm run seed:demo</text>

        <view
          v-for="item in demoAccounts"
          :key="item.account"
          class="demo-item"
          hover-class="demo-item-hover"
          @tap="useDemo(item)"
        >
          <view class="demo-text">
            <text class="demo-label">
              {{ item.label }}
              <text v-if="item.role === 'admin'" class="demo-tag">管理员</text>
            </text>
            <text class="demo-desc">{{ item.description }}</text>
            <text class="demo-account">账号 {{ item.account }}</text>
          </view>
          <text class="demo-arrow">›</text>
        </view>

        <text class="dev-entry" @tap="submitDev">或创建一个临时开发身份</text>
      </view>
    </view>
  </view>
</template>

<style scoped>
.body {
  display: flex;
  flex-direction: column;
  gap: 32rpx;
  padding: calc(env(safe-area-inset-top, 24rpx) + 48rpx) 40rpx 48rpx;
}

/* 品牌区 */
.brand {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  align-items: center;
  padding: 32rpx 0 8rpx;
}

.brand-logo {
  margin-bottom: 8rpx;
}

.brand-title {
  font-size: 44rpx;
  font-weight: 700;
  color: var(--text-1);
}

.brand-sub {
  font-size: 24rpx;
  line-height: 1.5;
  color: var(--text-2);
  text-align: center;
}

/* 卡片 */
.card {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
  padding: 36rpx 32rpx;
  background: var(--surface);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-card);
}

.card-title {
  font-size: 32rpx;
  font-weight: 500;
  color: var(--text-1);
}

.card-sub {
  margin-top: -12rpx;
  font-size: 24rpx;
  color: var(--text-2);
}

/* 输入框 */
.field {
  height: 92rpx;
  padding: 0 28rpx;
  font-size: 28rpx;
  color: var(--text-1);
  background: var(--surface-tint);
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
}

.field-ph {
  color: var(--text-3);
}

.error {
  font-size: 24rpx;
  line-height: 1.5;
  color: #e5484d;
}

.notice,
.hint {
  font-size: 24rpx;
  line-height: 1.5;
  color: var(--text-2);
}

.btn-hover {
  opacity: 0.8;
}

.wx-btn {
  margin-top: 4rpx;
}

/* 演示账号 */
.demo-item {
  display: flex;
  gap: 20rpx;
  align-items: center;
  padding: 24rpx 4rpx;
  border-bottom: 1px solid var(--line);
}

.demo-item:last-of-type {
  border-bottom: none;
}

.demo-item-hover {
  opacity: 0.6;
}

.demo-text {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 6rpx;
  min-width: 0;
}

.demo-label {
  font-size: 28rpx;
  font-weight: 700;
  color: var(--text-1);
}

.demo-tag {
  padding: 4rpx 14rpx;
  margin-left: 12rpx;
  font-size: 20rpx;
  font-weight: 500;
  color: var(--purple-deep);
  background: #efe8ff;
  border-radius: var(--radius-pill);
}

.demo-desc {
  font-size: 22rpx;
  line-height: 1.5;
  color: var(--text-2);
}

.demo-account {
  font-size: 22rpx;
  color: var(--text-3);
}

.demo-arrow {
  font-size: 40rpx;
  color: var(--text-3);
}

.dev-entry {
  align-self: center;
  margin-top: 8rpx;
  font-size: 22rpx;
  color: var(--text-3);
  text-decoration: underline;
}
</style>
