import type { Component } from 'vue'
import * as OutlineIcons from '@heroicons/vue/24/outline'

/**
 * 需求要求「只存图标名字（如 rocket）」。Heroicons 是独立组件，没有运行时按名取用的 API，
 * 所以要建一张 slug → 组件 的注册表。
 *
 * 取舍：`import * as` 会让 tree-shaking 失效，24/outline 约 300 个图标全进包（gzip +60~100KB）。
 * 换来的是「图标选择器能检索全量」且后端只存一个字符串。要压体积的话，
 * 改成构建期脚本生成按需 import 的映射表即可，接口不用变。
 */
function toSlug(componentName: string): string {
  return componentName
    .replace(/Icon$/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
}

export const HERO_ICONS: Record<string, Component> = Object.fromEntries(
  Object.entries(OutlineIcons)
    .filter(([name]) => name.endsWith('Icon'))
    .map(([name, component]) => [toSlug(name), component as Component]),
)

export const HERO_ICON_SLUGS: string[] = Object.keys(HERO_ICONS).sort()

/**
 * 需求原文的示例是 "rocket"，但 Heroicons 2 里叫 RocketLaunch（slug: rocket-launch），
 * 所以历史 JSON 里出现 "rocket" 时必须能兜底，而不是渲染出空白。
 */
export const DEFAULT_ICON_SLUG = 'squares-2x2'

export function resolveIcon(slug: string | undefined | null): Component {
  if (slug && HERO_ICONS[slug]) return HERO_ICONS[slug] as Component
  return (HERO_ICONS[DEFAULT_ICON_SLUG] ?? HERO_ICONS[HERO_ICON_SLUGS[0] ?? '']) as Component
}

export function isValidIconSlug(slug: string): boolean {
  return Object.prototype.hasOwnProperty.call(HERO_ICONS, slug)
}
