/**
 * 四类预置演示账号（规格 §5.2）。
 *
 * 从 services/authService.mjs 迁出（第 4 条规矩：数据与逻辑分离）。
 * 这里只描述「有哪几个账号、各自的 openid / 昵称 / 角色 / 密码环境变量名」，
 * 建账号和校验密码的逻辑留在 service 层。
 */
export const DEMO_ACCOUNTS = [
  {
    kind: 'female',
    account: 'demo_female',
    openid: 'lingxi_demo_female',
    nickname: '演示用户 · 小灵',
    role: 'user',
    label: '演示女性账号',
    description: '已完成五步测试、真实衣橱、历史搭配、购物车、定制申请',
    envKey: 'DEMO_FEMALE_PASSWORD',
    defaultPassword: 'demo-female-2026',
  },
  {
    kind: 'male',
    account: 'demo_male',
    openid: 'lingxi_demo_male',
    nickname: '演示用户 · 阿犀',
    role: 'user',
    label: '演示男性账号',
    description: '已完成画像、真实衣橱、场景搭配示例',
    envKey: 'DEMO_MALE_PASSWORD',
    defaultPassword: 'demo-male-2026',
  },
  {
    kind: 'blank',
    account: 'demo_blank',
    openid: 'lingxi_demo_blank',
    nickname: '全新用户',
    role: 'user',
    label: '空白新账号',
    description: '无画像、无衣橱，用于演示从零开始的完整流程',
    envKey: 'DEMO_BLANK_PASSWORD',
    defaultPassword: 'demo-blank-2026',
  },
  {
    kind: 'admin',
    account: 'demo_admin',
    openid: 'lingxi_admin',
    nickname: '灵犀管理员',
    role: 'admin',
    label: '管理员账号',
    description: '查看数据看板和演示进度',
    envKey: 'ADMIN_PASSWORD',
    defaultPassword: 'lingxi-admin-demo',
  },
]
