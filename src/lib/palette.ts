/**
 * 主题色预设。
 *
 * 两条硬约束：
 * 1. 类名必须是完整静态字符串 —— Tailwind v4 靠扫描源码文本生成类名，
 *    `text-${color}-500` 这种拼出来的动态类会被静默丢弃，页面直接没颜色。
 *    所以这里连 hover/选中态需要的变体也一并写全。
 * 2. 暗色不能直接复用亮色值 —— slate-500 压在深色底上几乎看不见，
 *    每一项都写 light/dark 两份。
 */
export interface ColorToken {
  key: string
  label: string
  /** 图标前景色 */
  text: string
  /** 图标底色 tint */
  tint: string
  /** 卡片上的主题色装饰条 */
  bar: string
}

export const THEME_COLORS = [
  {
    key: 'slate-500',
    label: '石板灰',
    text: 'text-slate-500 dark:text-slate-300',
    tint: 'bg-slate-500/10 dark:bg-slate-300/10',
    bar: 'bg-slate-400/70 dark:bg-slate-300/60',
  },
  {
    key: 'stone-500',
    label: '暖石',
    text: 'text-stone-500 dark:text-stone-300',
    tint: 'bg-stone-500/10 dark:bg-stone-300/10',
    bar: 'bg-stone-400/70 dark:bg-stone-300/60',
  },
  {
    key: 'amber-500',
    label: '琥珀',
    text: 'text-amber-600 dark:text-amber-300',
    tint: 'bg-amber-500/10 dark:bg-amber-300/10',
    bar: 'bg-amber-500/60 dark:bg-amber-300/60',
  },
  {
    key: 'emerald-500',
    label: '翠绿',
    text: 'text-emerald-600 dark:text-emerald-300',
    tint: 'bg-emerald-500/10 dark:bg-emerald-300/10',
    bar: 'bg-emerald-500/60 dark:bg-emerald-300/60',
  },
  {
    key: 'sky-500',
    label: '天蓝',
    text: 'text-sky-600 dark:text-sky-300',
    tint: 'bg-sky-500/10 dark:bg-sky-300/10',
    bar: 'bg-sky-500/60 dark:bg-sky-300/60',
  },
  {
    key: 'violet-500',
    label: '紫罗兰',
    text: 'text-violet-600 dark:text-violet-300',
    tint: 'bg-violet-500/10 dark:bg-violet-300/10',
    bar: 'bg-violet-500/60 dark:bg-violet-300/60',
  },
  {
    key: 'rose-500',
    label: '玫瑰',
    text: 'text-rose-600 dark:text-rose-300',
    tint: 'bg-rose-500/10 dark:bg-rose-300/10',
    bar: 'bg-rose-500/60 dark:bg-rose-300/60',
  },
  {
    key: 'cyan-500',
    label: '青色',
    text: 'text-cyan-600 dark:text-cyan-300',
    tint: 'bg-cyan-500/10 dark:bg-cyan-300/10',
    bar: 'bg-cyan-500/60 dark:bg-cyan-300/60',
  },
] as const

export type ThemeColorKey = (typeof THEME_COLORS)[number]['key']

export const DEFAULT_THEME_COLOR: ThemeColorKey = 'slate-500'
export type ThemeColor = ThemeColorKey

/** 后端存的 theme_color 可能是脏数据（手改、旧值），取不到就退回默认色 */
export function getColorToken(key: string | null | undefined): ColorToken {
  return THEME_COLORS.find((token) => token.key === key) ?? THEME_COLORS[0]
}
