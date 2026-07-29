<template>
  <div>
    <h2>仪表盘</h2>
    <el-row :gutter="20" style="margin-top:20px">
      <el-col :span="6"><el-card><el-statistic title="总用户数" :value="128" /></el-card></el-col>
      <el-col :span="6"><el-card><el-statistic title="衣服总数" :value="456" /></el-card></el-col>
      <el-col :span="6"><el-card><el-statistic title="今日AI调用" :value="89" /></el-card></el-col>
      <el-col :span="6"><el-card><el-statistic title="风格报告" :value="34" /></el-card></el-col>
    </el-row>
    <el-card style="margin-top:20px"><div style="height:300px;display:flex;align-items:center;justify-content:center">📊 图表区域（接入 ECharts 后可展示用户增长/活跃度）</div></el-card>
  </div>
</template>
