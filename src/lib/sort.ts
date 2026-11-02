/**
 * 排序值策略：sort 是 float64，拖拽时只改被移动的那一条，取前后邻居的中点。
 * 这样一次拖动只写 1 行，而不是 UPDATE 整组 N 行。
 */
export const SORT_STEP = 1000

/** 浮点中点在小数位耗尽前的最小可用间隙，再小就统一重排 */
export const MIN_SORT_GAP = 1e-6

export interface SortableDoc {
  id: string
  sort: number
}

/**
 * 计算把 `id` 移动到 `toIndex` 后的新 sort。
 * 返回 null 表示间隙已经不够（连续拖同一位置几百次），调用方应整组重排。
 */
export function computeSortValue(prev: number | undefined, next: number | undefined): number | null {
  if (prev === undefined && next === undefined) return SORT_STEP
  if (prev === undefined && next !== undefined) return next - SORT_STEP
  if (prev !== undefined && next === undefined) return prev + SORT_STEP

  const gap = (next as number) - (prev as number)
  if (gap < MIN_SORT_GAP) return null
  return (prev as number) + gap / 2
}

export interface MovePlan {
  /** 只需要更新这一条 */
  targetId: string
  /** null 表示要走重排分支 */
  sort: number | null
  /** 重排分支：整组的完整新顺序 */
  renumber: Array<{ id: string; sort: number }>
}

/**
 * 把 `id` 移到 `toIndex`（移动后的目标下标）的写入计划。
 * 入参 list 必须已经按 sort 升序排好。
 */
export function planMove(list: SortableDoc[], id: string, toIndex: number): MovePlan {
  const without = list.filter((doc) => doc.id !== id)
  const clamped = Math.max(0, Math.min(toIndex, without.length))
  const prev = without[clamped - 1]?.sort
  const next = without[clamped]?.sort

  const sort = computeSortValue(prev, next)
  if (sort !== null) {
    return { targetId: id, sort, renumber: [] }
  }

  const ordered = [...without.slice(0, clamped), { id, sort: 0 }, ...without.slice(clamped)]
  return {
    targetId: id,
    sort: null,
    renumber: ordered.map((doc, index) => ({ id: doc.id, sort: (index + 1) * SORT_STEP })),
  }
}

/** 新建条目时追加到末尾 */
export function nextSortValue(list: SortableDoc[]): number {
  const max = list.reduce((acc, doc) => Math.max(acc, doc.sort), 0)
  return max + SORT_STEP
}

export function bySortAsc<T extends { sort: number }>(a: T, b: T): number {
  return a.sort - b.sort
}
