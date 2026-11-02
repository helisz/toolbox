<script setup lang="ts">
import { watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Toaster } from 'vue-sonner'
import { useAuthStore } from '@/stores/auth'
import { useThemeStore } from '@/stores/theme'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const themeStore = useThemeStore()

// 主题状态在 store 里初始化就会落地到 <html>，这里调用一次确保首帧正确
themeStore.apply()

/**
 * token 过期 / 账号被撤销：Supabase 会把 session 置空。
 * 此时如果人还在后台页面上，直接送回登录页，避免满屏 permission-denied。
 */
watch(
  () => authStore.isAuthenticated,
  (authenticated) => {
    if (authenticated) return
    if (route.meta.requiresAuth) {
      void router.replace({ name: 'admin-login', query: { redirect: route.fullPath } })
    }
  },
)
</script>

<template>
  <RouterView />
  <!-- 右下角、2 秒自动消失、不提供关闭按钮：提示信息都很短，不需要用户操作 -->
  <Toaster
    position="bottom-right"
    :theme="themeStore.mode"
    rich-colors
    :close-button="false"
    :duration="2000"
    :expand="false"
    :visible-toasts="3"
  />
</template>
