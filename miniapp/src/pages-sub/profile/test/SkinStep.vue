<script setup lang="ts">
import { SKIN_OPTIONS } from '@/constants/questions'
import { useProfileStore } from '@/stores/profile'

const store = useProfileStore()
</script>

<template>
  <StepShell title="你的肤色更接近？" subtitle="对着自然光看手腕内侧，选最接近的一档" center>
    <!-- 横滑选项卡，写法与 StyleStep 一致（客户需求原文「选项卡片（横向滑动）」） -->
    <scroll-view scroll-x class="options" :show-scrollbar="false">
      <view class="options-row">
        <view v-for="opt in SKIN_OPTIONS" :key="opt.id" class="options-item">
          <OptionCard
            :option="opt"
            :selected="store.profile.skinTone === opt.id"
            preview-height="360rpx"
            @select="store.setSkin"
          />
        </view>
      </view>
    </scroll-view>
  </StepShell>
</template>
