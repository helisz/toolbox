<script setup lang="ts">
import { computed } from 'vue'
import { GalleryHorizontalEnd, LayoutGrid, Search, UserRound } from 'lucide-vue-next'
import ThemeToggle from '@/components/common/ThemeToggle.vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { HomeViewMode } from '@/types'

const search = defineModel<string>('search', { required: true })
/** 首页视图：网格 / 轮播。图标显示的是「点一下会切到哪个视图」 */
const view = defineModel<HomeViewMode>('view', { required: true })

const isGrid = computed(() => view.value === 'grid')

function toggleView(): void {
  view.value = isGrid.value ? 'slider' : 'grid'
}
</script>

<template>
  <header class="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur">
    <div class="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
      <RouterLink to="/" class="flex shrink-0 items-center gap-2 text-sm font-semibold">
        <span class="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary">
          <LayoutGrid class="size-4" />
        </span>
        <span class="hidden sm:inline">工具箱</span>
      </RouterLink>

      <div class="relative ml-auto w-full max-w-xs">
        <Search
          class="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          v-model="search"
          class="pl-8"
          placeholder="搜索应用名、简介或标签…"
          aria-label="搜索应用"
        />
      </div>

      <!-- 视图切换：放搜索栏右边，挨着搜索框（切换的是「怎么展示同一批应用」） -->
      <Button
        variant="ghost"
        size="icon"
        :aria-label="isGrid ? '切换到轮播视图' : '切换到网格视图'"
        :title="isGrid ? '切换到轮播视图' : '切换到网格视图'"
        :aria-pressed="!isGrid"
        @click="toggleView"
      >
        <GalleryHorizontalEnd v-if="isGrid" class="size-4" />
        <LayoutGrid v-else class="size-4" />
      </Button>

      <ThemeToggle />

      <Button variant="ghost" size="icon" as-child>
        <RouterLink to="/admin" aria-label="后台管理" title="后台管理">
          <UserRound class="size-4" />
        </RouterLink>
      </Button>
    </div>
  </header>
</template>
