import type { Component } from 'vue'

/**
 * Lucide 图标的**按需索引**（1700+ 个）。
 *
 * 单独放一个文件是刻意的：这张 `import.meta.glob` 映射表本身就有 ~140KB（gzip 后 ~35KB），
 * 而它只有「老数据没传封面、退回图标」时才会用到。放在主包里会让首页白吃这份体积，
 * 所以 `lib/icons.ts` 用动态 `import()` 拉它 —— 真的需要时才下载。
 */
export const ICON_DIR = '/node_modules/lucide-vue-next/dist/esm/icons/'

export const iconModules = import.meta.glob('/node_modules/lucide-vue-next/dist/esm/icons/*.js') as Record<
  string,
  () => Promise<{ default: Component }>
>
