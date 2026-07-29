<script setup lang="ts">
defineProps<{
  title: string
  subtitle?: string
}>()
</script>

<template>
  <section class="step-shell scroll-y hide-scrollbar">
    <div class="head">
      <h2 class="title">{{ title }}</h2>
      <p v-if="subtitle" class="subtitle">{{ subtitle }}</p>
    </div>
    <slot />
  </section>
</template>

<style scoped>
.step-shell {
  flex: 1;
  min-height: 0;
  padding: 4px 16px 20px;
}
.head {
  margin-bottom: 16px;
}
.title {
  margin: 0;
  font-size: 22px;
  font-weight: 800;
  color: var(--text-1);
  line-height: 1.3;
}
.subtitle {
  margin: 6px 0 0;
  font-size: 13px;
  color: var(--text-2);
}
</style>
