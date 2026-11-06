<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { LoaderCircle, X } from 'lucide-vue-next'
import EmptyState from '@/components/common/EmptyState.vue'
import AppCard from '@/components/site/AppCard.vue'
import AppInfoPanel from '@/components/site/AppInfoPanel.vue'
import AppSlide from '@/components/site/AppSlide.vue'
import SiteHeader from '@/components/site/SiteHeader.vue'
import { CoverflowCarousel } from '@/components/ui/coverflow-carousel'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { useDataStore } from '@/stores/data'
import type { AppGroup, AppItem, HomeViewMode } from '@/types'

const store = useDataStore()

/** 记住的分组 id：下次打开直接回到上次看的那一组 */
const GROUP_STORAGE_KEY = 'toolbox-group'

function readStoredGroupId(): string {
  try {
    return window.localStorage.getItem(GROUP_STORAGE_KEY)?.trim() ?? ''
  } catch {
    /* 隐私模式下 localStorage 可能抛错 */
    return ''
  }
}

function writeStoredGroupId(id: string): void {
  try {
    window.localStorage.setItem(GROUP_STORAGE_KEY, id)
  } catch {
    /* 存不下就算了，不影响当前会话 */
  }
}

const storedGroupId = readStoredGroupId()

const query = ref('')
const activeGroupId = ref(storedGroupId)
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

/**
 * 视图模式：默认「网格」（按应用组竖着分区），轮播是副视图。
 * 选择记在 localStorage 里，下次进来还是上次那个 —— 和分组记忆同一套做法。
 */
const VIEW_STORAGE_KEY = 'toolbox-view'

function readViewMode(): HomeViewMode {
  try {
    const stored = window.localStorage.getItem(VIEW_STORAGE_KEY)
    if (stored === 'grid' || stored === 'slider') return stored
  } catch {
    /* 隐私模式下 localStorage 可能抛错 */
  }
  return 'grid'
}

const viewMode = ref<HomeViewMode>(readViewMode())

watch(viewMode, (value) => {
  try {
    window.localStorage.setItem(VIEW_STORAGE_KEY, value)
  } catch {
    /* 存不下就算了，不影响当前会话 */
  }
})

/**
 * 网格视图的数据：按应用组竖着排，每个组里是该组启用中的应用。
 * - 空组不占位置（前台没有「空分组」这个概念，轮播视图才有「这个组还是空的」）
 * - 搜索时把命中结果按原分组归类，跨组的命中会各回各家
 */
const gridSections = computed<{ group: AppGroup; items: AppItem[] }[]>(() => {
  const hits = searching.value ? searchHits.value : null
  const sections: { group: AppGroup; items: AppItem[] }[] = []
  for (const group of store.sortedGroups) {
    const list = hits
      ? hits.filter((hit) => hit.item.group_id === group.id).map((hit) => hit.item)
      : store.visibleGroupItems(group.id)
    if (list.length) sections.push({ group, items: list })
  }
  return sections
})

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
 * 本地记住了上次的选择，也算「用户选过」—— 否则每次刷新都会被默认规则顶回去。
 */
const userPicked = ref(Boolean(storedGroupId))

function pickDefaultGroup(): void {
  const groups = store.sortedGroups
  // 数据还没到位：别把当前选择清掉 —— 它可能正是 localStorage 里记住的那个，
  // 清成空串后 userPicked 的校验会判它「不存在」，于是被默认组顶掉。
  if (!groups.length) return

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
 * 只记住「确实存在」的分组：
 * 数据还没到位时 activeGroupId 可能是空串，或者上次存的组已经被删了 —— 这些都不写。
 * 被删的情况由 `pickDefaultGroup` 兜底改成第一个组，随后这里会把新的 id 覆盖上去。
 */
watch(
  () => [activeGroupId.value, store.sortedGroups] as const,
  () => {
    const id = activeGroupId.value
    if (!id) return
    if (!store.sortedGroups.some((group) => group.id === id)) return
    writeStoredGroupId(id)
  },
)

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
    <SiteHeader v-model:search="query" v-model:view="viewMode" />

    <!-- 网格视图（默认）：从上往下按应用组分区，内容多了就整页滚。
         轮播视图：分组 + 轮播 + 信息区整体在剩余高度里垂直居中，
         左右内边距不给 main，而是各块自己带 —— 轮播才能贴满屏宽（移动端尤其明显） -->
    <main
      :class="
        viewMode === 'grid'
          ? 'mx-auto w-full max-w-6xl flex-1 px-4 py-8'
          : 'mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center gap-4 py-10'
      "
    >
      <div v-if="viewMode === 'slider' || searching" class="flex w-full flex-col items-center gap-2 px-4">
        <Select
          v-if="viewMode === 'slider' && !searching"
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
        class="mx-4 mt-4 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive"
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
        class="mt-4"
        title="还没有应用组"
        description="去后台创建第一个分组，应用都挂在分组下面。"
      />

      <!-- 网格视图：每个组一个小节，卡片方阵 -->
      <template v-else-if="viewMode === 'grid'">
        <EmptyState
          v-if="!gridSections.length"
          class="mt-4"
          :title="searching ? '没有匹配的应用' : '还没有启用中的应用'"
          :description="
            searching
              ? '换个关键词试试，搜索只覆盖启用中的应用。'
              : '去后台给分组添加应用，打开「启用」开关就会出现在这里。'
          "
        />

        <div v-else :class="searching ? 'mt-6 space-y-8' : 'space-y-10'">
          <section
            v-for="section in gridSections"
            :key="section.group.id"
            :aria-label="section.group.name"
            class="space-y-3"
          >
            <div class="flex items-center gap-2">
              <h2 class="truncate text-sm font-semibold text-foreground">
                {{ section.group.name }}
              </h2>
              <span class="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                {{ section.items.length }}
              </span>
            </div>

            <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              <AppCard v-for="item in section.items" :key="item.id" :item="item" />
            </div>
          </section>
        </div>
      </template>

      <!-- 轮播视图：一次只看一个应用，点两侧 / 拖 / 方向键切换 -->
      <template v-else>
        <EmptyState
          v-if="!items.length"
          class="mt-4"
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
            card-width="clamp(156px, 18.5vw, 208px)"
            card-height="clamp(234px, 27.75vw, 312px)"
            :gap="0"
            :rotate="44"
            :depth="1"
            :perspective="2.3"
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

          <!-- 一直显示，不等轮播停稳：换应用的那一下只做 100ms 淡入，遮掉硬切的感觉 -->
          <div v-if="activeItem" :key="activeItem.id" class="w-full animate-fade-in px-4">
            <AppInfoPanel :item="activeItem" />
          </div>
        </template>
      </template>
    </main>
  </div>
</template>
