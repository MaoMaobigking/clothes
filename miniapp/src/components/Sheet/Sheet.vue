<script setup lang="ts">
import { useFocusTrap } from '@/composables/useFocusTrap'
/*
 * 底部抽屉 / 居中弹窗。
 *
 * ── 为什么要有这个组件 ──
 * 全站 14 处手写了同一套「遮罩 + 面板」结构。样式早就收进
 * styles/components.css 的 .mask / .sheet 了，但**结构和交互没有**，
 * 于是每处都要自己重写这四行，并且自己记住那个关键细节：
 *
 *     面板上必须有 @tap.stop
 *
 * 忘了它，点面板内部会冒泡到遮罩，弹层当场关掉 —— 表单填一半消失。
 * 这个细节现在有三种写法在并存：
 *   1. 面板 @tap.stop                       （11 处）
 *   2. 遮罩上判 e.target === e.currentTarget（pages/create 的 3 处）
 *   3. 遮罩和面板做成兄弟节点，各管各的     （pages/diary）
 * 三种都能用，但同一个 App 里有三套写法，就意味着第四个人会发明第四套。
 *
 * ── 不打算收进来的 ──
 * scene 的 .modal-sheet、closet 的 .sort-sheet、magazine-detail 的
 * .zoom-mask / .note-mask、wardrobe-upload 的 .loading-mask ——
 * 它们的遮罩语义或层级各不相同（有的是纯视觉罩层，不是弹层），
 * 硬套进来只会让这个组件长出一堆开关。保持它们原样。
 */
/*
 * ── 用法：显隐用 v-if 挂在组件上，不要传 visible prop ──
 *
 *   <Sheet v-if="cartOpen" title="购物车" @close="cartOpen = false">…</Sheet>
 *   <Sheet v-if="replacing" title="替换单品" @close="closeReplace">
 *     只能替换同类型：{{ replacing.category }}   ← 这里 replacing 已收窄成非 null
 *   </Sheet>
 *
 * 一开始这里做的是 `:visible="!!replacing"`，组件内部再 v-if。
 * 那样写会**丢掉类型收窄**：插槽内容不在任何 v-if 分支里，
 * vue-tsc 立刻报了 11 条 "'replacing' is possibly 'null'"。
 * 运行时其实没事（插槽是惰性求值的），但每个调用点都得改成可选链，
 * 或者在插槽里再套一层 <template v-if> —— 那就等于白抽了。
 *
 * 所以显隐交给调用方的 v-if：收窄天然成立，用法也只剩一种。
 */
withDefaults(
  defineProps<{
    /** 传了就渲染标准 .sheet-title；结构更复杂的头部走 #header 插槽 */
    title?: string
    /** 居中弹窗而不是底部抽屉 */
    center?: boolean
    /**
     * 点遮罩是否关闭。默认 true。
     * 表单类弹层（定制咨询、量体预约）建议传 false —— 填到一半误触遮罩，
     * 输入就全没了，而这个操作没有撤销。
     */
    maskClosable?: boolean
  }>(),
  { title: '', center: false, maskClosable: true },
)

const emit = defineEmits<{ close: [] }>()

function onMaskTap(closable: boolean) {
  if (closable) emit('close')
}

/*
 * 可访问性（仅 H5 生效，小程序没有键盘焦点模型）。
 *
 * 放在这个组件里，5 个调用点一次全好 —— 这正是当初把弹层收敛成组件的回报。
 * 三件事见 composables/useFocusTrap.ts：焦点移进来、Tab 不逃逸、关闭时还回去。
 */
const { trapRef } = useFocusTrap({ onEscape: () => emit('close') })
</script>

<template>
  <view class="mask" :class="{ 'mask-center': center }" @tap="onMaskTap(maskClosable)">
    <!-- @tap.stop 是这个组件存在的主要理由，别删 -->
    <view
      ref="trapRef"
      class="sheet"
      :class="{ 'sheet-center': center }"
      role="dialog"
      aria-modal="true"
      :aria-label="title || undefined"
      tabindex="-1"
      @tap.stop
    >
      <slot name="header">
        <view v-if="title" class="sheet-title">{{ title }}</view>
      </slot>
      <slot />
    </view>
  </view>
</template>

<style scoped>
/*
 * 面板本身带 tabindex="-1" 是为了在「弹层里没有任何可聚焦元素」时也能接住焦点，
 * 但它不是用户主动点出来的焦点，描边反而像是个 bug。
 * 只去掉面板自己的，**不碰内部元素的焦点环** —— 那是键盘用户唯一的位置指示。
 */
.sheet:focus {
  outline: none;
}
</style>
