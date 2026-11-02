<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { House, LogOut } from 'lucide-vue-next'
import AppManager from '@/components/admin/AppManager.vue'
import GroupManager from '@/components/admin/GroupManager.vue'
import ThemeToggle from '@/components/common/ThemeToggle.vue'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import { useDataStore } from '@/stores/data'

const authStore = useAuthStore()
const store = useDataStore()
const router = useRouter()
const toast = useToast()

let release: (() => void) | undefined
onMounted(() => {
  release = store.subscribe()
})
onUnmounted(() => {
  release?.()
  release = undefined
})

async function logout(): Promise<void> {
  await authStore.logout()
  toast.success('已退出登录')
  await router.replace({ name: 'admin-login' })
}
</script>

<template>
  <div class="flex min-h-full flex-col bg-background">
    <header class="border-b border-border/70">
      <div class="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3">
        <h1 class="text-sm font-semibold">管理后台</h1>
        <span class="hidden text-xs text-muted-foreground sm:inline">
          {{ authStore.user?.email }}
        </span>

        <div class="ml-auto flex items-center gap-1">
          <ThemeToggle />
          <Button variant="ghost" size="sm" as-child class="gap-1.5">
            <RouterLink to="/">
              <House class="size-4" />
              <span class="hidden sm:inline">前台</span>
            </RouterLink>
          </Button>
          <Button variant="ghost" size="sm" class="gap-1.5" @click="logout">
            <LogOut class="size-4" />
            <span class="hidden sm:inline">退出</span>
          </Button>
        </div>
      </div>
    </header>

    <main class="mx-auto w-full max-w-4xl flex-1 px-4 py-6">
      <div
        v-if="store.error"
        class="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive"
      >
        {{ store.error }}
      </div>

      <Tabs default-value="apps">
        <TabsList class="mb-4">
          <TabsTrigger value="apps">应用</TabsTrigger>
          <TabsTrigger value="groups">应用组</TabsTrigger>
        </TabsList>

        <TabsContent value="apps">
          <AppManager />
        </TabsContent>

        <TabsContent value="groups">
          <GroupManager />
        </TabsContent>
      </Tabs>
    </main>
  </div>
</template>
