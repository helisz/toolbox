import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

/**
 * tag_pool 的主键：归一化标签名（lower + trim）。
 * Postgres 的 text 主键不限制字符，所以 "CI/CD" 这类名字不用再转义。
 * 同一个标签名永远映射到同一个 id，因此「输入新标签自动入池」可以写成幂等 upsert。
 */
export function tagDocId(name: string): string {
  return name.trim().toLowerCase()
}
