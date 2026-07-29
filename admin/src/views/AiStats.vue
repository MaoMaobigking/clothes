<template>
  <div>
    <h2>AI 调用统计</h2>
    <el-row :gutter="20" style="margin-top:20px">
      <el-col :span="8"><el-card><el-statistic title="总调用次数" :value="2341" /></el-card></el-col>
      <el-col :span="8"><el-card><el-statistic title="风格报告" :value="456" /></el-card></el-col>
      <el-col :span="8"><el-card><el-statistic title="AI 对话" :value="1230" /></el-card></el-col>
    </el-row>
    <el-card style="margin-top:20px"><div style="height:300px;display:flex;align-items:center;justify-content:center">📊 调用趋势图（接入 ECharts）</div></el-card>
  </div>
</template>
