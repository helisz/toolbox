import { defineAsyncComponent, type Component } from 'vue'

/**
 * 图标库：Lucide（https://github.com/lucide-icons/lucide），共 1700+ 个。
 *
 * 关键取舍：**不把整个图标库打进首屏**。
 * 1700 个图标全量引入大约会让包体翻好几倍，而一个页面通常只用得到几个，
 * 所以这里用 `import.meta.glob` 把每个图标变成独立的按需 chunk，
 * 只有真正渲染到的图标才会被下载（单文件几百字节）。
 *
 * 需要成片显示图标的地方（如后台图标选择器）另走 `lib/icon-presets.ts` 的静态集合。
 */
const ICON_DIR = '/node_modules/lucide-vue-next/dist/esm/icons/'

const iconModules = import.meta.glob('/node_modules/lucide-vue-next/dist/esm/icons/*.js') as Record<
  string,
  () => Promise<{ default: Component }>
>

/** 全部可用图标名（kebab-case），后台搜索用 */
export const ICON_SLUGS: string[] = Object.keys(iconModules)
  .map((path) => path.slice(ICON_DIR.length).replace(/\.js$/, ''))
  .sort()

const iconSlugSet = new Set(ICON_SLUGS)

/** 找不到图标时的兜底 */
export const DEFAULT_ICON_SLUG = 'layout-grid'

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

function normalize(slug: string | undefined | null): string {
  const raw = (slug ?? '').trim().toLowerCase()
  if (!raw) return DEFAULT_ICON_SLUG
  if (iconSlugSet.has(raw)) return raw
  const alias = LEGACY_ALIASES[raw]
  if (alias && iconSlugSet.has(alias)) return alias
  return DEFAULT_ICON_SLUG
}

/**
 * 取图标组件。同步返回，首次调用会注册一个异步组件，
 * 图标本体在渲染时才下载（已缓存的不会再发请求）。
 */
export function resolveIcon(slug?: string | null): Component {
  const key = normalize(slug)
  const cached = cache.get(key)
  if (cached) return cached

  const loader = iconModules[ICON_DIR + key + '.js']
  const component: Component = loader
    ? defineAsyncComponent(() => loader().then((mod) => mod.default))
    : (cache.get(DEFAULT_ICON_SLUG) ?? defineAsyncComponent(() =>
        iconModules[ICON_DIR + DEFAULT_ICON_SLUG + '.js']!().then((mod) => mod.default),
      ))

  cache.set(key, component)
  return component
}

export function isValidIconSlug(slug: string): boolean {
  return iconSlugSet.has(slug)
}
