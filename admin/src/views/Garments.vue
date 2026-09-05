<template>
  <div>
    <h2>衣服库管理</h2>
    <el-row style="margin: 16px 0" :gutter="12">
      <el-col :span="6"><el-input v-model="search" placeholder="搜索衣服名称" /></el-col>
      <el-col :span="3">
        <el-select v-model="category" placeholder="分类">
          <el-option v-for="c in cats" :key="c" :label="c" :value="c" />
        </el-select>
      </el-col>
      <el-col :span="3"><el-button type="primary" @click="dialogVisible = true">新增衣服</el-button></el-col>
    </el-row>
    <el-table :data="filtered" border stripe style="width: 100%">
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column prop="name" label="名称" />
      <el-table-column prop="category" label="分类" width="100" />
      <el-table-column prop="brand" label="品牌" width="100" />
      <el-table-column prop="price" label="价格" width="100">
        <template #default="{ row }">¥{{ row.price }}</template>
      </el-table-column>
      <el-table-column label="操作" width="160">
        <template #default>
          <el-button size="small">编辑</el-button>
          <el-button size="small" type="danger">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
const search = ref('')
const category = ref('')
const dialogVisible = ref(false)
const cats = ['上衣', '裤子', '半身裙', '连体装', '鞋', '包', '帽子', '首饰', '配饰']
const items = ref([
  { id: 'g1', name: '宽松工装外套', category: '上衣', brand: 'BASIC', price: 329 },
  { id: 'g2', name: '毛领派克大衣', category: '上衣', brand: 'WARM', price: 599 },
  { id: 'g9', name: '碎花连衣裙', category: '连体装', brand: 'ROMANCE', price: 399 },
])
const filtered = computed(() =>
  items.value.filter(
    (i) => (!search.value || i.name.includes(search.value)) && (!category.value || i.category === category.value),
  ),
)
</script>
