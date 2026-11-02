import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { User } from '@supabase/supabase-js'
import { setSessionPersistence, supabase, TABLES } from '@/lib/supabase'

/**
 * 管理员身份判定：
 * - 认证：Supabase Auth（邮箱密码）；
 * - 授权：auth.uid() 是否存在于 admins 表（前端只用于 UI 门禁，真正的边界是 RLS 策略）。
 * 注意不存在「env 里写死账号密码」的方案 —— 那样等于把密码打进前端包。
 */
export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const isAdmin = ref(false)
  const loading = ref(false)
  /** 首次会话检查是否已完成，路由守卫要靠它避免刷新瞬间误判 */
  const ready = ref(false)

  let markReady: () => void = () => {}
  const readyPromise = new Promise<void>((resolve) => {
    markReady = resolve
  })

  function finishReady(): void {
    if (ready.value) return
    ready.value = true
    markReady()
  }

  /**
   * 查 admins 表里自己那一行：
   * - 有行 = 管理员；
   * - 0 行 = 已登录但不在白名单；
   * - 报错（网络/RLS 异常）= 一律按非管理员处理，宁可少给权限。
   */
  async function checkAdmin(current: User | null): Promise<void> {
    if (!current) {
      isAdmin.value = false
      return
    }

    const { data, error } = await supabase
      .from(TABLES.admins)
      .select('uid')
      .eq('uid', current.id)
      .maybeSingle()

    isAdmin.value = error ? false : data !== null
  }

  // 先用 getSession 拿到当前会话（刷新页面时即可恢复），再挂监听
  void (async () => {
    try {
      const { data } = await supabase.auth.getSession()
      user.value = data.session?.user ?? null
      await checkAdmin(user.value)
    } finally {
      finishReady()
    }
  })()

  supabase.auth.onAuthStateChange((_event, session) => {
    user.value = session?.user ?? null
    void checkAdmin(user.value).finally(finishReady)
  })

  const isAuthenticated = computed(() => user.value !== null)

  async function login(email: string, password: string, remember: boolean): Promise<void> {
    loading.value = true
    try {
      // 勾选「记住登录」= 会话写 localStorage；不勾 = 写 sessionStorage，关浏览器即失效
      setSessionPersistence(remember)
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (error) {
        throw new Error(
          /invalid login credentials/i.test(error.message)
            ? '邮箱或密码不正确'
            : /email not confirmed/i.test(error.message)
              ? '邮箱未验证：请在 Supabase 里关闭「Confirm email」，或在邮箱里点确认链接'
              : error.message,
        )
      }
      await checkAdmin((await supabase.auth.getUser()).data.user)
    } finally {
      loading.value = false
    }
  }

  async function logout(): Promise<void> {
    await supabase.auth.signOut()
    user.value = null
    isAdmin.value = false
  }

  /** 等首次会话检查完成；不 ready 就跳转会把已登录用户误踢到登录页 */
  async function ensureReady(): Promise<void> {
    if (!ready.value) await readyPromise
  }

  return { user, isAdmin, isAuthenticated, ready, loading, login, logout, ensureReady }
})
