<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, UserRound } from 'lucide-vue-next'
import ThemeToggle from '@/components/common/ThemeToggle.vue'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import { loginFormSchema } from '@/types'

const authStore = useAuthStore()
const router = useRouter()
const route = useRoute()
const toast = useToast()

const email = ref('')
const password = ref('')
const remember = ref(true)
const errorMessage = ref('')
const submitting = ref(false)

/** 已登录但不在白名单时，守卫会带 denied=1 回来 */
const denied = computed(() => route.query.denied === '1')

async function handleSubmit(): Promise<void> {
  errorMessage.value = ''
  const parsed = loginFormSchema.safeParse({
    email: email.value,
    password: password.value,
    remember: remember.value,
  })
  if (!parsed.success) {
    errorMessage.value = parsed.error.issues[0]?.message ?? '请检查输入'
    return
  }

  submitting.value = true
  try {
    await authStore.login(parsed.data.email, parsed.data.password, parsed.data.remember)

    if (!authStore.isAdmin) {
      errorMessage.value = '该账号不在管理员白名单里，请联系维护者在 config/admins 中添加。'
      await authStore.logout()
      return
    }

    toast.success('登录成功')
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/admin'
    await router.replace(redirect)
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : '登录失败，请稍后重试'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="flex min-h-full flex-col bg-background">
    <div class="flex items-center justify-between px-4 py-3">
      <Button variant="ghost" size="sm" as-child class="gap-1.5">
        <RouterLink to="/">
          <ArrowLeft class="size-4" />
          返回前台
        </RouterLink>
      </Button>
      <ThemeToggle />
    </div>

    <div class="flex flex-1 items-center justify-center px-4 pb-16">
      <div class="w-full max-w-sm">
        <div class="mb-6 flex flex-col items-center gap-2 text-center">
          <span class="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <UserRound class="size-5" />
          </span>
          <h1 class="text-lg font-semibold">管理员登录</h1>
          <p class="text-xs text-muted-foreground">只有白名单内的账号可以进入后台</p>
        </div>

        <form class="space-y-4" @submit.prevent="handleSubmit">
          <div class="space-y-1.5">
            <Label for="email">邮箱</Label>
            <Input
              id="email"
              v-model="email"
              type="email"
              autocomplete="username"
              placeholder="admin@example.com"
            />
          </div>

          <div class="space-y-1.5">
            <Label for="password">密码</Label>
            <Input
              id="password"
              v-model="password"
              type="password"
              autocomplete="current-password"
              placeholder="••••••••"
            />
          </div>

          <div class="flex items-center gap-2">
            <Checkbox id="remember" v-model="remember" />
            <Label for="remember" class="text-sm font-normal text-muted-foreground">
              记住登录（关掉浏览器也不用重新登录）
            </Label>
          </div>

          <p v-if="denied && !errorMessage" class="text-xs text-destructive">
            当前账号没有管理员权限。
          </p>
          <p v-if="errorMessage" class="text-xs text-destructive">{{ errorMessage }}</p>

          <Button type="submit" class="w-full" :disabled="submitting">
            {{ submitting ? '登录中…' : '登录' }}
          </Button>
        </form>
      </div>
    </div>
  </div>
</template>
