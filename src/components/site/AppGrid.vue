<script setup lang="ts">
import { MagnifyingGlassIcon } from '@heroicons/vue/24/outline'
import EmptyState from '@/components/common/EmptyState.vue'
import PageSkeleton from '@/components/common/PageSkeleton.vue'
import AppCard from '@/components/site/AppCard.vue'
import type { AppItem } from '@/types'

withDefaults(
  defineProps<{
    items: AppItem[]
    loading?: boolean
    /** 搜索态下空结果的文案不同 */
    searching?: boolean
    emptyTitle?: string
    emptyDescription?: string
  }>(),
  {
    loading: false,
    searching: false,
    emptyTitle: '这个分组还没有应用',
    emptyDescription: '在后台「应用管理」里添加第一个应用。',
  },
)

const emit = defineEmits<{ select: [item: AppItem] }>()
</script>

<template>
  <PageSkeleton v-if="loading" />

  <div v-else-if="items.length" class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
    <AppCard v-for="item in items" :key="item.id" :item="item" @select="emit('select', $event)" />
  </div>

  <EmptyState
    v-else
    :icon="MagnifyingGlassIcon"
    :title="searching ? '没有匹配的应用' : emptyTitle"
    :description="searching ? '试试换个关键词，搜索会匹配应用名和标签。' : emptyDescription"
  />
</template>
