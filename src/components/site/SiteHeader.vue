<script setup lang="ts">
import { LockClosedIcon, MagnifyingGlassIcon, Squares2X2Icon } from '@heroicons/vue/24/outline'
import ThemeToggle from '@/components/common/ThemeToggle.vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const search = defineModel<string>('search', { required: true })
</script>

<template>
  <header class="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur">
    <div class="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
      <RouterLink to="/" class="flex shrink-0 items-center gap-2 text-sm font-semibold">
        <span class="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Squares2X2Icon class="size-4" />
        </span>
        <span class="hidden sm:inline">工具箱</span>
      </RouterLink>

      <div class="relative ml-auto w-full max-w-xs">
        <MagnifyingGlassIcon
          class="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          v-model="search"
          class="pl-8"
          placeholder="搜索应用名、简介或标签…"
          aria-label="搜索应用"
        />
      </div>

      <ThemeToggle />

      <Button variant="ghost" size="icon" as-child>
        <RouterLink to="/admin" aria-label="后台管理" title="后台管理">
          <LockClosedIcon class="size-4" />
        </RouterLink>
      </Button>
    </div>
  </header>
</template>
