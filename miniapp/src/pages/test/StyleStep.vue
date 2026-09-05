<script setup lang="ts">
import { computed } from 'vue'
import { STYLE_OPTIONS } from '@/data/questions'
import { useProfileStore } from '@/stores/profile'

const store = useProfileStore()

const subtitle = computed(
  () => `至少选择 3 项，可多选（已选 ${store.profile.styles.length} 项）`,
)

function orderOf(id: string) {
  const i = store.profile.styles.indexOf(id)
  return i >= 0 ? i + 1 : undefined
}
</script>

<template>
  <StepShell title="你喜欢哪种穿衣风格？" :subtitle="subtitle" center>
    <!--
      横向滑动的选项卡（客户需求原文「选项卡片（横向滑动）」）。
      scroll-view + 内层 inline-flex 是小程序端最稳的横滑写法：
      直接把 display:flex 写在 scroll-view 本体上，安卓端会出现子项被压扁。
      卡片宽 320rpx —— 一屏露出 2 张多一点，用户一眼看得出右边还有。
    -->
    <scroll-view scroll-x class="options" :show-scrollbar="false">
      <view class="options-row">
        <view v-for="opt in STYLE_OPTIONS" :key="opt.id" class="options-item">
          <OptionCard
            :option="opt"
            :selected="store.profile.styles.includes(opt.id)"
            :order="orderOf(opt.id)"
            preview-height="360rpx"
            @select="store.toggleStyle"
          />
        </view>
      </view>
    </scroll-view>
  </StepShell>
</template>

<style scoped>
.options {
  width: 100%;
  white-space: nowrap;
}
.options-row {
  display: inline-flex;
  gap: 22rpx;
  padding: 2rpx 0 12rpx;
}
.options-item {
  width: 320rpx;
  flex-shrink: 0;
}
</style>
