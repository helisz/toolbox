# 导航站设计文档（Supabase 版）

依据：[requirement.md](../requirement.md) + 本轮的决策。本文档覆盖「输出顺序」的 1–6（数据层 / 目录 / 类型 / stores / 路由 / composables）；页面实现、`.env` 示例与依赖清单随代码交付。

> 平台演进：PocketBase → Firebase → **Supabase**。前两版的设计结论（调色板、图标注册表、README 抓取与摘录算法、路由守卫、composables）全部沿用，只有数据层与鉴权被替换；§1 已按 Supabase 重写。

## 0. 已确认决策

| # | 决策点 | 结论 | 对原需求的影响 |
|---|---|---|---|
| 1 | 后端 | **Supabase**（Postgres + RLS + Auth + Realtime），弃用 PocketBase 与 Firebase | 数据模型、鉴权、实时同步全部重写；无自建 Node 后端 |
| 2 | 后台鉴权 | Supabase Auth 邮箱密码 + `admins` 表白名单（RLS 用 `security definer` 函数判定） | 原「管理员账号密码写在 env」的泄露问题消失 |
| 3 | README 抓取 | 前端直连 `raw.githubusercontent.com`，无代理、无 Edge Functions | 不产生任何服务端代码；私有库/非 GitHub 平台抓不到，失败则留空 |
| 4 | 联调环境 | 连真实 Supabase 项目 | 需要你提供 Project URL + anon key |
| 5 | `tags` | `text[]` 标签名数组 | 满足「来源全局标签池」；`tag_pool` 主键 = 归一化标签名，天然去重 |
| 6 | `readme_raw` | 存**完整原文**（≤200 KB），300 字摘录运行时计算 | 详情弹窗可渲染全文 |
| 7 | Tailwind | **v4**（CSS `@theme`），`dark` class 策略 | `tailwind.config.js` 不参与，主题扩展写在 `src/assets/index.css` |
| 8 | 交付顺序 | 先本文档，确认后写代码 | — |

---

## 1. 数据层（Supabase / Postgres）

### 1.1 表结构

Postgres 有真正的约束能力，所以「字段校验」从应用层搬到了数据库 —— 这是相对 Firebase 版最大的结构变化：**约束、级联删除、唯一性都由数据库保证，客户端只负责 UI 校验**。

四条约定：

- **字段名沿用需求原文的 snake_case**（`git_url`、`readme_raw`、`hero_icon_name`、`theme_color`、`tags`、`sort`），只有 `group` 改成 **`group_id`** —— `group` 是 SQL 保留字，不引号包裹就必须改名。
- **`sort` 是 `double precision`**，拖拽时只改被移动那一行，取前后邻居中点；间隙 < 1e-6 时才整组重排。
- **`tag_pool` 的主键是 `text`**，值 = `lower(btrim(name))`，于是「输入新标签自动入池」变成幂等 `upsert(ignoreDuplicates)`，不需要「先查后写」。顺带解决了 Firebase 版要 `encodeURIComponent` 规避 `/` 的问题。
- **删除组 = 只删一行**：`app_item.group_id` 带 `on delete cascade`，Firebase 版手写的分批批量删除整段消失。

#### `app_group`

| 列 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `id` | uuid | PK, `gen_random_uuid()` | — |
| `name` | text | `char_length(btrim(name)) between 1 and 60` | 应用组名 |
| `sort` | double precision | not null | 越小越靠前；新建取 `最大 sort + 1000` |
| `created_at` / `updated_at` | timestamptz | `default now()` | `updated_at` 由触发器维护 |

#### `app_item`

| 列 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `id` | uuid | PK | — |
| `group_id` | uuid | FK → `app_group.id`, `on delete cascade` | 原需求 `relation` |
| `name` | text | 1–80 字 | 应用名 |
| `git_url` | text | `~ '^https?://.+'` | 源码仓库地址；只允许 http/https（挡 `javascript:`） |
| `url` | text | `= '' or ~ '^https?://.+'`，`default ''` | 线上访问地址；**空串表示没单独配，前台点卡片退回 `git_url`** |
| `readme_raw` | text | `≤ 200000` 字，`default ''` | README 全文；抓取失败为空串 |
| `intro` | text | `≤ 300` 字，`default ''` | 卡片简介；拉取 README 时自动生成，**之后由用户手工维护** |
| `enabled` | boolean | `default true` | 停用后前台不展示，后台仍可见可编辑 |
| `image_path` | text | `default ''` | 封面图在存储桶 `app-covers` 里的对象路径；空串 → 前台回退成图标色块 |
| `hero_icon_name` | text | `~ '^[a-z0-9-]+$'`，`default 'layout-grid'` | 老字段，只在没封面图时用于回退；后台已不再编辑，老名字由 `LEGACY_ALIASES` 兜底 |
| `theme_color` | text | `~ '^[a-z]+-[0-9]{2,3}$'`，`default 'slate-500'` | 值域由前端 `THEME_COLORS` 决定 |
| `tags` | text[] | `coalesce(array_length(tags,1),0) <= 10` | 标签名，非 id |
| `sort` | double precision | not null | 组内升序 |
| `created_at` / `updated_at` | timestamptz | `default now()` | — |

#### `tag_pool`

| 列 | 类型 | 说明 |
|---|---|---|
| `id` | text PK | `lower(btrim(name))` |
| `name` | text | 原始大小写，用于展示（1–30 字） |
| `created_at` | timestamptz | — |

> 标签使用次数不落库，由前端 `items` 缓存实时算出 —— 避免每次改标签多一次写，也不会出现计数漂移。

#### `admins`

| 列 | 类型 | 说明 |
|---|---|---|
| `uid` | uuid PK, FK → `auth.users(id)` `on delete cascade` | 管理员白名单；有行即管理员 |

#### 类型别名

```ts
type IsoTimestamp = string                       // Supabase 返回的 timestamptz 是 ISO 字符串
type GroupId      = string                       // app_group.id
type TagName      = string                       // 归一化前的原始标签名
type ThemeColor   = (typeof THEME_COLORS)[number]['key']
type IconSlug = string
```

