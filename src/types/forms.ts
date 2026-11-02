import { z } from 'zod'
import { THEME_COLORS } from '@/lib/palette'
import type { ThemeColor } from '@/lib/palette'
import type { HeroIconSlug } from './models'

export const groupFormSchema = z.object({
  name: z.string().trim().min(1, '请输入应用组名称').max(60, '最多 60 个字'),
})
export type GroupForm = z.infer<typeof groupFormSchema>

/**
 * theme_color / hero_icon_name 在数据库里是带 check 约束的 text（没有枚举类型），
 * 所以这里用 z.custom 把「值域」约束回前端的静态表，类型也能保住 ThemeColor。
 */
const themeColorSchema = z.custom<ThemeColor>(
  (value) => typeof value === 'string' && THEME_COLORS.some((token) => token.key === value),
  { message: '请选择一个主题色' },
)

const heroIconSchema = z.custom<HeroIconSlug>(
  (value) => typeof value === 'string' && value.trim().length > 0,
  { message: '请选择图标' },
)

export const itemFormSchema = z.object({
  group: z.string().min(1, '请选择归属应用组'),
  name: z.string().trim().min(1, '请输入应用名称').max(80, '最多 80 个字'),
  git_url: z
    .string()
    .trim()
    .min(1, '请输入 Git 地址')
    .regex(/^https?:\/\/[^\s]+$/i, '只支持 http/https 开头的地址'),
  /** 卡片简介：拉取 README 时自动填充，可手工修改 / 清空 */
  intro: z.string().trim().max(300, '最多 300 个字'),
  hero_icon_name: heroIconSchema,
  theme_color: themeColorSchema,
  tags: z.array(z.string().trim().min(1, '标签不能为空').max(30, '单个标签最多 30 个字')).max(10, '最多 10 个标签'),
})
export type ItemForm = z.infer<typeof itemFormSchema>

export const loginFormSchema = z.object({
  email: z.string().trim().min(1, '请输入邮箱').email('邮箱格式不正确'),
  password: z.string().min(6, '密码至少 6 位'),
  remember: z.boolean(),
})
export type LoginForm = z.infer<typeof loginFormSchema>
