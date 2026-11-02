import { ref, toValue, watch, type MaybeRefOrGetter, type Ref } from 'vue'

interface UseReorderOptions<T> {
  /** 已按 sort 排好序的源列表（通常来自 store getter） */
  source: MaybeRefOrGetter<T[]>
  getId: (item: T) => string
  /** 落库：只传被移动项的 id 和目标下标 */
  persist: (id: string, toIndex: number) => Promise<void>
}

/** Sortable.js 拖拽事件里我们只用这两个字段 */
export interface ReorderEvent {
  oldIndex?: number | null
  newIndex?: number | null
}

/**
 * 拖拽排序的通用封装：本地先动（拖拽库直接改 list），落库失败就回滚到快照。
 *
 * 之所以传 (id, toIndex) 而不是整个顺序数组：
 * 由 store 用「前后邻居取中点」算新 sort，这样才能一次只写一个文档。
 *
 * 被移动项从**拖拽前**的快照里按 oldIndex 取，而不是读拖动后的数组 ——
 * 拖拽库更新 v-model 的时机与 end 事件不保证同步，读快照才不会错位。
 */
export function useReorder<T>(options: UseReorderOptions<T>) {
  const list = ref([]) as Ref<T[]>
  const saving = ref(false)
  let snapshot: T[] = []

  watch(
    () => toValue(options.source),
    (next) => {
      list.value = [...next]
    },
    { immediate: true },
  )

  /** 拖拽开始时调用，记录回滚快照 */
  function onStart(): void {
    snapshot = [...list.value]
  }

  /** 从拖拽前快照里取被移动项的 id */
  function resolveMovedId(oldIndex?: number | null): string | undefined {
    if (oldIndex === undefined || oldIndex === null) return undefined
    const moved = snapshot[oldIndex]
    return moved ? options.getId(moved) : undefined
  }

  /** 拖拽结束时调用 */
  async function commit(id: string, toIndex: number): Promise<void> {
    saving.value = true
    try {
      await options.persist(id, toIndex)
    } catch (err) {
      list.value = [...snapshot]
      throw err
    } finally {
      saving.value = false
    }
  }

  return { list, saving, onStart, resolveMovedId, commit }
}
