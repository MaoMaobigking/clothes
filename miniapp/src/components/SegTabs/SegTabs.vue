<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  tabs: { key: string; label: string }[]
  modelValue: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', key: string): void
}>()

/*
 * uv-subsection 用 **下标** 表示选中项，本组件对外的 API 是 **key 字符串**。
 * 这里做双向转换，外部 20 多处调用点一行不用改。
 *
 * findIndex 找不到时回退 0：modelValue 传了个不在 tabs 里的值时，
 * 让它显示第一项而不是「全都不选中」——后者在分段控件里看起来像坏了。
 */
const current = computed(() => {
  const i = props.tabs.findIndex((t) => t.key === props.modelValue)
  return i < 0 ? 0 : i
})

function onChange(index: number) {
  const t = props.tabs[index]
  if (t) emit('update:modelValue', t.key)
}

/* 必须是字面色值：uv-subsection 把它们拼进 inline style，CSS 变量传不进去。
   和 uni.scss 的 $uv-primary / $uv-content-color 同值。 */
const ACTIVE_COLOR = '#b84271'
const INACTIVE_COLOR = '#606266'
</script>

<template>
  <!--
    mode="button"：uv-subsection 的两种形态里，button 是「整块底色 + 选中项白底滑块」，
    subsection 是「下划线式」。原来的 SegTabs 是前者，保持不变。

    keyName="label" 让 uv-subsection 直接读 tabs 里的 label 字段，
    不用为它再 map 一层数据（它默认读的是 name）。

    bgColor 用 uv-ui 的 $uv-bg-color 同值 —— 原来是 rgba(255,255,255,0.6) 半透白
    配渐变底，现在页面底本身就是 #f3f4f6，半透白会看不出来。
  -->
  <uv-subsection
    :list="tabs"
    key-name="label"
    :current="current"
    mode="button"
    :active-color="ACTIVE_COLOR"
    :inactive-color="INACTIVE_COLOR"
    bg-color="#f3f4f6"
    :font-size="14"
    :bold="false"
    @change="onChange"
  />
</template>
