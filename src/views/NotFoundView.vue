<script setup lang="ts">
import { Button } from '@/components/ui/button'
</script>

<template>
  <div class="flex min-h-full flex-col items-center justify-center gap-4 bg-background px-4 text-center">
    <p class="text-5xl font-semibold text-muted-foreground/30">404</p>
    <p class="text-sm font-medium">页面不存在</p>
    <p class="max-w-sm text-xs text-muted-foreground">
      链接可能已经失效，或者应用移动到了新的分组。
    </p>
    <Button as-child size="sm">
      <RouterLink to="/">回到首页</RouterLink>
    </Button>
  </div>
</template>
