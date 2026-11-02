<script setup lang="ts">
import { MoonIcon, SunIcon } from '@heroicons/vue/24/outline'
import { Button } from '@/components/ui/button'
import { useTheme } from '@/composables/useTheme'

const { isDark, toggle } = useTheme()
</script>

<template>
  <Button
    variant="ghost"
    size="icon"
    :aria-label="isDark ? '切换到亮色模式' : '切换到暗色模式'"
    :title="isDark ? '切换到亮色模式' : '切换到暗色模式'"
    @click="toggle"
  >
    <SunIcon v-if="isDark" class="size-4" />
    <MoonIcon v-else class="size-4" />
  </Button>
</template>
