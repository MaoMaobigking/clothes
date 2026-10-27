import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  { path: '/login', name: 'login', component: () => import('../views/AdminLogin.vue') },
  {
    path: '/',
    component: () => import('../views/Layout.vue'),
    children: [
      { path: '', name: 'dashboard', component: () => import('../views/Overview.vue') },
      ...['garments', 'users', 'ai-stats', 'orders'].map((kind) => ({
        path: kind,
        name: kind,
        component: () => import('../views/DataPage.vue'),
        props: { kind },
      })),
    ],
  },
]

const router = createRouter({ history: createWebHistory(import.meta.env.BASE_URL), routes })

router.beforeEach((to, _from, next) => {
  const token = localStorage.getItem('admin_token')
  if (to.path !== '/login' && !token) return next('/login')
  next()
})

export default router
