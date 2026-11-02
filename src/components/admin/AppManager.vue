<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Bars3Icon, PencilSquareIcon, PlusIcon, TrashIcon } from '@heroicons/vue/24/outline'
import AppFormDialog from '@/components/admin/AppFormDialog.vue'
import SortableList from '@/components/admin/SortableList.vue'
import AppIcon from '@/components/common/AppIcon.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { useReorder, type ReorderEvent } from '@/composables/useReorder'
import { useToast } from '@/composables/useToast'
import { useDataStore } from '@/stores/data'
import type { AppItem } from '@/types'

const store = useDataStore()
const toast = useToast()

const activeGroupId = ref('')

watch(
  () => store.sortedGroups,
  (groups) => {
    if (!groups.length) {
      activeGroupId.value = ''
      return
    }
    if (!groups.some((group) => group.id === activeGroupId.value)) {
      activeGroupId.value = groups[0]?.id ?? ''
    }
  },
  { immediate: true },
)

const sourceItems = computed(() => store.groupItems(activeGroupId.value))

const { list, saving, onStart, resolveMovedId, commit } = useReorder({
  source: () => sourceItems.value,
  getId: (item) => item.id,
  persist: (id, toIndex) => store.moveItem(activeGroupId.value, id, toIndex),
})

const formOpen = ref(false)
const editingItem = ref<AppItem | null>(null)

const deleteOpen = ref(false)
const deletingItem = ref<AppItem | null>(null)

function openCreate(): void {
  editingItem.value = null
  formOpen.value = true
}

function openEdit(item: AppItem): void {
  editingItem.value = item
  formOpen.value = true
}

function askDelete(item: AppItem): void {
  deletingItem.value = item
  deleteOpen.value = true
}

async function confirmDelete(): Promise<void> {
  if (!deletingItem.value) return
  try {
    await store.deleteItem(deletingItem.value.id)
    toast.success('应用已删除')
  } catch (err) {
    toast.fromError(err, '删除失败')
  } finally {
    deleteOpen.value = false
    deletingItem.value = null
  }
}

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
    toast.success(enabled ? '已启用' : '已停用', enabled ? `${item.name} 会在前台显示` : `${item.name} 不再对前台展示`)
  } catch (err) {
    toast.fromError(err, '状态修改失败')
  } finally {
    togglingId.value = ''
  }
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="min-w-0">
        <h2 class="text-sm font-semibold">应用</h2>
        <p class="text-xs text-muted-foreground">同组内可拖动排序，松手即保存</p>
      </div>

      <div class="flex items-center gap-2">
        <Select
          :model-value="activeGroupId"
          @update:model-value="(value) => (activeGroupId = String(value ?? ''))"
        >
          <SelectTrigger class="w-44">
            <SelectValue placeholder="选择应用组" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="group in store.sortedGroups" :key="group.id" :value="group.id">
              {{ group.name }}
            </SelectItem>
          </SelectContent>
        </Select>

        <Button size="sm" class="gap-1.5" :disabled="!store.sortedGroups.length" @click="openCreate">
          <PlusIcon class="size-4" />
          新增应用
        </Button>
      </div>
    </div>

    <EmptyState
      v-if="!store.sortedGroups.length"
      title="先创建应用组"
      description="应用必须归属到某个分组下。"
    />

    <EmptyState
      v-else-if="!list.length"
      title="这个分组还没有应用"
      description="点右上角「新增应用」添加第一个。"
    />

    <SortableList
      v-else
      v-model="list"
      :disabled="saving"
      @start="onStart"
      @end="handleEnd"
    >
      <div
        v-for="item in list"
        :key="item.id"
        class="flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5"
      >
        <button type="button" class="drag-handle cursor-grab text-muted-foreground/60" aria-label="拖动排序">
          <Bars3Icon class="size-4" />
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
        <div class="flex shrink-0 items-center gap-1.5">
          <Switch
            :model-value="item.enabled"
            :disabled="togglingId === item.id"
            :aria-label="item.enabled ? `停用 ${item.name}` : `启用 ${item.name}`"
            @update:model-value="(value) => toggleEnabled(item, value === true)"
          />
        </div>

        <Button variant="ghost" size="icon-sm" aria-label="编辑" @click="openEdit(item)">
          <PencilSquareIcon class="size-4" />
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label="删除" @click="askDelete(item)">
          <TrashIcon class="size-4" />
        </Button>
      </div>
    </SortableList>

    <AppFormDialog v-model:open="formOpen" :item="editingItem" />

    <Dialog v-model:open="deleteOpen">
      <DialogContent class="max-w-sm">
        <DialogHeader>
          <DialogTitle>删除应用？</DialogTitle>
          <DialogDescription>
            「{{ deletingItem?.name }}」将被永久删除，此操作不可撤销。
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" @click="deleteOpen = false">取消</Button>
          <Button variant="destructive" @click="confirmDelete">确认删除</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
