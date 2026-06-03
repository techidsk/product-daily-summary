-- GitHub Trending 持久化 schema (Supabase Postgres)
-- 在 Supabase 控制台 → SQL Editor 里整段执行即可（或 `npm run db:push`）。
-- 写入走服务端直连 Postgres（DATABASE_URL，绕过 RLS）。
-- 读取：前端用 publishable/anon key 直读这三张表（RLS 开启 + 下方 anon select 策略放开）。

-- ── 仓库（按 full_name 去重，跨快照复用）──────────────────────────
create table if not exists public.repos (
  id              bigint generated always as identity primary key,
  full_name       text not null unique,           -- owner/name
  owner           text not null,
  name            text not null,
  url             text not null,
  description     text,
  language        text,
  language_color  text,
  updated_at      timestamptz not null default now()
);

-- ── 快照（每天 × 周期 × 语言过滤 唯一一条）────────────────────────
create table if not exists public.snapshots (
  id            bigint generated always as identity primary key,
  captured_at   timestamptz not null default now(),
  captured_date date not null,
  period        text not null check (period in ('daily','weekly','monthly')),
  lang_filter   text not null default '',
  unique (captured_date, period, lang_filter)
);
create index if not exists snapshots_lookup
  on public.snapshots (period, lang_filter, captured_at desc);

-- ── 排名（某次快照里每个仓库的名次与当时指标）──────────────────────
create table if not exists public.rankings (
  snapshot_id  bigint not null references public.snapshots(id) on delete cascade,
  repo_id      bigint not null references public.repos(id) on delete cascade,
  rank         int not null,
  stars        int,
  forks        int,
  period_stars int,
  primary key (snapshot_id, repo_id)
);
create index if not exists rankings_by_rank
  on public.rankings (snapshot_id, rank);

-- RLS：开启。写入走直连 Postgres（绕过 RLS）；读取允许 anon（前端直读）。
alter table public.repos     enable row level security;
alter table public.snapshots enable row level security;
alter table public.rankings  enable row level security;

-- 公开只读：trending 是公开数据，允许浏览器用 publishable key 读这三张表。
grant usage on schema public to anon;
grant select on public.repos, public.snapshots, public.rankings to anon;

drop policy if exists "anon read repos" on public.repos;
create policy "anon read repos" on public.repos for select to anon using (true);

drop policy if exists "anon read snapshots" on public.snapshots;
create policy "anon read snapshots" on public.snapshots for select to anon using (true);

drop policy if exists "anon read rankings" on public.rankings;
create policy "anon read rankings" on public.rankings for select to anon using (true);
