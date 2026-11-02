import type { Router } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

export function setupGuards(router: Router): void {
  router.beforeEach(async (to) => {
    const authStore = useAuthStore()

    if (to.meta.requiresAuth) {
      // 等首次鉴权回调，否则刷新页面会被误判成未登录
      await authStore.ensureReady()

      if (!authStore.isAuthenticated) {
        return { name: 'admin-login', query: { redirect: to.fullPath } }
      }
      if (!authStore.isAdmin) {
        // 已登录但不在白名单：留在登录页并提示，绝不能跳 /admin（否则和下面的重定向形成死循环）
        return { name: 'admin-login', query: { denied: '1' } }
      }
      return true
    }

    // 已登录的管理员访问登录页 → 直接进后台
    if (to.name === 'admin-login') {
      await authStore.ensureReady()
      if (authStore.isAuthenticated && authStore.isAdmin) return { name: 'admin' }
    }

    return true
  })
}