### 1.2 安全边界：RLS

三层，缺一不可：

1. **表权限**（`grant`）：`anon` 只能 `select`，`authenticated` 才有 `insert/update/delete`；
2. **RLS 策略**：三张业务表 `for select using (true)` + `for all to authenticated using (is_admin()) with check (is_admin())`；
3. **`admins` 表**：只有 `for select to authenticated using (uid = auth.uid())`，**没有任何写策略** —— 所以客户端永远改不了白名单，只能从 SQL Editor / 控制台维护。

```sql
-- security definer：策略里查 admins 时不会再次触发 admins 自己的 RLS（避免递归）
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where uid = auth.uid());
$$;

create policy app_group_read  on public.app_group for select using (true);
create policy app_group_write on public.app_group for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
```

要点（都是实现时踩出来的）：

- **`admins` 为空 = 所有写操作被拒**，但前台照常能读 → 症状是「后台点保存毫无反应」。这是最常见的问题。
- **RLS 挡住 `update`/`delete` 时不报错，只返回 0 行**。所以客户端每次写都要接 `.select('id')` 并判空，否则会「静默成功」。`stores/data.ts` 里的 `assertAffected()` 就是干这个的。
- 错误文案是 Postgres 英文原文，`friendlyError()` 把 `row-level security` / `violates check constraint` / `duplicate key` 翻成人话。
- **Realtime 同样受 RLS 约束**：因为 `select` 对所有人放行，前台匿名也能收到 `postgres_changes`。
- 约束在数据库里又写了一遍（长度、URL 格式、标签数量），这是有意的：客户端 zod 是 UX，数据库约束是最后一道边界。

### 1.3 索引与查询

只需要一个索引：`app_item (group_id, sort)`，覆盖「按组取应用并排序」。

前台依然采用「三张表全量拉取 + 客户端排序/搜索」：

- 排序在 Pinia getter 里做（几百条，O(n log n) 无感）；
- 搜索是名称/标签的子串匹配。**注意**：Postgres 本来能做 `ilike`，但当前架构要求搜索覆盖「所有分组」，且结果要与本地缓存一致，所以仍在客户端做；
- realtime 只负责「有人改了数据 → 重新拉那张表」，不做增量合并，简单可靠。

规模上限提醒：单表超过 ~5000 行时应改成「按组查询 + 分页」，本期不做。

### 1.4 初始化步骤（一次性）

全部脚本在 [supabase/schema.sql](../supabase/schema.sql)，**幂等**，重跑不会丢数据：

1. 建项目 → 选区域（如 `ap-southeast-1`）。
2. **SQL Editor → 粘贴 schema.sql 全文 → Run**。一次搞定建表、约束、触发器、`is_admin()`、RLS、表权限、realtime publication。
3. **Authentication → Providers → Email**：确认启用；内部用建议关掉 **Confirm email**（否则新账号登录报「邮箱未验证」）。
4. **Authentication → Users → Add user** 建管理员，复制 UID，然后单独执行：
   ```sql
   insert into public.admins (uid) values ('<UID>') on conflict (uid) do nothing;
   ```
5. **Settings → API**：复制 `Project URL` 与 `anon public` key → 填进 `.env.local`。

> 与 Firebase 版相比，这里没有「手建白名单文档」「粘贴规则」「注册 Web 应用」这些分散步骤，配置面收敛成两处：跑一次 SQL、填两个变量。

---

## 2. 目录结构

```
toolbox/
├─ docs/
│  └─ design.md
├─ supabase/
│  └─ schema.sql                  # 建表 + 约束 + 触发器 + RLS + 实时订阅（幂等）
├─ scripts/
│  └─ selfcheck.mjs               # 纯逻辑自检（git URL / 摘录 / 排序）
├─ components.json               # shadcn-vue 配置（Tailwind v4 / CSS 变量）
├─ index.html                    # 含主题防闪烁内联脚本
├─ package.json
├─ vite.config.ts
├─ tsconfig.json
├─ .env.example
└─ src/
   ├─ main.ts                    # 动态 import + 配置缺失时的说明页
   ├─ bootstrap.ts               # createApp / pinia / router
   ├─ App.vue
   ├─ assets/
   │  └─ index.css               # Tailwind v4 @import + @theme + 亮/暗变量
   ├─ lib/
   │  ├─ supabase.ts             # createClient 单例 + 会话存储策略 + TABLES
   │  ├─ palette.ts              # THEME_COLORS 静态映射表（亮/暗双份类名）
   │  ├─ icons.ts                # Lucide 图标：只作封面缺失时的回退（索引表动态加载）
   │  ├─ icon-modules.ts         # 图标 glob 索引表，独立 chunk，用到才拉
   │  ├─ storage.ts              # Supabase Storage：上传/删除封面 + 客户端压缩
   │  ├─ markdown.ts             # markdown-it + DOMPurify + 相对链接改写
   │  ├─ readme.ts               # git URL → raw 候选 → 抓取 → 摘录提取
   │  ├─ sort.ts                 # computeSortValue / planMove
   │  └─ utils.ts                # cn() / tagDocId()
   ├─ types/
   │  ├─ models.ts               # AppGroup / AppItem / TagDoc / AdminRow
   │  ├─ forms.ts                # 表单模型 + zod schema
   │  └─ index.ts
   ├─ stores/
   │  ├─ auth.ts
   │  ├─ data.ts
   │  └─ theme.ts
   ├─ composables/
   │  ├─ useTheme.ts
   │  ├─ useReadme.ts
   │  ├─ useReorder.ts
   │  └─ useToast.ts             # 包一层 vue-sonner
   ├─ router/
   │  ├─ index.ts
   │  └─ guards.ts
   ├─ components/
   │  ├─ ui/                     # shadcn-vue 组件（button/dialog/select/input/tabs/switch/textarea/...）
   │  │  └─ coverflow-carousel/  # 3D 轮播，移植自 docs/carousel.md
   │  ├─ common/
   │  │  ├─ ThemeToggle.vue
   │  │  ├─ AppIcon.vue          # slug → heroicon 组件 + 兜底色
   │  │  └─ EmptyState.vue
   │  ├─ site/
   │  │  ├─ SiteHeader.vue       # 搜索 + 主题 + 后台入口
   │  │  └─ AppSlide.vue         # 轮播里的一张卡片：2:3 封面图（无图回退图标）
   │  └─ admin/
   │     ├─ GroupManager.vue
   │     ├─ AppManager.vue       # 「应用」页：按应用组分段，每段一个拖拽列表
   │     ├─ AppGroupSection.vue   # 单个分组区块（列表 + 行内启用开关 + 组内排序）
   │     ├─ AppFormDialog.vue     # 表单：封面图（上传或选预设）、标签、README 抓取
   │     ├─ TagInput.vue
   │     └─ SortableList.vue     # 拖拽容器，前台后台复用
   └─ views/
      ├─ HomeView.vue
      ├─ AdminLoginView.vue
      ├─ AdminView.vue           # Tabs：应用组 / 应用
      └─ NotFoundView.vue
```

