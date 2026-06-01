# GitHub Trending · 每日汇总

汇总 GitHub **每日 / 每周 / 每月** trending 项目，支持一键生成分享卡片。多语言（中 / 英 / 日）。

A consumer-friendly digest of GitHub trending repos (daily / weekly / monthly) with one-click share cards. Multilingual (zh / en / ja).

## 技术栈 Stack

- **Vite + React 19 + Tailwind CSS v4**
- **@phosphor-icons/react** — 图标
- **Inter + JetBrains Mono** (Fontsource) — UI 字体 / 代码字体
- **html-to-image** — 分享卡片导出 PNG
- **cheerio** — 服务端解析 `github.com/trending`

## 架构 Architecture（路线 A：静态站 + 直读 Supabase）

```
GitHub Actions (cron) ──npm run ingest──▶ Supabase Postgres ◀──直读── 浏览器(SPA, CF Pages)
   抓取+解析 github.com/trending           repos/snapshots/rankings    @supabase/supabase-js
```

- **抓取/入库（服务端）**：`server/*` 用 cheerio 抓 `github.com/trending`，`pg` 直连写库。无官方 API、无第三方依赖。
- **读取（前端）**：浏览器用 `@supabase/supabase-js` + publishable key 直读最新快照（RLS 仅放开 anon `select`）。无需 API 服务器。
- **三张表**：`repos`（按 `full_name` 去重）、`snapshots`（每天 × 周期 × 语言唯一）、`rankings`。每天的快照即历史归档。

### 本地 Setup

1. 在 [supabase.com](https://supabase.com) 建项目，复制 `.env.example` 为 `.env`：
   - `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY`（前端读，API Keys 里取）
   - `DATABASE_URL`（入库写，用 **Session pooler** 串，别用 IPv6-only 的 Direct）
2. `npm run db:push` 建表 + 只读策略 → `npm run ingest` 抓首批数据。

### 部署 Deploy（Cloudflare Pages）

1. Cloudflare Pages 连本仓库：构建 `npm run build`、输出 `dist`、Framework 选 Vite。
2. Pages 环境变量配 `VITE_SUPABASE_URL` 与 `VITE_SUPABASE_PUBLISHABLE_KEY`。
3. GitHub 仓库 Settings → Secrets → Actions 加 `DATABASE_URL`；`.github/workflows/ingest.yml` 每 6 小时自动入库（也可手动触发）。

## 开发 Develop

```bash
npm install
cp .env.example .env   # 可选：填 Supabase 后启用持久化与历史
npm run dev            # http://localhost:5173
npm run ingest         # 手动抓取入库（需 .env）
npm run build
```

## 功能 Features

- 每日 / 每周 / 每月 周期切换
- 编程语言过滤（JS / TS / Python / Go / Rust / Java / C++）
- 多语言界面（跟随浏览器，可手动切换，localStorage 记忆）
- 分享卡片：Top 5 汇总，导出 2x PNG
- 历史存档：有快照时出现日期下拉，可回看过往某天的榜单
