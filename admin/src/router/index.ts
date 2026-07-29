import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  { path: '/login', name: 'login', component: () => import('../views/Login.vue') },
  {
    path: '/',
    component: () => import('../views/Layout.vue'),
    children: [
      { path: '', name: 'dashboard', component: () => import('../views/Dashboard.vue') },
      { path: 'garments', name: 'garments', component: () => import('../views/Garments.vue') },
      { path: 'users', name: 'users', component: () => import('../views/Users.vue') },
      { path: 'ai-stats', name: 'aiStats', component: () => import('../views/AiStats.vue') },
    ],
  },
]

const router = createRouter({ history: createWebHistory(), routes })

router.beforeEach((to, _from, next) => {
  const token = localStorage.getItem('admin_token')
  if (to.path !== '/login' && !token) return next('/login')
  next()
})

export default router
