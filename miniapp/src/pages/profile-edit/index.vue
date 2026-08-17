<script setup lang="ts">
/*
 * 编辑资料（规格 §11.2）。
 *
 * 只改两样东西：昵称、头像。没有上传入口 —— 项目里根本没有能当头像用的图
 * （static/images/model 是全身照，圆形裁下来是一段躯干；face/ 是几个占位色块），
 * 所以头像走一组预设 emoji。
 *
 * 头像存的是 emoji 本身而不是图标名：users.avatar_url 这一列在社群那条链路上
 * 是被当纯文本直接渲染的（communityRepo 的 authorAvatar → share-detail 的 <text>），
 * 存 'icon:me' 的话社群列表里会原样显示这四个字符。
 * 这里用 iconForEmoji() 换成线性图标，两边都对。
 */
import { computed, onMounted, ref } from 'vue'
import { apiUpdateMe, fetchMe } from '@/api/auth'
import { isAuthError } from '@/api/http'
import { useAuthStore } from '@/stores/auth'
import { iconForEmoji } from '@/utils/icons'

const auth = useAuthStore()

/**
 * 预设头像。挑的时候确认过每一个都映射到**不同**的线性图标 ——
 * icons.ts 里 🧑 👩 👨 🐟 🧜 都指向同一个 'me'，全放人物 emoji 的话
 * 一整屏格子长得一模一样，选了跟没选看不出区别。
 */
const AVATARS = ['🧑', '🤖', '💎', '⭐', '❤', '✨', '🎀', '🌸', '🎨', '🧥', '👗', '👜']

const NICKNAME_MAX = 16

const nickname = ref(auth.session.nickname || '')
const avatar = ref(auth.session.avatarUrl || '')
const submitting = ref(false)
/** 用户一旦动过输入框，就不让后台那次回填把他打的字冲掉 */
const touched = ref(false)

/** 和服务端一样按码点数：emoji 在 UTF-16 里占两格，用 .length 会虚高一倍 */
const nicknameLen = computed(() => [...nickname.value].length)
const previewIcon = computed(() => iconForEmoji(avatar.value) ?? 'me')
const canSubmit = computed(() => !submitting.value && !!nickname.value.trim())

function iconOf(emoji: string) {
  return iconForEmoji(emoji) ?? 'me'
}

function pick(emoji: string) {
  // 再点一次已选中的就取消，回到默认头像
  avatar.value = avatar.value === emoji ? '' : emoji
}

onMounted(async () => {
  // 本地会话可能是几天前存的（换设备登录、或后台被人改过），拉一次权威值。
  // 失败不管：session 里那份已经渲染出来了，没有比它更差。
  try {
    const data = await fetchMe()
    if (!data?.profile) return
    auth.applyProfile(data.profile)
    if (touched.value) return
    nickname.value = data.profile.nickname || ''
    avatar.value = data.profile.avatarUrl || ''
  } catch {
    // 未登录时请求层已经跳登录页了，这里不用再处理
  }
})

async function submit() {
  const name = nickname.value.trim()
  if (!name) {
    uni.showToast({ title: '昵称不能为空', icon: 'none' })
    return
  }
  submitting.value = true
  try {
    const profile = await apiUpdateMe({ nickname: name, avatarUrl: avatar.value })
    // 写回会话（顺带落 storage），「我的」页返回时立刻是新昵称，不用等重新登录
    auth.applyProfile(profile)
    uni.showToast({ title: '已保存', icon: 'none' })
    setTimeout(() => uni.navigateBack(), 600)
  } catch (error) {
    if (!isAuthError(error)) {
      uni.showToast({
        title: error instanceof Error ? error.message : '保存失败',
        icon: 'none',
      })
    }
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <view class="page">
    <PageHeader title="编辑资料" to="/pages/me/me" />

    <view class="body scroll-y hide-scrollbar">
      <!-- 预览：和「我的」页顶部那张卡同一套渐变，改完能直接对上 -->
      <view class="preview">
        <view class="pv-avatar">
          <UiIcon :name="previewIcon" :size="64" tone="white" />
        </view>
        <text class="pv-name">{{ nickname.trim() || '时尚探索家' }}</text>
        <text v-if="auth.session.account" class="pv-account">账号 {{ auth.session.account }}</text>
      </view>

      <view class="field">
        <view class="label">昵称</view>
        <input
          v-model="nickname"
          class="input"
          :maxlength="NICKNAME_MAX"
          placeholder="给自己起个名字"
          @input="touched = true"
        />
        <view class="counter">{{ nicknameLen }}/{{ NICKNAME_MAX }}</view>
      </view>

      <view class="field">
        <view class="label">头像</view>
        <view class="grid">
          <view
            v-for="emoji in AVATARS"
            :key="emoji"
            class="cell"
            :class="{ on: avatar === emoji }"
            hover-class="cell-hover"
            @tap="pick(emoji)"
          >
            <UiIcon :name="iconOf(emoji)" :size="46" :tone="avatar === emoji ? 'brand' : 'soft'" />
          </view>
        </view>
        <view class="hint">再点一次已选中的头像可恢复默认</view>
      </view>

      <view class="submit" :class="{ disabled: !canSubmit }" @tap="canSubmit && submit()">
        {{ submitting ? '保存中...' : '保存' }}
      </view>
    </view>
  </view>
</template>

<style scoped>
.body {
  flex: 1;
  min-height: 0;
  padding: 12rpx 32rpx 48rpx;
}

/* 预览卡 */
.preview {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12rpx;
  padding: 40rpx 32rpx;
  border-radius: var(--radius-lg);
  background: var(--brand-gradient);
  box-shadow: var(--shadow-float);
}
.pv-avatar {
  width: 140rpx;
  height: 140rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
}
.pv-name {
  font-size: 34rpx;
  font-weight: 500;
  color: var(--text-on-brand);
}
.pv-account {
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.85);
}

.field {
  margin-top: 32rpx;
}
.label {
  margin-bottom: 12rpx;
  font-size: 25rpx;
  font-weight: 500;
  color: var(--text-1);
}
.input {
  width: 100%;
  height: 88rpx;
  padding: 22rpx;
  border-radius: var(--radius);
  background: var(--surface);
  color: var(--text-1);
  font-size: 26rpx;
  box-shadow: var(--shadow-card);
}
.counter {
  margin-top: 8rpx;
  text-align: right;
  font-size: 20rpx;
  color: var(--text-3);
}
.hint {
  margin-top: 12rpx;
  font-size: 20rpx;
  color: var(--text-3);
}

/* 头像格子 */
.grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20rpx;
}
.cell {
  aspect-ratio: 1 / 1;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius);
  background: var(--surface);
  box-shadow: var(--shadow-card);
  /* 未选中也留一圈同宽透明边，选中时才不会因为多出 3rpx 边框把整格顶大一圈 */
  border: 3rpx solid transparent;
}
.cell.on {
  border-color: var(--pink-deep);
  background: #fff2f7;
}
.cell-hover {
  opacity: 0.7;
}

.submit {
  height: 92rpx;
  margin-top: 44rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-pill);
  background: var(--brand-gradient);
  color: #fff;
  font-size: 28rpx;
  font-weight: 500;
  box-shadow: var(--shadow-float);
}
.submit.disabled {
  opacity: 0.65;
}
</style>