---

## 3. TS 类型定义

### `src/types/models.ts`

```ts
export type ThemeColor = (typeof THEME_COLORS)[number]['key']
export type IconSlug = string

/** Supabase 返回的 timestamptz 是 ISO 字符串 */
export type IsoTimestamp = string

export interface AppGroup {
  id: string
  name: string
  sort: number
  created_at: IsoTimestamp
  updated_at: IsoTimestamp
}

export interface AppItem {
  id: string
  /** app_group.id（`group` 是 SQL 保留字，列名用 group_id） */
  group_id: string
  name: string
  git_url: string
  /** 线上地址；空串表示前台点卡片直接跳 git_url */
  url: string
  /** 完整 README 原文，抓取失败为空串 */
  readme_raw: string
  hero_icon_name: IconSlug
  theme_color: ThemeColor
  tags: string[]
  sort: number
  created_at: IsoTimestamp
  updated_at: IsoTimestamp
}

export interface TagDoc {
  /** lower(btrim(name)) */
  id: string
  /** 原始大小写，用于展示 */
  name: string
  created_at: IsoTimestamp
}

/** admins 表的一行；存在即代表当前账号是管理员 */
export interface AdminRow {
  uid: string
}

/** 写入用：省略服务端生成字段 */
export type AppGroupInput = Pick<AppGroup, 'name' | 'sort'>
export type AppItemInput = Omit<AppItem, 'id' | 'created_at' | 'updated_at'>

export type ThemeMode = 'light' | 'dark'

export interface SearchHit {
  item: AppItem
  /** 命中的标签，用于高亮 */
  matchedTags: string[]
}

export interface TagOption {
  name: string
  count: number
}
```

> 与 Firebase 版的差别只有两处：`group` → `group_id`；`FireTimestamp`（SDK 对象）→ `IsoTimestamp`（字符串，可直接比较/序列化）。

### `src/types/forms.ts`

```ts
import { z } from 'zod'

export const groupFormSchema = z.object({
  name: z.string().trim().min(1, '请输入应用组名称').max(60, '最多 60 个字'),
})
export type GroupForm = z.infer<typeof groupFormSchema>

export const itemFormSchema = z.object({
  group: z.string().min(1, '请选择归属应用组'),
  name: z.string().trim().min(1, '请输入应用名称').max(80, '最多 80 个字'),
  git_url: z
    .string()
    .trim()
    .min(1, '请输入 Git 地址')
    .regex(/^https?:\/\/.+/, '只支持 http/https 开头的地址'),
  /** 线上地址：空串合法（退回 Git 地址），非空则必须是 http/https */
  url: z
    .string()
    .trim()
    .max(500, '最多 500 个字')
    .refine((v) => v === '' || /^https?:\/\/.+/.test(v), '只支持 http/https 开头的地址'),
  hero_icon_name: z.string().min(1, '请选择图标'),
  theme_color: z.string().min(1, '请选择主题色'),
  tags: z.array(z.string().trim().min(1).max(30)).max(10, '最多 10 个标签'),
})
export type ItemForm = z.infer<typeof itemFormSchema>

/** 表单 → 写入文档（不含 sort / readme_raw，由调用方补齐） */
export type ItemFormPayload = Omit<ItemForm, never>
```

### `src/lib/palette.ts`（片段）

类名必须是**完整静态字符串**，否则 Tailwind v4 的扫描器会丢掉它们；暗色对比度在每项里单独调，不能简单复用 light 值。

```ts
export interface ColorToken {
  key: string
  label: string
  /** 图标前景色 */
  text: string
  /** 图标底色 tint */
  tint: string
  /** 卡片上的主题色装饰条（不能用 hover: 前缀拼接，会被 Tailwind 丢弃） */
  bar: string
}

export const THEME_COLORS = [
  { key: 'slate-500', label: '石板灰', text: 'text-slate-500 dark:text-slate-300', tint: 'bg-slate-500/10 dark:bg-slate-300/10', bar: 'bg-slate-400/70 dark:bg-slate-300/60' },
  { key: 'stone-500', label: '暖石',   text: 'text-stone-500 dark:text-stone-300', tint: 'bg-stone-500/10 dark:bg-stone-300/10', bar: 'bg-stone-400/70 dark:bg-stone-300/60' },
  { key: 'amber-500', label: '琥珀',   text: 'text-amber-600 dark:text-amber-300', tint: 'bg-amber-500/10 dark:bg-amber-300/10', bar: 'bg-amber-500/60 dark:bg-amber-300/60' },
  { key: 'emerald-500', label: '翠绿', text: 'text-emerald-600 dark:text-emerald-300', tint: 'bg-emerald-500/10 dark:bg-emerald-300/10', bar: 'bg-emerald-500/60 dark:bg-emerald-300/60' },
  { key: 'sky-500', label: '天蓝',     text: 'text-sky-600 dark:text-sky-300', tint: 'bg-sky-500/10 dark:bg-sky-300/10', bar: 'bg-sky-500/60 dark:bg-sky-300/60' },
  { key: 'violet-500', label: '紫罗兰', text: 'text-violet-600 dark:text-violet-300', tint: 'bg-violet-500/10 dark:bg-violet-300/10', bar: 'bg-violet-500/60 dark:bg-violet-300/60' },
  { key: 'rose-500', label: '玫瑰',    text: 'text-rose-600 dark:text-rose-300', tint: 'bg-rose-500/10 dark:bg-rose-300/10', bar: 'bg-rose-500/60 dark:bg-rose-300/60' },
] as const

export function getColorToken(key: string): ColorToken {
  return THEME_COLORS.find((c) => c.key === key) ?? THEME_COLORS[0]
}
```

