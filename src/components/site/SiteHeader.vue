<script setup lang="ts">
import { LockClosedIcon, MagnifyingGlassIcon, Squares2X2Icon } from '@heroicons/vue/24/outline'
import ThemeToggle from '@/components/common/ThemeToggle.vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { AppGroup } from '@/types'

const props = defineProps<{
  groups: AppGroup[]
  activeGroupId: string
  searching: boolean
}>()

const search = defineModel<string>('search', { required: true })
const emit = defineEmits<{ 'select-group': [id: string] }>()
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
          placeholder="搜索应用名或标签…"
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

    <!-- 移动端：侧边栏收起，改为顶部下拉切换分组 -->
    <div v-if="!props.searching" class="mx-auto max-w-7xl px-4 pb-3 lg:hidden">
      <Select
        :model-value="props.activeGroupId"
        @update:model-value="(value) => emit('select-group', String(value))"
      >
        <SelectTrigger aria-label="切换应用组">
          <SelectValue placeholder="选择应用组" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem v-for="group in props.groups" :key="group.id" :value="group.id">
            {{ group.name }}
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  </header>
</template>
