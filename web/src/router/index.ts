import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/home' },

  // 底部 tab 主页面
  //路由懒加载
  { path: '/home', name: 'home', component: () => import('@/views/Home.vue') },
  { path: '/ai', name: 'ai', component: () => import('@/views/AiHub.vue') },
  { path: '/closet', name: 'closet', component: () => import('@/views/Closet.vue') },
  { path: '/mall', name: 'mall', component: () => import('@/views/Mall.vue') },
  { path: '/me', name: 'me', component: () => import('@/views/Profile.vue') },

  // 二级功能页
  { path: '/create', name: 'create', component: () => import('@/views/CreateCenter.vue') },
  { path: '/test', name: 'test', component: () => import('@/views/BodyCreate.vue') },
  { path: '/result', name: 'result', component: () => import('@/views/ResultReport.vue') },
  { path: '/free-match', name: 'free-match', component: () => import('@/views/FreeMatch.vue') },
  { path: '/scene', name: 'scene', component: () => import('@/views/SceneSim.vue') },
  { path: '/magazine', name: 'magazine', component: () => import('@/views/Magazine.vue') },
  { path: '/community', name: 'community', component: () => import('@/views/Community.vue') },
  { path: '/stylist', name: 'stylist', component: () => import('@/views/Stylist.vue') },
]
//()：表示调用函数 createRouter  大括号 { ... }：表示传给这个函数的参数是一个对象
export const router = createRouter({
  //这几个参数：路由历史模式 路由规则数组 切换页面时的滚动行为
  history: createWebHistory(),
  routes,
  scrollBehavior() {
    return { top: 0 }
  },
})
