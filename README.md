# 工具箱 · Toolbox

团队内部应用导航站：前台公开浏览卡片、搜索、看 README；后台 `/admin` 管理应用组、应用与标签。

- 技术栈：Vue 3 + Vite + TypeScript + Tailwind v4 + shadcn-vue（reka-ui）+ Lucide + Pinia
- 后端：Supabase（Postgres + RLS + Auth + Realtime），**没有自建 Node 后端**
- 设计决策与数据模型：[docs/design.md](docs/design.md)

## 快速开始

### 1. 建 Supabase 项目（一次性）

1. [supabase.com/dashboard](https://supabase.com/dashboard) → New project → 选离你近的区域（如 `ap-southeast-1`）→ 记下数据库密码。
2. 进项目 → **SQL Editor** → New query → 粘贴 [supabase/schema.sql](supabase/schema.sql) **全文** → Run。
   这一段会建好 4 张表、约束、RLS 策略、管理员判定函数和实时订阅，**可重复执行**。
3. **Authentication → Providers → Email**：确认已启用；本地/内部用建议关掉 **Confirm email**（否则新账号登录会报邮箱未验证）。
4. **Authentication → Users → Add user** 建管理员账号 → 复制该用户的 **UID**。
5. 回 SQL Editor，单独执行一句（把 UID 换掉）：

   ```sql
   insert into public.admins (uid) values ('在这里粘贴-UID')
     on conflict (uid) do nothing;
   ```

6. **Settings → API** → 复制 `Project URL` 和 `anon public` key。

> ⚠️ `admins` 表为空时，所有写操作都会被 RLS 拒绝（前台仍可正常浏览）。这是最常见的「后台点保存没反应」原因。

### 2. 配置环境变量

```bash
cp .env.example .env.local
```

填两项（这两个值本来就会打进前端包，不是机密；安全边界全在 RLS）：

```
VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
```

> 不要用 `service_role` key —— 它能绕过所有 RLS。

### 3. 开发

```bash
npm install
npm run dev        # http://localhost:5173
```

| 命令 | 作用 |
|---|---|
| `npm run dev` | 本地开发 |
| `npm run typecheck` | `vue-tsc` 严格类型检查 |
| `npm run build` | 类型检查 + 生产构建到 `dist/` |
| `npm run preview` | 预览构建产物 |
| `npm run selfcheck` | 纯逻辑自检（git URL 解析 / README 摘录 / 排序中点，24 条断言，不需要连数据库） |

### 启动报错？

缺 `${VITE_SUPABASE_*}` 时页面不会白屏，而是直接显示「启动失败」+ 缺了哪几个变量 + 三步修复。
如果看到空白页，说明是别的异常，打开 DevTools Console 看第一条红字即可。

> 改了 `.env.local` 必须**重启** `npm run dev`：Vite 只在启动时读取 `import.meta.env`。

## 功能速览

**前台** `/`

- 应用组收进**居中的一个下拉**，不再是侧边栏
- 应用用 **3D coverflow 轮播**展示：拖动 / 方向键 / 点两侧卡片 / 分页点切换
- 卡片是 **2:3 的封面图**（cover 裁切）：点它打开应用的**线上地址**（url，没配则退回 Git 地址）
- 应用名 / 地址 / GitHub 图标按钮（跳源码仓库）/ 三行简介在卡片下方居中；没传封面的老数据回退成图标色块
- 应用少于 5 个时自动循环铺满整条轮播，不会只孤零零一张
- 下方信息区全程可见：切换应用时文字立刻更新，只做 100ms 淡入
- 分组下拉 + 轮播 + 信息区整体在页面里垂直居中
- 全局搜索：匹配应用名、简介与标签，搜索时忽略分组
- 亮/暗主题一键切换，本地持久化（`index.html` 里有防闪烁内联脚本）

**后台** `/admin`

- Supabase Auth 登录 + `admins` 表校验，守卫拦截未登录/非管理员
- 应用组：增删改 + 拖拽排序（松手即写库）
- 应用：增删改、**线上地址（url）**、**封面图上传**（存 Supabase Storage，超过 1400px 自动压成 WebP）、主题色面板、标签输入（新标签自动入池）
- 「拉取 README」：浏览器直连 GitHub raw 取原文，**自动生成卡片简介**（可手工改，改过的不会被再拉取覆盖），失败留空，**不做任何 LLM 摘要**
- 每行一颗开关，随时**启用/停用**：停用后前台立刻消失，数据保留

## 几个实现要点

- **三张表全量拉取 + realtime**：排序/搜索都在前端算，后台改完前台即时可见。只有一个索引 `app_item(group_id, sort)`。
- **拖拽排序只写一行**：`sort` 是 `double precision`，取前后邻居中点；间隙耗尽才整组重排。
- **删组只发一条 DELETE**：`app_item.group_id` 带 `on delete cascade`。
- **标签池靠主键去重**：`tag_pool.id = lower(btrim(name))`，新增标签是幂等 `upsert(ignoreDuplicates)`。
- **RLS 拦 update/delete 不报错**：所以每次写都 `.select('id')` 判空，避免「提示成功但没变」。
- **README 安全**：markdown-it 关内联 HTML + DOMPurify 二次净化，图片一律丢弃。

## 部署

线上地址（GitHub Pages，push 到 `main` 自动发布）：

- 前台：<https://helisz.github.io/toolbox/>
- 后台：<https://helisz.github.io/toolbox/admin>

流水线在 [.github/workflows/deploy-pages.yml](.github/workflows/deploy-pages.yml)：`npm ci` → `npm run build:pages` → 上传 `dist/`。

三个与 Pages 相关的细节：

1. **子路径**：项目站点部署在 `/toolbox/` 下，构建时用 `VITE_BASE_PATH=/toolbox/` 覆盖 `vite.config.ts` 的 `base`；`createWebHistory(import.meta.env.BASE_URL)` 会自动跟随。换自定义域名时把它改成 `/`。
2. **深链接回退**：Pages 不支持 rewrite，`scripts/postbuild-pages.mjs` 会把 `index.html` 复制成 `404.html` —— 直接刷新 `/toolbox/admin` 会拿到 404 状态码但正确渲染 SPA。
3. **环境变量**：CI 里没有 `.env.local`，两个 `VITE_SUPABASE_*` 写在 workflow 的 `env` 里（anon key 本来就会打进前端包，安全边界在 RLS）。

部署到别的静态托管（Vercel / Netlify / Cloudflare Pages / Nginx）也可以：`npm run build`，产物 `dist/`，记得配 SPA 回退（`**` → `/index.html`）。

## 已知限制

- README 只能从公开 GitHub 仓库抓取；私有库 / 部分 GitLab/Gitee 仓库 / 自建 Git 会失败并留空。
- 图标用 Lucide（1705 个），现在只作「没传封面」的回退：索引表单独成 chunk 并动态加载，首页只显示封面图时完全不请求它。
- 管理员只能在 Supabase 里用 SQL 维护 `admins` 表，没有后台页面。
- 单表超过约 5000 行时，应把「全量拉取 + 全表订阅」改成「按组查询 + 分页」。
