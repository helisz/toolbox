<script setup lang="ts">
import { computed } from 'vue'
import AppIcon from '@/components/common/AppIcon.vue'
import { Badge } from '@/components/ui/badge'
import { getColorToken } from '@/lib/palette'
import type { AppItem } from '@/types'

const props = defineProps<{ item: AppItem }>()
const emit = defineEmits<{ select: [item: AppItem] }>()

const token = computed(() => getColorToken(props.item.theme_color))
const visibleTags = computed(() => props.item.tags.slice(0, 3))
const restTagCount = computed(() => Math.max(0, props.item.tags.length - visibleTags.value.length))

/** 卡片上省掉协议和 .git，长地址由 truncate 兜住 */
const displayUrl = computed(() =>
  props.item.git_url
    .replace(/^https?:\/\//i, '')
    .replace(/\.git$/i, '')
    .replace(/\/$/, ''),
)
</script>

<template>
  <button
    type="button"
    class="group relative flex h-full w-full items-start gap-3 overflow-hidden rounded-xl border bg-card p-3.5 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-foreground/15 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    @click="emit('select', item)"
  >
    <!-- 主题色装饰：hover 时才显现，保证静态状态足够克制 -->
    <span
      :class="[
        'absolute inset-y-3 left-0 w-[3px] rounded-full opacity-0 transition-opacity duration-200 group-hover:opacity-100',
        token.bar,
      ]"
      aria-hidden="true"
    />

    <AppIcon :icon="item.hero_icon_name" :color="item.theme_color" />

    <div class="flex min-w-0 flex-1 flex-col">
      <p class="truncate text-sm font-medium text-foreground">{{ item.name }}</p>
      <p class="mt-0.5 truncate font-mono text-[11px] text-muted-foreground/70">{{ displayUrl }}</p>

      <p v-if="item.intro" class="mt-1.5 line-clamp-3 text-xs leading-relaxed text-muted-foreground">
        {{ item.intro }}
      </p>
      <p v-else class="mt-1.5 line-clamp-3 text-xs leading-relaxed text-muted-foreground/50">
        暂无简介
      </p>

      <div v-if="visibleTags.length" class="mt-auto flex flex-wrap items-center gap-1 pt-2">
        <Badge v-for="tag in visibleTags" :key="tag" variant="outline">{{ tag }}</Badge>
        <span v-if="restTagCount" class="text-[11px] text-muted-foreground">+{{ restTagCount }}</span>
      </div>
    </div>
  </button>
</template>