### `src/lib/icons.ts`（Lucide，只作封面缺失时的回退）

后台已改成**上传封面图**，不再选图标，所以图标只剩「老数据没传封面」这一条路径会用到。相应地拆成两个文件：

```ts
// src/lib/icon-modules.ts —— 索引表，单独一个 chunk，不进主包
export const ICON_DIR = '/node_modules/lucide-vue-next/dist/esm/icons/'
export const iconModules = import.meta.glob('/node_modules/lucide-vue-next/dist/esm/icons/*.js')
```

```ts
// src/lib/icons.ts
let modulesPromise: Promise<typeof import('@/lib/icon-modules')> | null = null
const loadIconModules = () => (modulesPromise ??= import('@/lib/icon-modules'))

/** 同步返回组件；内部异步组件：真要渲染时才拉索引表 + 那一个图标 */
export function resolveIcon(slug?: string | null): Component {
  const key = normalize(slug) // 只做别名翻译，存在性留到加载索引表时判断
  if (cache.has(key)) return cache.get(key)!
  const component = defineAsyncComponent(async () => {
    const { ICON_DIR, iconModules } = await loadIconModules()
    const loader =
      iconModules[ICON_DIR + key + '.js'] ?? iconModules[ICON_DIR + DEFAULT_ICON_SLUG + '.js']
    return (await loader()).default
  })
  cache.set(key, component)
  return component
}
```

要点：

- **索引表按需加载**。glob 映射表本身有 ~140KB（gzip ~35KB）+ 1705 个图标 chunk 的登记，以前常驻 `data` chunk（398KB）。挪进 `icon-modules.ts` 再用动态 `import()` 拉之后，`data` chunk 降到 **88KB / 30KB gzip**，首页只显示封面图时根本不会请求它。
- **`resolveIcon` 仍然同步返回**，靠 `defineAsyncComponent` 把下载推迟到真正渲染时，调用方（`AppIcon`、`AppSlide`）不用改成 `await`。
- **历史数据兼容**：库里存的是 Heroicons 的 slug（`cog6-tooth`、`paper-airplane`、`squares-2x2`），`LEGACY_ALIASES`（约 90 条）把它们翻成语义相同的 Lucide 图标，否则回退路径会集体退化成默认图标。
- 图标选择器（`IconPickerDialog.vue`）与静态预设集（`icon-presets.ts`）已删除 —— 上传封面替代了它的位置。

### `src/lib/readme.ts`（摘录提取规则）

需求 L27 的区间描述有歧义，这里固定成可测的算法，`extractIntro(raw, 300)`：

1. 去掉 YAML front-matter、HTML 注释；
2. 删除整行的 badge 行（`^\[!\[`、`^!\[`、`^<img`、`^<p align` 等）与裸图片；
3. 从**第一个 ATX 一级标题**（`/^#\s+/m`）之后开始；
4. 截断到**下一个 H1** 或 **第一个二级标题 `##`**（先到者），避免摘录里混进目录；
5. **没有 H1 时**：取标题区之前的正文。这一条是自检发现的真 bug —— 早期实现直接取全篇，
   结果没有 H1 的 README 会把各章节标题串成 300 字的目录碎片；
6. 剥掉剩余 markdown 语法（链接保留文本、代码块/setext 下划线丢弃），把空白压成单空格；
7. 超过 300 字截断并加 `…`（按码点切，不会切半个 emoji）。

以上规则全部由 `npm run selfcheck` 覆盖（`scripts/selfcheck.mjs`，23 条断言）。

抓取候选（顺序尝试，取第一个非空响应，10s 超时 + `AbortController`）：

| 平台 | raw 地址 |
|---|---|
| GitHub | `https://raw.githubusercontent.com/{owner}/{repo}/HEAD/{file}` |
| GitLab | `https://gitlab.com/{owner}/{repo}/-/raw/HEAD/{file}` |
| Gitee | `https://gitee.com/{owner}/{repo}/raw/HEAD/{file}` |
| 其它 | `https://raw.githubusercontent.com/...` 失败后按 `{repo}/raw/HEAD/{file}`、`{repo}/-/raw/HEAD/{file}` 兜底 |

`{file}` 取值顺序：`README.md`、`readme.md`、`README.MD`、`README.markdown`、`docs/README.md`。全部失败 → 返回 `null`，`readme_raw` 留空并 toast 提示（**不做任何 LLM 摘要**）。

---

## 4. Pinia stores

### 4.1 `stores/auth.ts`

