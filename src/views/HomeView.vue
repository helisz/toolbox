<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { LoaderCircle, X } from 'lucide-vue-next'
import EmptyState from '@/components/common/EmptyState.vue'
import AppInfoPanel from '@/components/site/AppInfoPanel.vue'
import AppSlide from '@/components/site/AppSlide.vue'
import SiteHeader from '@/components/site/SiteHeader.vue'
import { CoverflowCarousel } from '@/components/ui/coverflow-carousel'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { useDataStore } from '@/stores/data'
import type { AppItem } from '@/types'

const store = useDataStore()

const query = ref('')
const activeGroupId = ref('')
/** 当前居中那张卡对应的真实数据下标（轮播对外只报数据下标，重复铺满时会折回） */
const activeIndex = ref(0)

const searching = computed(() => query.value.trim().length > 0)

const searchHits = computed(() => (searching.value ? store.search(query.value) : []))

const items = computed<AppItem[]>(() =>
  searching.value
    ? searchHits.value.map((hit) => hit.item)
    : store.visibleGroupItems(activeGroupId.value),
)

const activeItem = computed<AppItem | null>(() => items.value[activeIndex.value] ?? null)

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

// 换组 / 换搜索条件后，信息区要跟着回到第一条
watch(carouselKey, () => {
  activeIndex.value = 0
})

/** 应用少于这个数就把卡片循环重复，把整条轮播铺满 */
const REPEAT_BELOW = 5
const shouldRepeat = computed(() => items.value.length > 0 && items.value.length < REPEAT_BELOW)

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

    <!-- 分组 + 轮播 + 信息区整体在剩余高度里垂直居中 -->
    <main
      class="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center gap-4 px-4 py-10"
    >
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
          <span>
            「{{ query.trim() }}」<span class="text-foreground">{{ items.length }}</span> 个结果
          </span>
          <button
            type="button"
            class="flex items-center gap-0.5 rounded-full px-1 text-foreground/70 transition-colors hover:text-foreground"
            aria-label="清除搜索"
            @click="clearSearch"
          >
            <X class="size-3.5" />
          </button>
        </div>
      </div>

      <div
        v-if="store.error"
        class="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive"
      >
        {{ store.error }}
      </div>

      <!-- 首屏就是一个转圈，不铺骨架卡片：加载通常只有一两百毫秒，骨架闪一下反而更乱 -->
      <div
        v-if="store.loading"
        class="flex flex-col items-center gap-3 py-10 text-muted-foreground"
        role="status"
        aria-live="polite"
      >
        <LoaderCircle class="size-6 animate-spin" aria-hidden="true" />
        <p class="text-xs">加载中…</p>
      </div>

      <EmptyState
        v-else-if="!store.sortedGroups.length"
        title="还没有应用组"
        description="去后台创建第一个分组，应用都挂在分组下面。"
      />

      <EmptyState
        v-else-if="!items.length"
        :title="searching ? '没有匹配的应用' : '这个分组还是空的'"
        :description="
          searching ? '换个关键词试试，搜索只覆盖启用中的应用。' : '去后台给这个分组添加应用。'
        "
      />

      <template v-else>
        <CoverflowCarousel
          :key="carouselKey"
          :count="items.length"
          :repeat="shouldRepeat"
          class="w-full"
          card-width="clamp(140px, 17vw, 180px)"
          card-height="clamp(140px, 17vw, 180px)"
          :gap="0.08"
          :rotate="40"
          :depth="0.5"
          show-navigation
          show-pagination
          :label="searching ? '搜索结果轮播' : `${activeGroup?.name ?? '应用'}轮播`"
          @change="(index) => (activeIndex = index)"
        >
          <template #default="{ index, active }">
            <!-- 数据少时轮播会重复铺满，这里用取模把渲染下标折回真实数据 -->
            <AppSlide v-if="items.length" :item="items[index % items.length]!" :active="active" />
          </template>
        </CoverflowCarousel>

        <AppInfoPanel v-if="activeItem" :item="activeItem" />

        <p class="text-[11px] text-muted-foreground/70">拖动、方向键或点两侧卡片切换</p>
      </template>
    </main>
  </div>
</template>
