import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase, TABLES } from '@/lib/supabase'
import { DEFAULT_THEME_COLOR } from '@/lib/palette'
import { bySortAsc, nextSortValue, planMove, type MovePlan } from '@/lib/sort'
import { tagDocId } from '@/lib/utils'
import type {
  AppGroup,
  AppItem,
  AppItemWrite,
  IsoTimestamp,
  ItemForm,
  SearchHit,
  TagDoc,
  TagOption,
} from '@/types'

type Row = Record<string, unknown>

const EPOCH = new Date(0).toISOString()

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function num(value: unknown, fallback = 0): number {
  return typeof value === 'number' ? value : fallback
}

function toIso(value: unknown): IsoTimestamp {
  return typeof value === 'string' ? value : EPOCH
}

function toGroup(row: Row): AppGroup {
  return {
    id: str(row.id),
    name: str(row.name, '未命名分组'),
    sort: num(row.sort),
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at),
  }
}

function toItem(row: Row): AppItem {
  const rawTags = Array.isArray(row.tags) ? row.tags : []
  return {
    id: str(row.id),
    group_id: str(row.group_id),
    name: str(row.name, '未命名应用'),
    git_url: str(row.git_url),
    readme_raw: str(row.readme_raw),
    intro: str(row.intro),
    // 缺列（老库还没跑增量 SQL）时按启用处理，不要整条数据变不可见
    enabled: row.enabled !== false,
    hero_icon_name: str(row.hero_icon_name),
    theme_color: (str(row.theme_color) || DEFAULT_THEME_COLOR) as AppItem['theme_color'],
    tags: rawTags.filter((tag): tag is string => typeof tag === 'string' && tag.trim().length > 0),
    sort: num(row.sort),
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at),
  }
}

function toTag(row: Row): TagDoc {
  return {
    id: str(row.id),
    name: str(row.name),
    created_at: toIso(row.created_at),
  }
}

/** 去重（忽略大小写）+ 去空白 + 限 10 个，保留用户第一次输入的写法 */
function normalizeTags(tags: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const raw of tags) {
    const name = raw.trim()
    if (!name) continue
    const key = name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    result.push(name)
    if (result.length >= 10) break
  }
  return result
}

/**
 * 把 Postgres / RLS 的英文报错翻成人话。
 * 联调阶段最常见的三类：没进白名单、字段没过 check、同一位置重复。
 */
function friendlyError(message: string): string {
  const text = message.toLowerCase()
  if (text.includes('row-level security') || text.includes('permission denied')) {
    return '没有写权限：请确认当前账号的 uid 已写入 admins 表'
  }
  if (text.includes('violates check constraint')) {
    return '内容不符合约束：请检查名称长度、Git 地址格式与标签数量'
  }
  if (text.includes('duplicate key')) {
    return '已存在同名记录'
  }
  if (text.includes('foreign key')) {
    return '所属应用组不存在或已被删除'
  }
  return message
}

/** RLS 挡住 update/delete 时 Supabase 不报错、只返回 0 行，必须自己判空 */
function assertAffected(rows: unknown[] | null, action: string): void {
  if (!rows || rows.length === 0) {
    throw new Error(`没有${action}任何记录：可能没有权限，或目标已被删除`)
  }
}