```ts
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { User } from '@supabase/supabase-js'
import { setSessionPersistence, supabase, TABLES } from '@/lib/supabase'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const isAdmin = ref(false)
  const ready = ref(false)          // 首次会话检查是否已完成
  const loading = ref(false)

  let markReady = () => {}
  const readyPromise = new Promise<void>((r) => (markReady = r))

  async function checkAdmin(u: User | null) {
    if (!u) { isAdmin.value = false; return }
    const { data, error } = await supabase
      .from('admins').select('uid').eq('uid', u.id).maybeSingle()
    isAdmin.value = error ? false : data !== null   // 报错一律按非管理员处理
  }

  // 先用 getSession 恢复刷新前的会话，再挂监听
  void (async () => {
    try {
      const { data } = await supabase.auth.getSession()
      user.value = data.session?.user ?? null
      await checkAdmin(user.value)
    } finally { markReady() }
  })()

  supabase.auth.onAuthStateChange((_e, session) => {
    user.value = session?.user ?? null
    void checkAdmin(user.value).finally(markReady)
  })

  const isAuthenticated = computed(() => !!user.value)

  async function login(email: string, password: string, remember: boolean) {
    loading.value = true
    try {
      // 记住登录 = 会话写 localStorage；不记住 = 写 sessionStorage，关浏览器即失效
      setSessionPersistence(remember)
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (error) throw new Error(error.message)
      await checkAdmin((await supabase.auth.getUser()).data.user)
    } finally { loading.value = false }
  }

  async function logout() { await supabase.auth.signOut() }

  /** 路由守卫用：等首次会话检查完成，避免刷新瞬间被踢到登录页 */
  async function ensureReady() { if (!ready.value) await readyPromise }

  return { user, isAdmin, isAuthenticated, ready, loading, login, logout, ensureReady }
})
```

「记住登录」用自定义 storage 适配器实现：Supabase 的 `storage` 选项接受任意 `getItem/setItem/removeItem`，登录前先设一个 `persistentSession` 标志，`setItem` 时据此决定写 `localStorage` 还是 `sessionStorage`，并在另一个里清掉，避免两份会话打架。

### 4.2 `stores/data.ts`

三张表初始全量拉取 + 一个 realtime channel = 「缓存」。前台秒开、后台改完前台实时可见，TTL 失效逻辑被实时推送替代，只在首屏显示骨架屏。

```ts
interface DataState {
  groups: AppGroup[]; items: AppItem[]; tags: TagDoc[]
  loading: boolean; error: string | null
}

// getters
const sortedGroups = computed(() => [...groups.value].sort(bySortAsc))
const itemsByGroup = computed(() => {
  const map = new Map<string, AppItem[]>()
  for (const it of [...items.value].sort(bySortAsc)) {
    const list = map.get(it.group_id) ?? []; list.push(it); map.set(it.group_id, list)
  }
  return map
})
const tagOptions = computed<TagOption[]>(() => { /* items 里统计次数 + tag_pool 补名 */ })

// 订阅：引用计数 + 代数（丢弃已销毁后才完成的异步结果）
function subscribe(): () => void        // 返回幂等释放函数
function unsubscribe(): void

// 读取
async function refreshGroups/refreshItems/refreshTags(quiet?: boolean): Promise<void>

// 写入（每次都接回读，不依赖 realtime 推送）
async function createGroup(name: string): Promise<void>          // sort = maxSort + 1000
async function renameGroup(id: string, name: string): Promise<void>
async function deleteGroup(id: string): Promise<void>            // 只删一行，级联由外键完成
async function moveGroup(id: string, toIndex: number): Promise<void>
async function createItem(form: ItemForm, readme: string): Promise<void>
async function updateItem(id: string, form: ItemForm, readme?: string): Promise<void>
async function deleteItem(id: string): Promise<void>
async function moveItem(groupId: string, id: string, toIndex: number): Promise<void>
async function ensureTags(names: string[]): Promise<void>        // upsert(ignoreDuplicates) 幂等入池
```

> 实现时把 `reorder*(orderedIds)` 收敛成 `move*(id, toIndex)`：调用方（拖拽事件）本来就知道被移动项和目标下标，
> 传「完整新顺序」反而要在 store 里做一次数组 diff 才能定位变化项，既容易错也多一次遍历。

`moveItem` 的写入策略（`lib/sort.ts`）：

```ts
/** 只算被移动项的新 sort；邻居间隙过小时返回 null，触发整组重排 */
export function computeSortValue(prev: number | undefined, next: number | undefined): number | null {
  if (prev === undefined && next === undefined) return 1000
  if (prev === undefined) return next! - 1000
  if (next === undefined) return prev + 1000
  const gap = next - prev
  return gap < 1e-6 ? null : prev + gap / 2
}
```

### 4.3 一致性约定

- 删组：只 `delete from app_group where id = ...`，组内应用由 `on delete cascade` 清掉 —— Firebase 版那套分批 `writeBatch` 完全不需要了。前端二次确认弹窗仍要显示「将同时删除 N 个应用」。
- 跨组移动应用：`group_id` 改为新组、`sort` 置为新组末尾（`maxSort + 1000`）。
- 新建标签：与 item 写入分开两次请求（Postgres 没有跨表事务的客户端 API），语义上无依赖，失败也不影响主流程。
- **RLS 拦截 update/delete 时不报错**，所以每次写都 `.select('id')` 判空，避免「静默成功」。
- 所有写操作 `try/catch` → `toast.error`，列表的拖拽顺序在失败时回滚到快照。

### 4.4 `stores/theme.ts`

```ts
const KEY = 'toolbox-theme'
const mode = ref<ThemeMode>(localStorage.getItem(KEY) === 'dark' ? 'dark' : 'light')
function apply() { document.documentElement.classList.toggle('dark', mode.value === 'dark') }
function toggle() { mode.value = mode.value === 'dark' ? 'light' : 'dark'; localStorage.setItem(KEY, mode.value); apply() }
```

首屏防闪烁：`index.html` 里内联一小段脚本，在 CSS 加载前读 `localStorage` 并给 `<html>` 加 `dark`，否则暗色用户会白屏闪一下。

---

## 5. 路由与守卫

```ts
// router/index.ts
const routes: RouteRecordRaw[] = [
  { path: '/', name: 'home', component: () => import('@/views/HomeView.vue') },
  {
    path: '/admin/login', name: 'admin-login',
    component: () => import('@/views/AdminLoginView.vue'),
    meta: { public: true, layout: 'plain' },
  },
  {
    path: '/admin', name: 'admin',
    component: () => import('@/views/AdminView.vue'),
    meta: { requiresAuth: true },       // Tabs：应用组 / 应用（不加子路由）
  },
  { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('@/views/NotFoundView.vue') },
]

// router/guards.ts
router.beforeEach(async (to) => {
  if (!to.meta.requiresAuth) {
    // 已登录还想看登录页 → 直接进后台
    if (to.name === 'admin-login' && useAuthStore().isAuthenticated) return { name: 'admin' }
    return true
  }
  const authStore = useAuthStore()
  await authStore.ensureReady()                 // 关键：等 onAuthStateChanged 首次回调
  if (!authStore.isAuthenticated) {
    return { name: 'admin-login', query: { redirect: to.fullPath } }
  }
  return true
})
```

