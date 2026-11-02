/**
 * 预设封面：`src/images/placeholder_icons/*.webp`
 *
 * 这些图在仓库里就以 **600×900 WebP** 的形式存在（和上传后的产物同规格），
 * 随包发布，所以选预设时**不占用 Storage、也没有上传请求**。
 *
 * 库里存的是一个记号 `preset:<文件名>`，由 `coverUrl()` 解析成打包后的地址。
 */
const PRESET_PREFIX = 'preset:'

const modules = import.meta.glob('/src/images/placeholder_icons/*.webp', {
  eager: true,
  import: 'default',
}) as Record<string, string>

export interface CoverPreset {
  /** 存进 `app_item.image_path` 的值 */
  id: string
  /** 打包后的静态地址 */
  url: string
}

function stemOf(path: string): string {
  const file = path.slice(path.lastIndexOf('/') + 1)
  return file.replace(/\.webp$/i, '')
}

/** 按文件名里的数字排序，避免出现 1、11、12、2、3 这种顺序 */
function numericOrder(a: string, b: string): number {
  const na = Number(a)
  const nb = Number(b)
  if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb
  return a.localeCompare(b)
}

export const COVER_PRESETS: CoverPreset[] = Object.entries(modules)
  .map(([path, url]) => ({ id: PRESET_PREFIX + stemOf(path), url }))
  .sort((a, b) => numericOrder(a.id.slice(PRESET_PREFIX.length), b.id.slice(PRESET_PREFIX.length)))

const byId = new Map(COVER_PRESETS.map((preset) => [preset.id, preset.url]))

export function isPresetCover(path?: string | null): boolean {
  return Boolean(path && path.startsWith(PRESET_PREFIX))
}

/** 预设的静态地址；不是预设或找不到就返回空字符串 */
export function presetCoverUrl(path?: string | null): string {
  if (!path) return ''
  return byId.get(path) ?? ''
}
