<script setup lang="ts">
import { MagnifyingGlassIcon } from '@heroicons/vue/24/outline'
import { cn } from '@/lib/utils'
import type { AppGroup } from '@/types'

const props = defineProps<{
  groups: AppGroup[]
  activeGroupId: string
  /** groupId → 应用数量 */
  counts: Record<string, number>
  searching: boolean
}>()

const emit = defineEmits<{ select: [id: string] }>()
</script>

<template>
  <aside class="hidden w-56 shrink-0 lg:block">
    <div class="sticky top-6 space-y-1">
      <p class="px-3 pb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground/70">
        应用组
      </p>

      <button
        v-if="props.searching"
        type="button"
        class="flex w-full items-center gap-2 rounded-lg bg-accent px-3 py-2 text-left text-sm font-medium text-accent-foreground"
      >
        <MagnifyingGlassIcon class="size-4 opacity-70" />
        搜索结果
      </button>

      <button
        v-for="group in props.groups"
        :key="group.id"
        type="button"
        :class="
          cn(
            'flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors',
            !props.searching && group.id === props.activeGroupId
              ? 'bg-accent font-medium text-accent-foreground'
              : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
          )
        "
        @click="emit('select', group.id)"
      >
        <span class="truncate">{{ group.name }}</span>
        <span class="shrink-0 text-xs tabular-nums text-muted-foreground/70">
          {{ props.counts[group.id] ?? 0 }}
        </span>
      </button>

      <p v-if="!props.groups.length" class="px-3 py-2 text-xs text-muted-foreground">
        还没有应用组
      </p>
    </div>
  </aside>
</template>