export const useDataStore = defineStore('data', () => {
  const groups = ref<AppGroup[]>([])
  const items = ref<AppItem[]>([])
  const tags = ref<TagDoc[]>([])
  const loading = ref(true)
  const error = ref<string | null>(null)

  // ---------------------------------------------------------------- getters

  const sortedGroups = computed(() => [...groups.value].sort(bySortAsc))

  const itemsByGroup = computed(() => {
    const map = new Map<string, AppItem[]>()
    for (const item of [...items.value].sort(bySortAsc)) {
      const list = map.get(item.group_id)
      if (list) list.push(item)
      else map.set(item.group_id, [item])
    }
    return map
  })

  /** 前台用：停用的应用不展示，但后台列表仍要能看到它们 */
  const enabledByGroup = computed(() => {
    const map = new Map<string, AppItem[]>()
    for (const [groupId, list] of itemsByGroup.value) {
      const visible = list.filter((item) => item.enabled)
      if (visible.length > 0) map.set(groupId, visible)
    }
    return map
  })

  const enabledCount = computed(() => items.value.filter((item) => item.enabled).length)

  const tagOptions = computed<TagOption[]>(() => {
    const usage = new Map<string, number>()
    for (const item of items.value) {
      if (!item.enabled) continue
      for (const tag of item.tags) usage.set(tag, (usage.get(tag) ?? 0) + 1)
    }
    const names = new Set<string>(tags.value.map((tag) => tag.name))
    for (const tag of usage.keys()) names.add(tag)
    return [...names]
      .map((name) => ({ name, count: usage.get(name) ?? 0 }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh-Hans-CN'))
  })

  /** 后台用：包含已停用的应用 */
  function groupItems(groupId: string): AppItem[] {
    return itemsByGroup.value.get(groupId) ?? []
  }

  /** 前台用：只返回启用中的应用 */
  function visibleGroupItems(groupId: string): AppItem[] {
    return enabledByGroup.value.get(groupId) ?? []
  }

  function groupName(groupId: string): string {
    return groups.value.find((group) => group.id === groupId)?.name ?? '未分组'
  }

  /** 全局搜索：命中应用名、简介或任一标签，忽略分组；只搜启用中的应用 */
  function search(rawQuery: string): SearchHit[] {
    const query = rawQuery.trim().toLowerCase()
    if (!query) return []
    const hits: SearchHit[] = []
    for (const item of [...items.value].sort(bySortAsc)) {
      if (!item.enabled) continue
      const matchedTags = item.tags.filter((tag) => tag.toLowerCase().includes(query))
      if (
        item.name.toLowerCase().includes(query) ||
        item.intro.toLowerCase().includes(query) ||
        matchedTags.length > 0
      ) {
        hits.push({ item, matchedTags })
      }
    }
    return hits
  }

  // ------------------------------------------------------------------ 读取

  async function refreshGroups(quiet = false): Promise<void> {
    const { data, error: err } = await supabase
      .from(TABLES.groups)
      .select('*')
      .order('sort', { ascending: true })
    if (err) throw new Error(friendlyError(err.message))
    groups.value = (data ?? []).map((row) => toGroup(row as Row))
    if (quiet === false) loading.value = false
  }

  async function refreshItems(quiet = false): Promise<void> {
    const { data, error: err } = await supabase
      .from(TABLES.items)
      .select('*')
      .order('sort', { ascending: true })
    if (err) throw new Error(friendlyError(err.message))
    items.value = (data ?? []).map((row) => toItem(row as Row))
    if (quiet === false) loading.value = false
  }

  async function refreshTags(quiet = false): Promise<void> {
    const { data, error: err } = await supabase.from(TABLES.tags).select('*')
    if (err) throw new Error(friendlyError(err.message))
    tags.value = (data ?? []).map((row) => toTag(row as Row))
    if (quiet === false) loading.value = false
  }

  // -------------------------------------------------------------- 订阅 / 实时

  let channel: RealtimeChannel | null = null
  /** 引用计数：多个页面可能同时订阅，谁也不能替别人拆监听 */
  let subscriberCount = 0
  /** 代数：用于丢弃「已销毁之后才完成」的异步结果 */
  let generation = 0

  function handleError(err: unknown): void {
    error.value = err instanceof Error ? err.message : '数据加载失败，请检查网络与 RLS 策略'
    loading.value = false
  }

  async function startListeners(): Promise<void> {
    const current = ++generation
    error.value = null
    loading.value = true

    try {
      await Promise.all([refreshGroups(), refreshItems(), refreshTags()])
    } catch (err) {
      handleError(err)
    } finally {
      if (current === generation) loading.value = false
    }

    if (current !== generation) return

    // 后台改完，前台通过 realtime 立刻刷新；RLS 已放行匿名 select
    channel = supabase
      .channel(`toolbox:${current}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLES.groups }, () => {
        void refreshGroups(true).catch(handleError)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLES.items }, () => {
        void refreshItems(true).catch(handleError)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLES.tags }, () => {
        void refreshTags(true).catch(handleError)
      })
      .subscribe()
  }

  function stopListeners(): void {
    generation += 1
    if (channel) {
      void supabase.removeChannel(channel)
      channel = null
    }
  }

  /** 返回的释放函数幂等：重复调用不会重复扣减计数 */
  function subscribe(): () => void {
    subscriberCount += 1
    if (subscriberCount === 1) void startListeners()

    let released = false
    return () => {
      if (released) return
      released = true
      subscriberCount = Math.max(0, subscriberCount - 1)
      if (subscriberCount === 0) stopListeners()
    }
  }

  function unsubscribe(): void {
    subscriberCount = 0
    stopListeners()
  }

  // ------------------------------------------------------------------ 写入

  function buildItemPayload(
    form: ItemForm,
    sort: number,
    readmeRaw: string,
    enabled: boolean,
  ): AppItemWrite {
    return {
      group_id: form.group,
      name: form.name.trim(),
      git_url: form.git_url.trim(),
      readme_raw: readmeRaw,
      intro: form.intro.trim(),
      enabled,
      hero_icon_name: form.hero_icon_name,
      theme_color: form.theme_color,
      tags: normalizeTags(form.tags),
      sort,
    }
  }

  /** 新标签幂等入池：id = lower(trim(name))，冲突直接忽略 */
  async function upsertTags(names: string[]): Promise<void> {
    const rows = normalizeTags(names).map((name) => ({ id: tagDocId(name), name }))
    if (rows.length === 0) return

    const { error: err } = await supabase
      .from(TABLES.tags)
      .upsert(rows, { onConflict: 'id', ignoreDuplicates: true })
    if (err) throw new Error(friendlyError(err.message))
    await refreshTags(true)
  }

  async function applyMovePlan(table: string, plan: MovePlan): Promise<void> {
    if (plan.sort !== null) {
      const { error: err } = await supabase
        .from(table)
        .update({ sort: plan.sort })
        .eq('id', plan.targetId)
      if (err) throw new Error(friendlyError(err.message))
    } else {
      // 浮点间隙耗尽：整组重排（没有事务，逐条并发写，失败即抛）
      const results = await Promise.all(
        plan.renumber.map((entry) =>
          supabase
            .from(table)
            .update({ sort: entry.sort })
            .eq('id', entry.id),
        ),
      )
      const failure = results.find((result) => result.error)
      if (failure?.error) throw new Error(friendlyError(failure.error.message))
    }

    if (table === TABLES.groups) await refreshGroups(true)
    else await refreshItems(true)
  }

  // ---------------------------------------------------------- group actions

  async function createGroup(name: string): Promise<void> {
    const trimmed = name.trim()
    if (!trimmed) throw new Error('应用组名称不能为空')

    const { error: err } = await supabase
      .from(TABLES.groups)
      .insert({ name: trimmed, sort: nextSortValue(groups.value) })
    if (err) throw new Error(friendlyError(err.message))

    await refreshGroups(true)
  }

  async function renameGroup(id: string, name: string): Promise<void> {
    const trimmed = name.trim()
    if (!trimmed) throw new Error('应用组名称不能为空')

    const { error: err } = await supabase
      .from(TABLES.groups)
      .update({ name: trimmed })
      .eq('id', id)
      .select('id')
    if (err) throw new Error(friendlyError(err.message))

    await refreshGroups(true)
  }

  /** 删组即删组内应用：外键 on delete cascade 由数据库保证，客户端不用批量删除 */
  async function deleteGroup(groupId: string): Promise<void> {
    const { data, error: err } = await supabase
      .from(TABLES.groups)
      .delete()
      .eq('id', groupId)
      .select('id')
    if (err) throw new Error(friendlyError(err.message))
    assertAffected(data as unknown[] | null, '删除')

    await Promise.all([refreshGroups(true), refreshItems(true)])
  }

  async function moveGroup(id: string, toIndex: number): Promise<void> {
    const list = sortedGroups.value.map((group) => ({ id: group.id, sort: group.sort }))
    await applyMovePlan(TABLES.groups, planMove(list, id, toIndex))
  }

  // ----------------------------------------------------------- item actions

  async function createItem(form: ItemForm, readmeRaw: string): Promise<void> {
    const payload = buildItemPayload(form, nextSortValue(groupItems(form.group)), readmeRaw, true)

    const { error: err } = await supabase.from(TABLES.items).insert(payload)
    if (err) throw new Error(friendlyError(err.message))

    await Promise.all([refreshItems(true), upsertTags(form.tags)])
  }

  async function updateItem(id: string, form: ItemForm, readmeRaw?: string): Promise<void> {
    const existing = items.value.find((item) => item.id === id)
    if (!existing) throw new Error('应用不存在或已被其他人删除')

    const groupChanged = existing.group_id !== form.group
    // 换组时排到新组末尾，否则保留原位置
    const sort = groupChanged ? nextSortValue(groupItems(form.group)) : existing.sort
    const readme = readmeRaw ?? existing.readme_raw

    const { error: err } = await supabase
      .from(TABLES.items)
      .update(buildItemPayload(form, sort, readme, existing.enabled))
      .eq('id', id)
    if (err) throw new Error(friendlyError(err.message))

    await Promise.all([refreshItems(true), upsertTags(form.tags)])
  }

  /** 启用 / 停用：只改一列，走 RLS 的 update 策略 */
  async function setItemEnabled(id: string, enabled: boolean): Promise<void> {
    const { data, error: err } = await supabase
      .from(TABLES.items)
      .update({ enabled })
      .eq('id', id)
      .select('id')
    if (err) throw new Error(friendlyError(err.message))
    assertAffected(data as unknown[] | null, '修改状态')

    await refreshItems(true)
  }

  async function deleteItem(id: string): Promise<void> {
    const { data, error: err } = await supabase
      .from(TABLES.items)
      .delete()
      .eq('id', id)
      .select('id')
    if (err) throw new Error(friendlyError(err.message))
    assertAffected(data as unknown[] | null, '删除')

    await refreshItems(true)
  }

  async function moveItem(groupId: string, id: string, toIndex: number): Promise<void> {
    const list = groupItems(groupId).map((item) => ({ id: item.id, sort: item.sort }))
    await applyMovePlan(TABLES.items, planMove(list, id, toIndex))
  }

  // ------------------------------------------------------------ tag actions

  /** 标签输入框失焦/回车时调用：新标签幂等入池 */
  async function ensureTags(names: string[]): Promise<void> {
    await upsertTags(names)
  }

  return {
    // state
    groups,
    items,
    tags,
    loading,
    error,
    // getters
    sortedGroups,
    itemsByGroup,
    enabledByGroup,
    enabledCount,
    tagOptions,
    groupItems,
    visibleGroupItems,
    groupName,
    search,
    // lifecycle
    subscribe,
    unsubscribe,
    // actions
    createGroup,
    renameGroup,
    deleteGroup,
    moveGroup,
    createItem,
    updateItem,
    setItemEnabled,
    deleteItem,
    moveItem,
    ensureTags,
  }
})
