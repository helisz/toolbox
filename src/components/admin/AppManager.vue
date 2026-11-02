<script setup lang="ts">
import { ref } from 'vue'
import { Plus } from 'lucide-vue-next'
import AppFormDialog from '@/components/admin/AppFormDialog.vue'
import AppGroupSection from '@/components/admin/AppGroupSection.vue'
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
import { useToast } from '@/composables/useToast'
import { useDataStore } from '@/stores/data'
import type { AppItem } from '@/types'

const store = useDataStore()
const toast = useToast()

const formOpen = ref(false)
const editingItem = ref<AppItem | null>(null)
/** 从某个分组里点「添加」时，表单默认选中那个组 */
const presetGroupId = ref('')

const deleteOpen = ref(false)
const deletingItem = ref<AppItem | null>(null)

function openCreate(groupId = ''): void {
  editingItem.value = null
  presetGroupId.value = groupId
  formOpen.value = true
}

function openEdit(item: AppItem): void {
  editingItem.value = item
  presetGroupId.value = ''
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
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="min-w-0">
        <h2 class="text-sm font-semibold">应用</h2>
        <p class="text-xs text-muted-foreground">
          按应用组分组展示，组内可拖动排序，松手即保存
        </p>
      </div>

      <Button size="sm" class="gap-1.5" :disabled="!store.sortedGroups.length" @click="openCreate()">
        <Plus class="size-4" />
        新增应用
      </Button>
    </div>

    <!-- 老库缺 url 列时明确提示：否则用户填了线上地址、保存后却查无此项 -->
    <div
      v-if="store.urlColumnMissing"
      class="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive"
    >
      数据库还没有 <code class="font-mono">url</code> 列，「线上地址」现在保存不了。请在 Supabase SQL
      Editor 里重跑 <code class="font-mono">supabase/schema.sql</code>。
    </div>

    <EmptyState
      v-if="!store.sortedGroups.length"
      title="先创建应用组"
      description="应用必须归属到某个分组下。"
    />

    <!-- 一个分组一段，各自独立拖拽；空分组也保留，方便直接往里加 -->
    <template v-else>
      <AppGroupSection
        v-for="group in store.sortedGroups"
        :key="group.id"
        :group="group"
        @create="openCreate"
        @edit="openEdit"
        @remove="askDelete"
      />
    </template>

    <AppFormDialog v-model:open="formOpen" :item="editingItem" :default-group-id="presetGroupId" />

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
