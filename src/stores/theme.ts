import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import type { ThemeMode } from '@/types'

const STORAGE_KEY = 'toolbox-theme'

/** 首次进入：优先本地选择，其次跟随系统（index.html 里的内联脚本用的是同一套逻辑） */
function readInitialMode(): ThemeMode {
  if (typeof window === 'undefined') return 'light'
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored === 'dark' || stored === 'light') return stored
  } catch {
    /* 隐私模式下 localStorage 可能抛错 */
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export const useThemeStore = defineStore('theme', () => {
  const mode = ref<ThemeMode>(readInitialMode())
  const isDark = computed(() => mode.value === 'dark')

  function apply(): void {
    if (typeof document === 'undefined') return
    document.documentElement.classList.toggle('dark', mode.value === 'dark')
    document.documentElement.style.colorScheme = mode.value
  }

  watch(
    mode,
    (value) => {
      try {
        window.localStorage.setItem(STORAGE_KEY, value)
      } catch {
        /* 存不下就算了，不影响当前会话 */
      }
      apply()
    },
    { immediate: true },
  )

  function toggle(): void {
    mode.value = mode.value === 'dark' ? 'light' : 'dark'
  }

  function setMode(next: ThemeMode): void {
    mode.value = next
  }

  return { mode, isDark, apply, toggle, setMode }
})
