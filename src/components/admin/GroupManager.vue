<script setup lang="ts">
import { computed, ref } from 'vue'
import { FolderPlus, GripVertical, SquarePen, Trash2 } from 'lucide-vue-next'
import SortableList from '@/components/admin/SortableList.vue'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useReorder, type ReorderEvent } from '@/composables/useReorder'
import { useToast } from '@/composables/useToast'
import { useDataStore } from '@/stores/data'
import { groupFormSchema } from '@/types'

const store = useDataStore()
const toast = useToast()

const { list, saving, onStart, resolveMovedId, commit } = useReorder({
  source: () => store.sortedGroups,
  getId: (group) => group.id,
  persist: (id, toIndex) => store.moveGroup(id, toIndex),
})

const editorOpen = ref(false)
const editingId = ref<string | null>(null)
const nameDraft = ref('')
const editorError = ref('')
const savingGroup = ref(false)

const deleteOpen = ref(false)
const deletingId = ref<string | null>(null)

const itemCounts = computed(() => {
  const result: Record<string, number> = {}
  for (const [groupId, items] of store.itemsByGroup) result[groupId] = items.length
  return result
})

const deleteTargetCount = computed(() =>
  deletingId.value ? (itemCounts.value[deletingId.value] ?? 0) : 0,
)

function openCreate(): void {
  editingId.value = null
  nameDraft.value = ''
  editorError.value = ''
  editorOpen.value = true
}

function openEdit(id: string, name: string): void {
  editingId.value = id
  nameDraft.value = name
  editorError.value = ''
  editorOpen.value = true
}

async function submitEditor(): Promise<void> {
  const parsed = groupFormSchema.safeParse({ name: nameDraft.value })
  if (!parsed.success) {
    editorError.value = parsed.error.issues[0]?.message ?? '请输入名称'
    return
  }

  savingGroup.value = true
  try {
    if (editingId.value) {
      await store.renameGroup(editingId.value, parsed.data.name)
      toast.success('已重命名')
    } else {
      await store.createGroup(parsed.data.name)
      toast.success('已创建应用组')
    }
    editorOpen.value = false
  } catch (err) {
    toast.fromError(err, '保存失败')
  } finally {
    savingGroup.value = false
  }
}

function askDelete(id: string): void {
  deletingId.value = id
  deleteOpen.value = true
}

async function confirmDelete(): Promise<void> {
  if (!deletingId.value) return
  try {
    await store.deleteGroup(deletingId.value)
    toast.success('应用组已删除')
  } catch (err) {
    toast.fromError(err, '删除失败')
  } finally {
    deleteOpen.value = false
    deletingId.value = null
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
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-sm font-semibold">应用组</h2>
        <p class="text-xs text-muted-foreground">拖动左侧手柄调整顺序，松手即保存</p>
      </div>
      <Button size="sm" class="gap-1.5" @click="openCreate">
        <FolderPlus class="size-4" />
        新增应用组
      </Button>
    </div>

    <EmptyState
      v-if="!list.length"
      title="还没有应用组"
      description="先建一个分组，比如「内部工具」「运维平台」。"
    >
      <Button size="sm" variant="outline" @click="openCreate">新增应用组</Button>
    </EmptyState>

    <SortableList v-else v-model="list" :disabled="saving" @start="onStart" @end="handleEnd">
      <div
        v-for="group in list"
        :key="group.id"
        class="flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5"
      >
        <button type="button" class="drag-handle cursor-grab text-muted-foreground/60" aria-label="拖动排序">
          <GripVertical class="size-4" />
        </button>

        <span class="min-w-0 flex-1 truncate text-sm">{{ group.name }}</span>
        <span class="text-xs tabular-nums text-muted-foreground">
          {{ itemCounts[group.id] ?? 0 }} 个应用
        </span>

        <Button variant="ghost" size="icon-sm" aria-label="重命名" @click="openEdit(group.id, group.name)">
          <SquarePen class="size-4" />
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label="删除" @click="askDelete(group.id)">
          <Trash2 class="size-4" />
        </Button>
      </div>
    </SortableList>

    <Dialog v-model:open="editorOpen">
      <DialogContent class="max-w-sm">
        <DialogHeader>
          <DialogTitle>{{ editingId ? '重命名应用组' : '新增应用组' }}</DialogTitle>
        </DialogHeader>
        <div class="space-y-1.5">
          <Label for="group-name">名称</Label>
          <Input
            id="group-name"
            v-model="nameDraft"
            placeholder="如 内部工具"
            @keydown.enter.prevent="submitEditor"
          />
          <p v-if="editorError" class="text-xs text-destructive">{{ editorError }}</p>
        </div>
        <DialogFooter>
          <Button variant="ghost" @click="editorOpen = false">取消</Button>
          <Button :disabled="savingGroup" @click="submitEditor">
            {{ savingGroup ? '保存中…' : '保存' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog v-model:open="deleteOpen">
      <DialogContent class="max-w-sm">
        <DialogHeader>
          <DialogTitle>删除应用组？</DialogTitle>
          <DialogDescription>
            该组下的 {{ deleteTargetCount }} 个应用会被一起删除，此操作不可撤销。
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
