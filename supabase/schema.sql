-- ============================================================
-- 工具箱 · Supabase 初始化脚本
--
-- 用法：Supabase Dashboard → SQL Editor → New query → 整段粘贴 → Run
-- 全部语句幂等，重跑不会报错、不会丢数据。
-- ============================================================

-- ---------------------------------------------------------- 1. 数据表

create table if not exists public.app_group (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(btrim(name)) between 1 and 60),
  sort       double precision not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 注意：`group` 是 SQL 保留字，所以字段叫 group_id。
-- on delete cascade 让「删组顺带删应用」由数据库保证，客户端不用手写批量删除。
create table if not exists public.app_item (
  id             uuid primary key default gen_random_uuid(),
  group_id       uuid not null references public.app_group (id) on delete cascade,
  name           text not null check (char_length(btrim(name)) between 1 and 80),
  git_url        text not null check (git_url ~ '^https?://.+'),
  readme_raw     text not null default '' check (char_length(readme_raw) <= 200000),
  intro          text not null default '' check (char_length(intro) <= 300),
  enabled        boolean not null default true,
  hero_icon_name text not null default 'squares-2x2' check (hero_icon_name ~ '^[a-z0-9-]+$'),
  theme_color    text not null default 'slate-500' check (theme_color ~ '^[a-z]+-[0-9]{2,3}$'),
  tags           text[] not null default '{}' check (coalesce(array_length(tags, 1), 0) <= 10),
  sort           double precision not null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- 增量升级：老库重跑本文件即可补齐 `intro` / `enabled` 两列（新建库时上面的 create 已含）
alter table public.app_item add column if not exists intro   text not null default '';
alter table public.app_item add column if not exists enabled boolean not null default true;

do $$
begin
  alter table public.app_item
    add constraint app_item_intro_len check (char_length(intro) <= 300);
exception
  when duplicate_object then null;
end $$;

create index if not exists app_item_group_sort_idx on public.app_item (group_id, sort);

-- id = lower(btrim(name))，由客户端计算，保证标签全局唯一且可幂等入池
create table if not exists public.tag_pool (
  id         text primary key,
  name       text not null check (char_length(btrim(name)) between 1 and 30),
  created_at timestamptz not null default now()
);

-- 管理员白名单：只认 auth.users 里真实存在的用户
create table if not exists public.admins (
  uid        uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------- 2. updated_at

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists app_group_touch on public.app_group;
create trigger app_group_touch
  before update on public.app_group
  for each row execute function public.touch_updated_at();

drop trigger if exists app_item_touch on public.app_item;
create trigger app_item_touch
  before update on public.app_item
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------- 3. 管理员判定

-- security definer：策略里查 admins 时不会再触发 admins 自己的 RLS（避免递归）
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where uid = auth.uid());
$$;

-- ---------------------------------------------------------- 4. 行级安全

alter table public.app_group enable row level security;
alter table public.app_item enable row level security;
alter table public.tag_pool enable row level security;
alter table public.admins enable row level security;

-- 三张业务表：所有人可读，只有管理员可写
drop policy if exists app_group_read on public.app_group;
create policy app_group_read on public.app_group
  for select using (true);

drop policy if exists app_group_write on public.app_group;
create policy app_group_write on public.app_group
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists app_item_read on public.app_item;
create policy app_item_read on public.app_item
  for select using (true);

drop policy if exists app_item_write on public.app_item;
create policy app_item_write on public.app_item
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists tag_pool_read on public.tag_pool;
create policy tag_pool_read on public.tag_pool
  for select using (true);

drop policy if exists tag_pool_write on public.tag_pool;
create policy tag_pool_write on public.tag_pool
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- 管理员表：登录后只读自己那一行，用来判断「我是不是管理员」；没有任何写策略
drop policy if exists admins_read_self on public.admins;
create policy admins_read_self on public.admins
  for select to authenticated
  using (uid = auth.uid());

-- ---------------------------------------------------------- 5. 权限（粗粒度，细粒度由 RLS 兜底）

grant usage on schema public to anon, authenticated;
grant select on public.app_group, public.app_item, public.tag_pool to anon, authenticated;
grant insert, update, delete on public.app_group, public.app_item, public.tag_pool to authenticated;
grant select on public.admins to authenticated;

-- ---------------------------------------------------------- 6. 实时订阅

-- 前台靠 realtime 保持与后台同步；重复执行会命中 duplicate_object，已吞掉
do $$
begin
  begin
    alter publication supabase_realtime add table public.app_group;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.app_item;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.tag_pool;
  exception when duplicate_object then null;
  end;
end;
$$;

-- ============================================================
-- 7. 建管理员（上一步跑完后，单独执行这一段）
--
--   1) Authentication → Users → Add user，填邮箱 + 密码
--   2) 复制该用户的 UID
--   3) 把下面的 UUID 换掉，执行一次：
--
--   insert into public.admins (uid) values ('在这里粘贴-UID')
--     on conflict (uid) do nothing;
--
--   白名单为空时，所有写操作都会被 RLS 拒绝（前台仍可正常浏览）。
-- ============================================================
