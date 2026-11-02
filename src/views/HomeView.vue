<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import AppDetailDialog from '@/components/site/AppDetailDialog.vue'
import AppGrid from '@/components/site/AppGrid.vue'
import GroupSidebar from '@/components/site/GroupSidebar.vue'
import SiteHeader from '@/components/site/SiteHeader.vue'
import { useDataStore } from '@/stores/data'
import type { AppItem } from '@/types'

const store = useDataStore()

const query = ref('')
const activeGroupId = ref('')
const selectedItem = ref<AppItem | null>(null)
const detailOpen = ref(false)

const searching = computed(() => query.value.trim().length > 0)

const searchHits = computed(() => (searching.value ? store.search(query.value) : []))

const visibleItems = computed<AppItem[]>(() =>
  searching.value ? searchHits.value.map((hit) => hit.item) : store.visibleGroupItems(activeGroupId.value),
)

// 侧边栏计数只统计启用中的应用，避免出现「侧边栏 5 个、点进去 0 个」
const counts = computed(() => {
  const result: Record<string, number> = {}
  for (const [groupId, list] of store.enabledByGroup) result[groupId] = list.length
  return result
})

const activeGroupName = computed(
  () => store.sortedGroups.find((group) => group.id === activeGroupId.value)?.name ?? '应用',
)

// 分组增删后保证选中项有效；首次加载自动选第一个组
watch(
  () => store.sortedGroups,
  (groups) => {
    if (!groups.length) {
      activeGroupId.value = ''
      return
    }
    const stillExists = groups.some((group) => group.id === activeGroupId.value)
    if (!stillExists) activeGroupId.value = groups[0]?.id ?? ''
  },
  { immediate: true },
)

// 用 subscribe() 返回的释放函数，而不是直接 store.unsubscribe()：
// 前后台可能同时订阅，谁也不能替别人拆监听
let release: (() => void) | undefined
onMounted(() => {
  release = store.subscribe()
})
onUnmounted(() => {
  release?.()
  release = undefined
})

function selectGroup(id: string): void {
  if (searching.value) query.value = ''
  activeGroupId.value = id
}

function openDetail(item: AppItem): void {
  selectedItem.value = item
  detailOpen.value = true
}
</script>

<template>
  <div class="flex min-h-full flex-col bg-background">
    <SiteHeader
      v-model:search="query"
      :groups="store.sortedGroups"
      :active-group-id="activeGroupId"
      :searching="searching"
      @select-group="selectGroup"
    />

    <main class="mx-auto flex w-full max-w-7xl flex-1 gap-6 px-4 py-6">
      <GroupSidebar
        :groups="store.sortedGroups"
        :active-group-id="activeGroupId"
        :counts="counts"
        :searching="searching"
        @select="selectGroup"
      />

      <section class="min-w-0 flex-1">
        <div class="mb-4 flex items-baseline gap-2">
          <h1 class="text-base font-semibold">
            {{ searching ? '搜索结果' : activeGroupName }}
          </h1>
          <span class="text-xs text-muted-foreground">
            {{ searching ? `${visibleItems.length} 个匹配` : `${visibleItems.length} 个应用` }}
          </span>
        </div>

        <div
          v-if="store.error"
          class="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive"
        >
          {{ store.error }}
        </div>

        <AppGrid
          :items="visibleItems"
          :loading="store.loading"
          :searching="searching"
          @select="openDetail"
        />
      </section>
    </main>

    <AppDetailDialog v-model:open="detailOpen" :item="selectedItem" />
  </div>
</template>
