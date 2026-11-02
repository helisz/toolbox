import { computed } from 'vue'
import { useThemeStore } from '@/stores/theme'

/** 主题切换的唯一入口，组件里不要再直接操作 documentElement */
export function useTheme() {
  const themeStore = useThemeStore()

  return {
    mode: computed(() => themeStore.mode),
    isDark: computed(() => themeStore.isDark),
    toggle: () => themeStore.toggle(),
  }
}
