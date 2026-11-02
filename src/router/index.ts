import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { setupGuards } from './guards'

/**
 * 路由只保留需求里的三条 + 404 兜底。
 * 后台两个管理页（应用组 / 应用）用 Tabs 切换，不额外占用路由，
 * 这样刷新后台始终回到同一个入口。
 */
const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: () => import('@/views/HomeView.vue'),
  },
  {
    path: '/admin/login',
    name: 'admin-login',
    component: () => import('@/views/AdminLoginView.vue'),
    meta: { public: true },
  },
  {
    path: '/admin',
    name: 'admin',
    component: () => import('@/views/AdminView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/views/NotFoundView.vue'),
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior: () => ({ top: 0 }),
})

setupGuards(router)

export default router
