import { createClient } from '@supabase/supabase-js'

/**
 * Supabase 的 URL 与 anon key 本来就是公开的（会打进前端包），
 * 安全边界在数据库的 RLS 策略（见 supabase/schema.sql）。
 * 但变量拼错/漏填时不应该白屏，所以这里提前校验并给出可读错误。
 */
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

const missingKeys = Object.entries({
  VITE_SUPABASE_URL: supabaseUrl,
  VITE_SUPABASE_ANON_KEY: supabaseAnonKey,
})
  .filter(([, value]) => !value)
  .map(([key]) => key)

if (missingKeys.length > 0) {
  throw new Error(
    `Supabase 配置缺失。请把 .env.example 复制成 .env.local，并填入 VITE_SUPABASE_* 两项。缺少：${missingKeys.join('、')}`,
  )
}

/** 登录时由「记住我」勾选决定会话写 localStorage 还是 sessionStorage */
let persistentSession = true

export function setSessionPersistence(persistent: boolean): void {
  persistentSession = persistent
}

const hybridStorage = {
  getItem(key: string): string | null {
    return window.localStorage.getItem(key) ?? window.sessionStorage.getItem(key)
  },
  setItem(key: string, value: string): void {
    if (persistentSession) {
      window.localStorage.setItem(key, value)
      window.sessionStorage.removeItem(key)
      return
    }
    window.sessionStorage.setItem(key, value)
    window.localStorage.removeItem(key)
  },
  removeItem(key: string): void {
    window.localStorage.removeItem(key)
    window.sessionStorage.removeItem(key)
  },
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: hybridStorage,
    storageKey: 'toolbox-auth',
    persistSession: true,
    autoRefreshToken: true,
    // 不用 URL 里的 token 回调（没有邮件确认/魔法链接流程）
    detectSessionInUrl: false,
  },
})

/** 表名常量，避免各处手写字符串拼错 */
export const TABLES = {
  groups: 'app_group',
  items: 'app_item',
  tags: 'tag_pool',
  admins: 'admins',
} as const