- **token 过期 / 被撤销**：Supabase 自动刷新 access token，session 失效时 `onAuthStateChange` 回调 `null`。订阅里做一次判断：当前在 `/admin` 且 `user` 变 `null` → `router.replace({name:'admin-login'})` + toast。不需要手写 401 拦截器。
- **非管理员账号**：已登录但 `admins` 表里没有自己那行 → RLS 会拒绝所有写操作。UI 层用 `authStore.isAdmin` 显示「当前账号无管理员权限」并阻止进入编辑器，避免让用户撞一堆 RLS 报错。
- 登录成功后跳 `route.query.redirect ?? '/admin'`。

### 5.1 首页结构（coverflow 轮播）

首页从「侧边栏 + 卡片网格 + 详情弹窗」改成单屏聚焦，整块内容在页面里**垂直居中**：

```
            [ header: 工具箱 ... 搜索  主题  后台 ]
                          ↕ 居中
                     [ 应用组 ▾ ]
        ◄  [▮] [▮] [▮] [▮] [▮]  ►    ← 2:3 竖版封面图；数据少时循环铺满
                   Mask Tool
            github.com/helisz/web-page-mask
                   [ GitHub ]
        顺手的马赛克工具（最多三行，居中）
```

- **卡片是一张 2:3 的封面图**（`object-cover` 裁切，宽 `clamp(156px,18.5vw,208px)` → 高 `clamp(234px,27.75vw,312px)`），点了直接打开这个应用：`url` 优先，空则退回 `git_url`。没传封面的老数据回退成「图标色块」，不会开天窗。
- **卡片的立体感靠 `depth` / `perspective` 制造**：`translateZ(-depth * 宽 * ramp)` + `perspective` 让邻卡等比缩小。当前 `depth=1`、`perspective=2.3`、`gap=0`，实测中心 208px、第一张邻卡 136px（0.65 倍）、最边缘 101px，且相邻卡片**有意重叠约 20px**（`gap=0` + 透视收拢）。这是刻意的：中心那张要明显地"抬起来"。
- 应用名、两个动作按钮、三行简介都在**卡片外面、下方居中**，由 `AppInfoPanel` 渲染，且只显示当前居中那张卡对应的应用。不再单独显示一行仓库地址（`displayHref()` 随之删掉，地址只在按钮的 `href` 里）。
- 两个按钮：左「GitHub」用自定义 `variant="github"`（`bg-neutral-900 text-white`，亮/暗主题下都是那块黑底，保持品牌感）跳 `git_url`；右「访问应用」用主色 `default` 变体 + `ArrowRight` 右箭头，跳 `appHref()` —— 和点卡片同一个目标。`git_url` 为空时左边按钮整个不渲染。
- **应用太少就循环铺满**：`repeat` 打开时组件按「可视区宽度 / 每张卡占位」把环补长（最少 5 张），父组件用 `index % items.length` 取内容。少于 5 个应用时铺满且隐藏分页点（下标会重复，点没意义）；5 个以上正常渲染并显示分页点。
- **轮播贴满屏宽**：`main` 自己不带左右内边距（`px` 交给各块自己加），所以移动端轮播从 x=0 到屏宽、卡片在边缘被 `overflow-hidden` 裁掉；桌面端由 `max-w-5xl` 兜住，不会无限拉宽。分组下拉、信息区、提示文字各自 `px-4`。
- **信息区全程可见**：不做「拖动时隐藏、停稳再显示」——那会让人一直等着轮播动画（还要加上甩动的滑行）才看到文字。改成内容单独处理：`activeIndex` 一变就立刻换文字，靠 `<div :key="activeItem.id" class="animate-fade-in">` 只在新内容上播 100ms 淡入（`opacity .35 → 1`，不从 0 起，快速拖动时不会闪成空白）。简介块固定三行高度（`min-h-[3.75rem]`），换应用时下方内容不会上下跳。
- **没有详情弹窗**：简介就是后台维护的 `intro`，README 全文不再渲染到前台（`lib/markdown.ts` 因此暂时没有调用方，保留着以备将来恢复详情页）。
- **记住上次看的分组**：选中即写 `localStorage['toolbox-group']`（组 id），下次进首页直接回到那一组。两个坑：
  1. 记住的 id 也算「用户选过」（`userPicked = Boolean(storedId)`），否则默认规则「第一个有应用的组」每次刷新都会把它顶回去；
  2. 数据还没到位时 `sortedGroups` 是空的，`pickDefaultGroup()` 里**不能**把 `activeGroupId` 清成空串 —— 清掉之后 userPicked 的校验会判它「不存在」，于是又被默认组覆盖（这是实测踩到的）。所以空数组时直接 `return`，等数据到位再校验。
  存之前还要确认这个组真实存在：组被删了就回退到第一个组，并把新 id 覆盖回存储。
- 非居中卡片的内部链接 `pointer-events-none` 且 `tabindex="-1"`，点一下只是把它转到中间，避免误跳；拖拽超过 6px 后 `click.capture` 会吞掉那次点击。

轮播本身在 `components/ui/coverflow-carousel/CoverflowCarousel.vue`，是 `docs/carousel.md` 里 React 版的移植，三处**必须**保留的实现细节：

1. 每帧只写 `transform` / `opacity` / `z-index` 到 DOM，**不经过响应式数据** —— 否则 60fps 下每帧重渲染全部卡片；
2. 循环靠把距离折到环的短边（`offset > count/2` 时减 `count`），不克隆节点、不重排 DOM；
3. 卡宽是唯一需要测量的量（pitch / 景深 / 透视都由它推导），用 `ResizeObserver` 监听容器。

