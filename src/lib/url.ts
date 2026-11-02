import type { AppItem } from '@/types'

/**
 * 点应用时打开的地址。
 *
 * `url`（线上地址）是主入口；没填就退回 `git_url`，
 * 这样老数据（还没有 url 列的记录）行为不变，不会点了没反应。
 */
export function appHref(item: Pick<AppItem, 'url' | 'git_url'>): string {
  return item.url.trim() || item.git_url
}

/** 展示用地址：去掉协议、结尾 .git 和斜杠 */
export function displayHref(href: string): string {
  return href
    .replace(/^https?:\/\//i, '')
    .replace(/\.git$/i, '')
    .replace(/\/$/, '')
}
