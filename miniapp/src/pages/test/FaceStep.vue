<script setup lang="ts">
import { FACE_OPTIONS } from '@/data/questions'
import { useProfileStore } from '@/stores/profile'

const store = useProfileStore()
</script>

<template>
  <StepShell title="你的脸型是？" subtitle="扎起头发对镜自拍，看轮廓最像哪种" center>
    <!-- 横滑选项卡，写法与 StyleStep 一致（客户需求原文「选项卡片（横向滑动）」） -->
    <scroll-view scroll-x class="options" :show-scrollbar="false">
      <view class="options-row">
        <view v-for="opt in FACE_OPTIONS" :key="opt.id" class="options-item">
          <OptionCard
            :option="opt"
            :selected="store.profile.faceShape === opt.id"
            preview-height="360rpx"
            @select="store.setFace"
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