修掉的两个原版缺陷：

- `edge = count/2 - distance` 在只有 1~2 张卡时会把唯一那张压暗（`count/2 = 0.5`），改成仅在 `count/2 > 1` 时做边缘淡出；
- 原版按 `count` 决定渲染几张卡，数据只有一两条时轮播空得只剩一张 —— 补了 `repeat`：环长按可视区宽度算，`change` 事件仍只对外报真实数据下标。
- **`selected` 只能通过 `setSelected()` 改**（第三个缺陷）：触屏甩动时松手会按速度多带 1~2 张，那些卡是 `settle()` 直接跳过去的，`pointermove` 一次都没经过。原实现里 `settle()` 只改 `selected` 不发 `change`，外面的标题就停在旧那张上 —— 表现是「手机端滑几下之后标题和卡片对不上」，桌面端因为鼠标最终位置就是落点、动量小，一直没暴露。现在 `settle()` 落点立即 `setSelected(indexAt(to))`，动画收尾时再兜一次 `setSelected(indexAt(pos))`，保证外部状态永远等于真实居中卡片。

### 5.2 后台「应用」页结构

```
应用                                        [+ 新增应用]
按应用组分组展示，组内可拖动排序，松手即保存

Tools   1 个应用                        [+ 添加]
  ≡ [icon] Mask Tool   顺手的马赛克工具      [开关]  ✎  🗑
Games   2 个应用 · 1 个已停用            [+ 添加]
  ≡ [icon] Poke Survivor …                [开关]  ✎  🗑
Wiki    0 个应用                        [+ 添加]
  这个分组还没有应用，点「添加」创建
```

- 原本是「应用组下拉 + 单组列表」，改成**按组分段全部铺开**：一眼能看出每个组有几个应用、有几个被停用，不用来回切下拉。
- 每段是一个独立的 `vue-draggable-plus` 容器 + 独立的 `useReorder` 实例。排序语义本来就是「组内重排」，落库也按组内目标下标算（`moveItem(groupId, id, toIndex)`），共用一个实例反而要额外处理跨组拖拽的边界。
- 段头的「添加」把该组 id 传给表单，新增时默认落在这一组；顶部「新增应用」仍然可用，默认落在第一个组。
- **换组仍走编辑表单里的「归属应用组」下拉** —— 那是数据归属，不是视图筛选，两者别混。
- 行首缩略图：有封面就显示 2:3 小图（`h-10 w-[27px]`），没有才退回图标块。

### 5.3 封面图上传（Supabase Storage）

- 桶 `app-covers`，**public** 读：前台 `<img src>` 直取，不必每次签名 URL；写/删只有管理员（`public.is_admin()`），策略与业务表 RLS 同一套判定。
- 库里存的是**对象路径**（`2026-11/<uuid>.webp`），不是完整 URL —— 换域名/换项目都不用改数据，渲染时 `getPublicUrl()` 现拼。
- 选完文件**立刻上传**，拿到路径先放在表单里，点「保存」才写库。好处是保存时不会卡着大文件上传；代价是用户中途取消会留一个孤儿对象（无关功能，桶里多几个文件而已）。
- 客户端统一处理成**定尺寸 600×900 的 WebP**（quality 0.82）：按 `object-cover` 语义先算「填满 2:3 需要多大一块源图」，再从中心取这块画进 600×900 画布。比例不对的图不会被拉扁，只会切掉两侧或上下的一部分，和前台看到的一致。定死尺寸的收益是体积可控 —— 一张封面永远 30~80KB，谁传了 8MB 的原图首页也不会多下几 MB。
- 只接受 JPG / PNG / WebP / AVIF / GIF（GIF 只保留第一帧）；SVG 明确拒绝并提示先导出位图，避免把矢量图栅格化成 600×900 的糊图。
- 换封面或删应用时顺手删旧对象（`removeCover`，失败静默）：不给存储桶无限长胖的机会。**预设封面走的是另一条路**，见下。
- 失败文案都翻译成了可行动的句子：桶不存在 → 提示重跑 `schema.sql`；没权限 → 提示 uid 未写入 `admins`。

#### 预设封面（`preset:` 记号）

- `src/images/placeholder_icons/*.webp` 里 9 张图，**在仓库里就已经是 600×900 WebP**（和上传产物同规格，共约 110KB），随包发布。
- 选中预设时 `image_path` 存的是记号 `preset:<文件名>`，不是 Storage 路径。`coverUrl()` 见到 `preset:` 前缀就去 `COVER_PRESETS` 里查打包地址，其余照旧拼 Supabase 公开地址 —— 前台/后台都只调 `coverUrl()`，不需要知道区别。
- 因此选预设**不产生上传请求、不占桶、也删不掉**：`removeCover()` 见到 `preset:` 直接返回（没有对象可删）。
- 预设列表由 `import.meta.glob` 扫目录得到，加图只要把 600×900 WebP 丢进那个目录，不用改代码。

---

## 6. Composables

| composable | 职责 | 关键约定 |
|---|---|---|
| `useTheme()` | 包 `themeStore`，暴露 `mode` / `toggle()` | 只在 `App.vue` 里调用一次，避免重复挂监听 |
| `useReadme()` | `fetchReadme(gitUrl)` → `{ raw, intro } \| null`；`extractIntro(raw, 300)` | 10s 超时，`AbortController`，失败返回 `null`；**绝不调用任何 LLM** |
| `useReorder<T>()` | 把 `vue-draggable-plus` 的 `onEnd` 转成 `persist(id, toIndex)`，内置乐观更新 + 失败回滚 + 拖拽中禁用按钮 | 列表项必须有稳定 `id`；拖拽手柄用 `handle` 选择器，避免误触卡片点击；被移动项从**拖拽前快照**里取，别读已被拖拽库改过的数组 |
| `useToast()` | 包装 `vue-sonner` 的 `toast.success/error/info` | 统一文案前缀，错误必须带可行动信息 |

`lib/markdown.ts` 的安全处理：

