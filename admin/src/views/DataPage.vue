<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { ElMessageBox, ElMessage } from 'element-plus'
import { api } from '../api'
const props = defineProps<{ kind: string }>()
const definitions: Record<string, { title: string; columns: [string, string][] }> = {
  users: {
    title: '用户数据',
    columns: [
      ['id', '用户编号'],
      ['nickname', '昵称'],
      ['role', '角色'],
      ['membership_level', '会员级别'],
      ['created_at', '创建时间'],
    ],
  },
  garments: {
    title: '衣服库',
    columns: [
      ['id', '衣物编号'],
      ['user_id', '所属用户'],
      ['name', '名称'],
      ['category', '分类'],
      ['price', '价格（元）'],
    ],
  },
  orders: {
    title: '演示订单',
    columns: [
      ['order_no', '订单号'],
      ['user_id', '用户编号'],
      ['status', '状态'],
      ['pay_amount', '应付金额（分）'],
      ['created_at', '创建时间'],
    ],
  },
  'ai-stats': {
    title: 'AI 调用记录',
    columns: [
      ['id', '编号'],
      ['scene', '场景'],
      ['model', '模型'],
      ['prompt_tokens', '输入 token'],
      ['completion_tokens', '输出 token'],
      ['latency_ms', '耗时（毫秒）'],
      ['ok', '成功'],
    ],
  },
}
const definition = computed(() => definitions[props.kind]!)
const rows = ref<Record<string, any>[]>([])
const total = ref(0),
  page = ref(1),
  search = ref(''),
  loading = ref(false),
  error = ref('')
const editing = ref(false),
  saving = ref(false)
const form = ref({ id: '', userId: 0, name: '', category: 'top', price: 0 })
const categories = [
  ['top', '上衣'],
  ['pants', '裤子'],
  ['skirt', '裙子'],
  ['dress', '连衣裙'],
  ['shoes', '鞋'],
  ['bag', '包'],
  ['hat', '帽子'],
  ['jewelry', '首饰'],
  ['accessory', '配饰'],
]
let generation = 0
async function load() {
  const version = ++generation
  loading.value = true
  error.value = ''
  try {
    const result = await api(`/api/admin/${props.kind}?page=${page.value}&search=${encodeURIComponent(search.value)}`)
    if (version === generation) {
      rows.value = result.items
      total.value = result.total
    }
  } catch (err) {
    if (version === generation) {
      rows.value = []
      error.value = (err as Error).message
    }
  } finally {
    if (version === generation) loading.value = false
  }
}
function edit(row?: Record<string, any>) {
  form.value = {
    id: row?.id || '',
    userId: row?.user_id || 0,
    name: row?.name || '',
    category: row?.category || 'top',
    price: Number(row?.price || 0),
  }
  editing.value = true
}
async function save() {
  saving.value = true
  try {
    await api('/api/admin/garments' + (form.value.id ? '/' + encodeURIComponent(form.value.id) : ''), {
      method: form.value.id ? 'PATCH' : 'POST',
      body: JSON.stringify(form.value),
    })
    editing.value = false
    await load()
  } catch (err) {
    ElMessage.error((err as Error).message)
  } finally {
    saving.value = false
  }
}
async function remove(row: Record<string, any>) {
  try {
    await ElMessageBox.confirm(`删除「${row.name}」？此操作会修改该用户的衣橱。`, '确认删除', { type: 'warning' })
    await api('/api/admin/garments/' + encodeURIComponent(row.id), { method: 'DELETE' })
    await load()
  } catch (err) {
    if (err instanceof Error) ElMessage.error(err.message)
  }
}
watch(
  () => props.kind,
  () => {
    page.value = 1
    search.value = ''
    rows.value = []
    void load()
  },
  { immediate: true },
)
</script>
<template>
  <el-card>
    <h2>{{ definition.title }}</h2>
    <el-alert
      v-if="kind === 'orders'"
      title="订单仅用于演示，不代表真实付款或物流状态。"
      type="info"
      :closable="false"
    />
    <form
      @submit.prevent="
        page = 1
        load()
      "
      style="display: flex; gap: 12px; margin: 16px 0"
    >
      <el-input v-model="search" placeholder="搜索名称、订单号或场景" aria-label="搜索" clearable />
      <el-button native-type="submit">查询</el-button>
      <el-button v-if="kind === 'garments'" type="primary" @click="edit()">新增衣物</el-button>
    </form>
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <el-table v-loading="loading" :data="rows" empty-text="暂无数据">
      <el-table-column
        v-for="[key, label] in definition.columns"
        :key="key"
        :prop="key"
        :label="label"
        show-overflow-tooltip
      />
      <el-table-column v-if="kind === 'garments'" label="操作" width="160">
        <template #default="{ row }">
          <el-button size="small" @click="edit(row)">编辑</el-button>
          <el-button size="small" type="danger" @click="remove(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
    <el-pagination
      v-model:current-page="page"
      :page-size="20"
      :total="total"
      layout="prev, pager, next, total"
      @current-change="load"
    />
    <el-dialog v-model="editing" :title="form.id ? '编辑衣物' : '新增衣物'">
      <el-form label-width="100px">
        <el-form-item label="所属用户">
          <el-input-number v-model="form.userId" :disabled="!!form.id" :min="1" />
        </el-form-item>
        <el-form-item label="名称"><el-input v-model="form.name" maxlength="32" /></el-form-item>
        <el-form-item label="分类">
          <el-select v-model="form.category">
            <el-option v-for="[value, label] in categories" :key="value" :value="value!" :label="label!" />
          </el-select>
        </el-form-item>
        <el-form-item label="价格（元）">
          <el-input-number v-model="form.price" :min="0" :max="1000000" :precision="0" />
        </el-form-item>
      </el-form>
      <template #footer><el-button type="primary" :loading="saving" @click="save">保存</el-button></template>
    </el-dialog>
  </el-card>
</template>
