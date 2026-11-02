import { defineAsyncComponent, type Component } from 'vue'

/**
 * 图标库：Lucide（https://github.com/lucide-icons/lucide）。
 *
 * 现在前台卡片以**上传的封面图**为主（`image_path`），图标只作为「没传封面的老数据」的兜底，
 * 后台也不再提供图标选择器。
 *
 * 所以图标索引表（`lib/icon-modules.ts`，140KB 级别的 glob 映射）改成**动态加载**：
 * 首页正常只显示封面图，根本不会下载它；真碰到没封面的记录才拉一次，之后走缓存。
 */
/** 找不到图标时的兜底 */
export const DEFAULT_ICON_SLUG = 'layout-grid'

let modulesPromise: Promise<typeof import('@/lib/icon-modules')> | null = null

function loadIconModules(): Promise<typeof import('@/lib/icon-modules')> {
  modulesPromise ??= import('@/lib/icon-modules')
  return modulesPromise
}

/**
 * 老数据是按 Heroicons 的名字存的（`squares-2x2` / `paper-airplane` / `cog6-tooth` …），
 * 换库后这些名字在 Lucide 里不存在。这里做一层翻译，
 * 让历史数据继续显示语义相同的图标，而不是集体退化成默认图标。
 */
const LEGACY_ALIASES: Record<string, string> = {
  'squares-2x2': 'layout-grid',
  'squares-plus': 'layout-grid',
  'paper-airplane': 'send',
  'cog-6-tooth': 'settings',
  'cog6-tooth': 'settings',
  cog: 'settings',
  'rocket-launch': 'rocket',
  'code-bracket': 'code',
  'code-bracket-square': 'square-code',
  'chart-bar': 'chart-column',
  'chart-bar-square': 'chart-column',
  'arrow-top-right-on-square': 'external-link',
  'arrow-path': 'refresh-cw',
  'arrow-left-start-on-rectangle': 'log-out',
  'magnifying-glass': 'search',
  'x-mark': 'x',
  'bars-3': 'menu',
  'ellipsis-horizontal': 'ellipsis',
  'trash': 'trash-2',
  'pencil-square': 'square-pen',
  'lock-closed': 'lock',
  'lock-open': 'lock-open',
  home: 'house',
  'folder-open': 'folder-open',
  'check-circle': 'circle-check',
  'x-circle': 'circle-x',
  'exclamation-triangle': 'triangle-alert',
  'information-circle': 'info',
  'question-mark-circle': 'circle-help',
  'clipboard-document': 'clipboard',
  'document-text': 'file-text',
  'book-open': 'book-open',
  'swatch': 'palette',
  'paint-brush': 'paintbrush',
  'sparkles': 'sparkles',
  'cube': 'box',
  'cube-transparent': 'box',
  'device-phone-mobile': 'smartphone',
  'computer-desktop': 'monitor',
  'circle-stack': 'database',
  'server-stack': 'server',
  'cloud-arrow-up': 'cloud-upload',
  'globe-alt': 'globe',
  'user-circle': 'circle-user',
  'users': 'users',
  'shield-check': 'shield-check',
  'key': 'key',
  'bell': 'bell',
  'envelope': 'mail',
  'chat-bubble-left': 'message-square',
  'photo': 'image',
  'film': 'film',
  'musical-note': 'music',
  'play': 'play',
  'pause': 'pause',
  'stop': 'square',
  'arrow-down-tray': 'download',
  'arrow-up-tray': 'upload',
  'document-duplicate': 'copy',
  'scissors': 'scissors',
  'wrench-screwdriver': 'wrench',
  'beaker': 'flask-conical',
  'bolt': 'zap',
  'fire': 'flame',
  'clock': 'clock',
  'calendar-days': 'calendar-days',
  'map-pin': 'map-pin',
  'heart': 'heart',
  'star': 'star',
  'bookmark': 'bookmark',
  'flag': 'flag',
  'trophy': 'trophy',
  'gift': 'gift',
  'credit-card': 'credit-card',
  'banknotes': 'banknote',
  'shopping-cart': 'shopping-cart',
  'lifebuoy': 'life-buoy',
  'wifi': 'wifi',
  'signal': 'signal',
  'power': 'power',
  'sun': 'sun',
  'moon': 'moon',
}

/** slug → 组件。异步组件包一层，避免同一个图标被重复创建 */
const cache = new Map<string, Component>()

/** 只做别名翻译，不校验存在性：真正的判定留到加载索引表时（那时才知道有哪些图标） */
function normalize(slug: string | undefined | null): string {
  const raw = (slug ?? '').trim().toLowerCase()
  if (!raw) return DEFAULT_ICON_SLUG
  return LEGACY_ALIASES[raw] ?? raw
}

/**
 * 取图标组件。**同步返回**（渲染处不用处理 loading），
 * 内部是异步组件：真要显示时才会拉索引表 + 那一个图标文件，之后走缓存。
 */
export function resolveIcon(slug?: string | null): Component {
  const key = normalize(slug)
  const cached = cache.get(key)
  if (cached) return cached

  const component = defineAsyncComponent(async () => {
    const { ICON_DIR, iconModules } = await loadIconModules()
    const loader =
      iconModules[ICON_DIR + key + '.js'] ?? iconModules[ICON_DIR + DEFAULT_ICON_SLUG + '.js']
    if (!loader) throw new Error(`找不到图标：${key}`)
    return (await loader()).default
  })

  cache.set(key, component)
  return component
}
