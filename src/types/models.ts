import type { ThemeColor } from '@/lib/palette'

/** Supabase 返回的 timestamptz 是 ISO 字符串 */
export type IsoTimestamp = string

/** Heroicons slug，如 `rocket-launch`、`code-bracket`。具体值域由前端注册表决定 */
export type IconSlug = string

export type ThemeMode = 'light' | 'dark'

export interface AppGroup {
  id: string
  name: string
  sort: number
  created_at: IsoTimestamp
  updated_at: IsoTimestamp
}

export interface AppItem {
  id: string
  /** 归属的 app_group.id。`group` 是 SQL 保留字，所以列名是 group_id */
  group_id: string
  name: string
  /** 源码仓库地址 */
  git_url: string
  /**
   * 线上访问地址（就是应用本身的站点）。
   * 空串表示没单独配，前台点卡片直接跳 `git_url`。
   */
  url: string
  /** 封面图在存储桶 app-covers 里的对象路径；空串表示没传，前台退回图标 */
  image_path: string
  /** 完整 README 原文；抓取失败为空串 */
  readme_raw: string
  /** 卡片上展示的简介（≤300 字）。拉取 README 时自动生成，之后由用户手工改 */
  intro: string
  /** 停用后前台不展示，但数据保留、后台仍可见 */
  enabled: boolean
  hero_icon_name: IconSlug
  theme_color: ThemeColor
  tags: string[]
  sort: number
  created_at: IsoTimestamp
  updated_at: IsoTimestamp
}

export interface TagDoc {
  /** lower(btrim(name))，客户端据此幂等入池 */
  id: string
  /** 原始大小写，用于展示 */
  name: string
  created_at: IsoTimestamp
}

/** admins 表的一行；存在即代表当前账号是管理员 */
export interface AdminRow {
  uid: string
}

/** 写入 app_group 时客户端负责的字段 */
export interface AppGroupWrite {
  name: string
  sort: number
}

/** 写入 app_item 时客户端负责的字段（时间戳由数据库默认值补齐） */
export interface AppItemWrite {
  group_id: string
  name: string
  git_url: string
  url: string
  image_path: string
  readme_raw: string
  intro: string
  enabled: boolean
  hero_icon_name: IconSlug
  theme_color: ThemeColor
  tags: string[]
  sort: number
}

export interface SearchHit {
  item: AppItem
  /** 命中的标签，用于高亮 */
  matchedTags: string[]
}

export interface TagOption {
  name: string
  count: number
}
