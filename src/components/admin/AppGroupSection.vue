<script setup lang="ts">
import { computed, ref } from 'vue'
import { GripVertical, Plus, SquarePen, Trash2 } from 'lucide-vue-next'
import type { ReorderEvent } from '@/composables/useReorder'
import { useReorder } from '@/composables/useReorder'
import { useToast } from '@/composables/useToast'
import AppIcon from '@/components/common/AppIcon.vue'
import SortableList from '@/components/admin/SortableList.vue'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { useDataStore } from '@/stores/data'
import type { AppGroup, AppItem } from '@/types'

const props = defineProps<{ group: AppGroup }>()

const emit = defineEmits<{
  edit: [item: AppItem]
  remove: [item: AppItem]
  create: [groupId: string]
}>()

const store = useDataStore()
const toast = useToast()

/**
 * 每个分组各自一份拖拽实例：拖拽库一次只能绑一个容器，
 * 而排序落库又是按「组内目标下标」算的，所以拆成组件最省心。
 */
const sourceItems = computed(() => store.groupItems(props.group.id))

const { list, saving, onStart, resolveMovedId, commit } = useReorder({
  source: () => sourceItems.value,
  getId: (item) => item.id,
  persist: (id, toIndex) => store.moveItem(props.group.id, id, toIndex),
})

const enabledCount = computed(() => list.value.filter((item) => item.enabled).length)

async function handleEnd(event: ReorderEvent): Promise<void> {
  const movedId = resolveMovedId(event.oldIndex)
  const toIndex = event.newIndex
  if (!movedId || toIndex === undefined || toIndex === null || event.oldIndex === toIndex) return
  try {
    await commit(movedId, toIndex)
  } catch (err) {
    toast.fromError(err, '排序保存失败，已还原')
  }
}

const togglingId = ref('')

async function toggleEnabled(item: AppItem, enabled: boolean): Promise<void> {
  if (item.enabled === enabled) return
  togglingId.value = item.id
  try {
    await store.setItemEnabled(item.id, enabled)
    toast.success(
      enabled ? '已启用' : '已停用',
      enabled ? `${item.name} 会在前台显示` : `${item.name} 不再对前台展示`,
    )
  } catch (err) {
    toast.fromError(err, '状态修改失败')
  } finally {
    togglingId.value = ''
  }
}
</script>

<template>
  <section class="space-y-2">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div class="flex min-w-0 flex-wrap items-center gap-2">
        <h3 class="truncate text-sm font-semibold">{{ group.name }}</h3>
        <span class="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
          {{ list.length }} 个应用
        </span>
        <span
          v-if="enabledCount !== list.length"
          class="text-[11px] text-muted-foreground/80"
        >
          {{ list.length - enabledCount }} 个已停用
        </span>
      </div>

      <Button variant="ghost" size="sm" class="h-7 gap-1 px-2 text-xs" @click="emit('create', group.id)">
        <Plus class="size-3.5" />
        添加
      </Button>
    </div>

    <p
      v-if="!list.length"
      class="rounded-lg border border-dashed px-3 py-5 text-center text-[11px] text-muted-foreground"
    >
      这个分组还没有应用，点「添加」创建
    </p>

    <SortableList v-else v-model="list" :disabled="saving" @start="onStart" @end="handleEnd">
      <div
        v-for="item in list"
        :key="item.id"
        class="flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5"
      >
        <button
          type="button"
          class="drag-handle cursor-grab text-muted-foreground/60"
          aria-label="拖动排序"
        >
          <GripVertical class="size-4" />
        </button>

        <AppIcon :icon="item.hero_icon_name" :color="item.theme_color" size="sm" />

        <div class="min-w-0 flex-1">
          <p class="truncate text-sm" :class="!item.enabled && 'text-muted-foreground line-through'">
            {{ item.name }}
          </p>
          <p class="truncate text-[11px] text-muted-foreground">
            {{ item.intro ? item.intro : item.tags.length ? item.tags.join(' · ') : '暂无简介' }}
          </p>
        </div>

        <span
          v-if="!item.enabled"
          class="shrink-0 rounded-full border border-dashed px-2 py-0.5 text-[11px] text-muted-foreground"
        >
          已停用
        </span>

        <span
          v-else-if="!item.readme_raw"
          class="hidden shrink-0 text-[11px] text-muted-foreground/70 sm:inline"
        >
          无 README
        </span>

        <!-- 启用 / 停用：停用后前台立刻消失，数据保留 -->
        <Switch
          :model-value="item.enabled"
          :disabled="togglingId === item.id"
          :aria-label="item.enabled ? `停用 ${item.name}` : `启用 ${item.name}`"
          @update:model-value="(value) => toggleEnabled(item, value === true)"
        />

        <Button variant="ghost" size="icon-sm" aria-label="编辑" @click="emit('edit', item)">
          <SquarePen class="size-4" />
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label="删除" @click="emit('remove', item)">
          <Trash2 class="size-4" />
        </Button>
      </div>
    </SortableList>
  </section>
</template>