```ts
const md = new MarkdownIt({ html: false, linkify: true, breaks: false })

export function renderReadme(raw: string, baseUrl: string): string {
  const html = md.render(raw)
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['img', 'style', 'iframe', 'form', 'input'],
    FORBID_ATTR: ['style', 'onerror', 'onload'],
  })
}
```

- `html: false` 让 markdown-it 不解析内联 HTML，`DOMPurify` 再兜一层 —— 双保险，README 是外部不可信内容。
- 图片一律禁掉：README 里的相对图片路径在弹窗里必然 404，宁可不显示也不破图。
- 相对链接改写成 `https://{host}/{owner}/{repo}/blob/HEAD/...`，点得通；外链统一补 `target=_blank rel="noopener noreferrer nofollow"`。

---

## 7. 已知取舍

| 取舍 | 后果 | 何时需要改 |
|---|---|---|
| 三张表全量拉取 + realtime 全表订阅 | 每次改动都回拉整表，流量随数据量线性增长 | 单表 > 5000 行时改成「按组查询 + 分页」 |
| 前端直连 GitHub raw | 私有库 / GitLab / Gitee（部分可用）/ 自建 Git 抓不到，失败留空 | 需要覆盖内网 Git 时，才引入 Supabase Edge Function 做代理 |
| Lucide 1705 个图标 | 后台改上传封面后只剩「无图回退」用它；索引表单独成 chunk（310KB / 59KB gzip），动态 `import()` 拉，首页不请求 | 已按需拆分 |
| `admins` 只能用 SQL 维护 | 加管理员要登 Supabase 后台 | 管理员多于 3 人时写个 RPC + 后台页面 |
| 搜索在客户端做 | 数据量大时首屏要全量加载 | 需要全文检索时上 `pg_trgm` + RPC |
| 标签写入与 item 写入不是同一事务 | 极端情况下 item 写成功但标签池没入池 | 需要强一致时封装一个 Postgres 函数用 RPC 调用 |

## 8. 实现状态（2026-11-02）

| 验证项 | 结果 |
|---|---|
| `vue-tsc --noEmit` | **0 error**（strict + `verbatimModuleSyntax`） |
| `vite build` | **成功**，1231 模块；gzip：`bootstrap` 53 KB / `supabase` 59 KB / `markdown` 59 KB / `data` 60 KB / CSS 8.6 KB |
| `npm run selfcheck` | **24/24 断言通过**（git URL 解析、raw 候选、摘录提取、排序中点） |
| dev server | `GET /` 与各视图/组件模块 transform 全部 200 |
| 构建产物抽查 | 关键 Tailwind 类（含只在深层动态 chunk 里出现的 `grid-cols-8`、`max-h-[50vh]`、`dark:*`）全部在 CSS 中 |

相比 Firebase 版，这次迁移带来三处净收益：**包体小了一半**（474 KB → 227 KB，gzip 112 → 59）、**级联删除交给数据库**（少一整套分批批处理代码）、**约束写在 schema 里**（长度/URL/标签数量不再是「客户端约定」）。

沿用的实证修正（均在 Firebase 版就已落地，本次未回退）：

1. **`reorder*(orderedIds)` → `move*(id, toIndex)`**：拖拽事件本身就知道被移动项与目标下标，传完整顺序还要在 store 里做数组 diff。
2. **调色板 `ring` → `bar`**：需要的是 `hover:` 状态下的装饰条，而 `hover:ring-slate-500/20` 这样的类名源码里不存在，Tailwind 会直接丢掉；改成不带变体前缀的 `bar`，由组件加 `group-hover:` 控制显隐。
3. **`SortableList` 是薄封装**：`vue-draggable-plus` 的默认插槽传的是实例而不是 `{ element, index }`，条目由使用方 `v-for`；被移动项从**拖拽前快照**按 `oldIndex` 取。
4. **shadcn-vue 组件取自官方 registry**（`https://shadcn-vue.com/r/styles/new-york/*.json`），图标换成 Lucide（lucide-vue-next），与组件库默认一致。
5. **不依赖 vee-validate**：表单校验直接用 `zod` + `safeParse`。
6. **订阅引用计数**：`subscribe()` 返回幂等释放函数，前后台同时订阅时任何一方卸载都不会拆掉另一方的监听。
7. **启动流程拆成 `main.ts` + `bootstrap.ts`**：`supabase.ts` 在模块求值期校验 env，静态 import 时报错发生在 main 函数体之前，用户只能看到白屏。改成 `await import('./bootstrap')` 并 catch，缺变量时渲染一页带变量名与修复步骤的提示。
8. **`extractIntro` 无 H1 的分支修正**：见 §3 `lib/readme.ts` 第 5 条，由自检发现的真 bug。
9. **`assertAffected()`**：Supabase 的 RLS 拦截 `update`/`delete` 时**不报错只返回 0 行**，所以写操作一律接 `.select('id')` 判空，否则会出现「提示成功但数据没变」。

> 嵌套弹窗（表单里再开图标选择器）已核对 reka-ui 源码确认安全：`body` 的 `pointer-events` 按 owner 引用计数（`acquireBodyPointerEvents`），且只有最顶层 layer 会被设为 `auto`。

## 9. 下一步

1. 建 Supabase 项目 → **SQL Editor 粘 `supabase/schema.sql` 跑一次** → 建管理员账号 → `insert into admins` 写入 UID（见 §1.4）。
2. 把 `Project URL` 与 `anon public` key 填进 `.env.local`。
3. 跑 `npm run dev` 联调：建组 → 建应用 → 拖排序 → 前台看效果。

### 本机环境备注（不是项目要求）

当前沙箱有两处限制，可能影响你自己的机器之外的自动化：

- `npm install` 曾需加 `--ignore-scripts`，否则 postinstall 的子进程管道会被拒（`EPERM spawn`）；
- `vite build` 需要把 `TEMP`/`TMP` 指到工作区内（esbuild 默认往用户 Temp 写临时文件）：
  `$env:TEMP="D:\...\toolbox\.tmp"; npm run build`。

同一条命令在普通 Windows/macOS 环境下无需这些参数。
