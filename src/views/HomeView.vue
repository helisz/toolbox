<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { X } from 'lucide-vue-next'
import EmptyState from '@/components/common/EmptyState.vue'
import AppSlide from '@/components/site/AppSlide.vue'
import SiteHeader from '@/components/site/SiteHeader.vue'
import { CoverflowCarousel } from '@/components/ui/coverflow-carousel'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useDataStore } from '@/stores/data'
import type { AppItem } from '@/types'

const store = useDataStore()

const query = ref('')
const activeGroupId = ref('')

const searching = computed(() => query.value.trim().length > 0)

const searchHits = computed(() => (searching.value ? store.search(query.value) : []))

const items = computed<AppItem[]>(() =>
  searching.value
    ? searchHits.value.map((hit) => hit.item)
    : store.visibleGroupItems(activeGroupId.value),
)

const counts = computed(() => {
  const result: Record<string, number> = {}
  for (const [groupId, list] of store.enabledByGroup) result[groupId] = list.length
  return result
})

const activeGroup = computed(
  () => store.sortedGroups.find((group) => group.id === activeGroupId.value) ?? null,
)

/**
 * 默认分组必须选「有应用的那个」，否则第一个分组正好是空的时候，打开首页就是一片空白。
 * 用户手动选过之后就完全尊重他的选择（包括故意停在空分组）。
 */
const userPicked = ref(false)

function pickDefaultGroup(): void {
  const groups = store.sortedGroups
  if (!groups.length) {
    activeGroupId.value = ''
    return
  }
  if (userPicked.value) {
    // 只是保证选中的组没被删掉
    if (!groups.some((group) => group.id === activeGroupId.value)) {
      activeGroupId.value = groups[0]?.id ?? ''
    }
    return
  }
  const best = groups.find((group) => (counts.value[group.id] ?? 0) > 0) ?? groups[0]
  if (best && best.id !== activeGroupId.value) activeGroupId.value = best.id
}

// 分组和「各组启用中的应用数」任一变化都重新挑一次（数据是异步到位的）
watch(() => [store.sortedGroups, store.enabledByGroup] as const, pickDefaultGroup, {
  immediate: true,
})

function selectGroup(id: string): void {
  userPicked.value = true
  activeGroupId.value = id
}

/**
 * 轮播是强制 remount 的：切换分组或搜索条件变化后必须回到第一张，
 * 让组件自己 watch count 也能做，但 remount 更干净，且不用管残留的 raf。
 */
const carouselKey = computed(() => `${activeGroupId.value}|${query.value.trim()}`)

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

function clearSearch(): void {
  query.value = ''
}
</script>

<template>
  <div class="flex min-h-full flex-col bg-background">
    <SiteHeader v-model:search="query" />

    <main class="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 pb-16 pt-8">
      <!-- 应用组：居中下拉 -->
      <div class="flex flex-col items-center gap-2">
        <Select
          v-if="!searching"
          :model-value="activeGroupId"
          @update:model-value="(value) => selectGroup(String(value ?? ''))"
        >
          <SelectTrigger
            class="h-11 w-full max-w-[18rem] justify-between gap-2 px-4 text-sm font-medium shadow-sm"
            aria-label="切换应用组"
          >
            <!-- 不用 <SelectValue>：它显示的是选中项内容的快照，数据刷新后不会同步
                 （曾出现「Tools · 0」而该组实际有 1 个应用）。自己渲染就一定是最新的 -->
            <span class="truncate">{{ activeGroup?.name ?? '选择应用组' }}</span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem
              v-for="group in store.sortedGroups"
              :key="group.id"
              :value="group.id"
              :text-value="group.name"
            >
              {{ group.name }}
              <span class="text-muted-foreground">· {{ counts[group.id] ?? 0 }}</span>
            </SelectItem>
          </SelectContent>
        </Select>

        <!-- 搜索时用胶囊替换下拉，避免两个控件打架 -->
        <div
          v-else
          class="flex items-center gap-2 rounded-full border bg-muted/40 px-4 py-2 text-xs text-muted-foreground"
        >
          <span>「{{ query.trim() }}」<span class="text-foreground">{{ items.length }}</span> 个结果</span>
          <button
            type="button"
            class="flex items-center gap-0.5 rounded-full px-1 text-foreground/70 transition-colors hover:text-foreground"
            aria-label="清除搜索"
            @click="clearSearch"
          >
            <X class="size-3.5" />
          </button>
        </div>

        <p v-if="!searching && activeGroup" class="text-xs text-muted-foreground">
          {{ activeGroup.name }} · {{ items.length }} 个应用
        </p>
      </div>

      <div
        v-if="store.error"
        class="mt-6 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive"
      >
        {{ store.error }}
      </div>

      <!-- 首屏骨架 -->
      <div v-if="store.loading" class="mt-14 flex items-center justify-center gap-4">
        <Skeleton
          v-for="index in 3"
          :key="index"
          :class="[
            'h-[280px] w-[clamp(150px,20vw,220px)] rounded-2xl',
            index === 2 ? 'opacity-40' : index === 1 ? 'opacity-70' : '',
          ]"
        />
      </div>

      <EmptyState
        v-else-if="!store.sortedGroups.length"
        class="mt-14"
        title="还没有应用组"
        description="去后台创建第一个分组，应用都挂在分组下面。"
      />

      <EmptyState
        v-else-if="!items.length"
        class="mt-14"
        :title="searching ? '没有匹配的应用' : '这个分组还是空的'"
        :description="
          searching ? '换个关键词试试，搜索只覆盖启用中的应用。' : '去后台给这个分组添加应用。'
        "
      />

      <CoverflowCarousel
        v-else
        :key="carouselKey"
        :count="items.length"
        class="mt-2"
        card-width="clamp(180px, 24vw, 240px)"
        card-height="clamp(272px, 32vw, 330px)"
        :gap="0.06"
        :rotate="42"
        :depth="0.55"
        show-navigation
        show-pagination
        :label="searching ? '搜索结果轮播' : `${activeGroup?.name ?? '应用'}轮播`"
      >
        <template #default="{ index, active }">
          <AppSlide v-if="items[index]" :item="items[index]!" :active="active" />
        </template>
      </CoverflowCarousel>

      <p v-if="items.length > 1" class="mt-2 text-center text-[11px] text-muted-foreground/70">
        拖动、方向键或点两侧卡片切换
      </p>
    </main>
  </div>
</template>
