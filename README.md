# GitHub Trending · 每日汇总

汇总 GitHub **每日 / 每周 / 每月** trending 项目，支持一键生成分享卡片。多语言（中 / 英 / 日）。

A consumer-friendly digest of GitHub trending repos (daily / weekly / monthly) with one-click share cards. Multilingual (zh / en / ja).

## 技术栈 Stack

- **Vite + React 19 + Tailwind CSS v4**
- **@phosphor-icons/react** — 图标
- **Inter + JetBrains Mono** (Fontsource) — UI 字体 / 代码字体
- **html-to-image** — 分享卡片导出 PNG
- **cheerio** — 服务端解析 `github.com/trending`

## 数据来源 Data

GitHub 没有官方 trending API，浏览器直连会被 CORS 拦截。本项目在服务端**抓取并解析** `github.com/trending`（cheerio），无第三方 API 依赖。前端只调 `/api/*`，不直连数据库。

## 持久化 Persistence（Supabase Postgres，直连 `pg`）

三张表：`repos`（按 `full_name` 去重）、`snapshots`（每天 × 周期 × 语言唯一）、`rankings`。
读取走 `server/store.js`：命中 30 分钟内的 DB 快照直接返回，过期则重新抓取入库；上游故障时回退最近快照。**未配置 `DATABASE_URL` 时自动回退为实时抓取 + 内存缓存**（无历史）。服务端用原生 `pg` + SQL，无 ORM。

### 配置 Setup

1. 在 [supabase.com](https://supabase.com) 建项目。
2. 复制 `.env.example` 为 `.env`，填 `DATABASE_URL` —— 用 **Session pooler** 串（Connect → Session pooler，IPv4/5432；别用 IPv6-only 的 Direct connection）。
3. `npm run db:push` 建表 → `npm run ingest` 写入今天的快照（daily/weekly/monthly）。

> `store.js`、`ingest.js`、`scrapeTrending.js` 与运行时无关，后续接 Cloudflare 时整体搬进 Worker（cron 定时 ingest + 静态托管），前端不动。届时 TCP 连接需配 Hyperdrive 或换 pooler。

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
