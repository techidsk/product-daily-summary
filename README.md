# GitHub Trending · 每日汇总

汇总 GitHub **每日 / 每周 / 每月** trending 项目，支持一键生成分享卡片，多语言界面（中 / 英 / 日）。线上地址：`https://trending.magikaru.com`。

最终目标是通过 **Google AdSense** 审核，所以 SEO 与原创英文内容很重要（见下方 SEO 章节）。

## 技术栈

- **Vite + React 19 + Tailwind CSS v4**
- **@phosphor-icons/react** — 图标
- **Fraunces / Hanken Grotesk / JetBrains Mono**（Fontsource 可变字体）— 标题 / UI / 代码字体
- **html-to-image** — 分享卡片导出 PNG
- **cheerio** — 服务端解析 `github.com/trending`
- **Supabase Postgres** + **pg** — 数据持久化与历史归档

## 快速开始

```bash
npm install
cp .env.example .env    # 可选：填 Supabase 后启用持久化与历史归档
npm run dev             # 开发服务器 → http://localhost:5173
```

不配 Supabase 也能跑前端，只是没有数据（前端直接读 Supabase，详见下方架构）。

## 常用命令

```bash
npm run dev            # Vite 开发服务器 → http://localhost:5173
npm run build          # vite build && node server/prerender.js（构建后把最新快照预渲染进 dist/index.html）
npm run preview        # 本地预览构建产物 dist/

npm run db:push        # 执行 supabase/schema.sql（建表 + anon 只读策略）。需要 DATABASE_URL
npm run ingest         # 抓取今日 trending 的「全部 周期 × 语言」组合并写库。需要 DATABASE_URL

# 历史回填：从 Internet Archive（archive.org）拉取过去某天的 trending
npm run backfill -- --days=90                          # 最近 90 天到今天
npm run backfill -- --from=2024-01-01 --to=2024-03-01
npm run backfill -- --days=60 --periods=daily --langs=all,javascript

node scripts/gen-icons.mjs   # 把 public/*.svg 光栅化成 PNG 图标 + OG 图（改过任一源 SVG 后重跑）
```

> 项目**没有配置测试框架，也没有 lint 脚本**——不存在 `npm test` / `npm run lint`。
> 所有 Node 脚本通过 `--env-file-if-exists=.env` 读取环境变量。

### 环境变量

| 变量 | 用途 |
| --- | --- |
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` | 前端直读快照（在 Supabase 项目 API Keys 里取） |
| `DATABASE_URL` | 服务端写库（用 **Session pooler** 串，别用 IPv6-only 的 Direct） |
| `HTTPS_PROXY` / `HTTP_PROXY` / `ALL_PROXY` | 回填时给 archive.org 走代理（见下文） |
| `VITE_ADSENSE_*` | AdSense 配置，留空则广告完全隐藏（见下文） |

完整清单见 `.env.example`。

## 架构

采用 **路线 A：静态 SPA 直读 Supabase**——生产环境**没有 API 服务器**。

```
GitHub Actions (cron) ──npm run ingest──▶ Supabase Postgres ◀──直读── 浏览器 SPA (Cloudflare Pages)
   抓取+解析 github.com/trending          repos / snapshots / rankings    @supabase/supabase-js + publishable key
```

- **抓取入库（服务端 `server/*`）**：`scrapeTrending.js` 抓 `github.com/trending`，用 cheerio 解析成统一的 repo 结构。`ingest.js#persistSnapshot` 在单个事务里写入一份快照（按 `full_name` upsert repos → upsert 快照行 → 重建该快照的 rankings），唯一键是 `(captured_date, period, lang_filter)`。`ingest-all.js` 遍历全部「周期 × 语言」组合（每次间隔 2.5s 避免被限流），就是 cron 跑的入口。写入走**直连 Postgres**（`server/db.js` 的 `pg.Pool`），绕过 RLS。
- **读取（前端 `src/api/trending.js`）**：浏览器用 publishable/anon key 直接查 Supabase。RLS 开着，但 `schema.sql` 给 anon 授予了三张表的 `select`，所以读取是公开的（trending 本身就是公开数据）。前端不经过任何后端路由。
- **三张表**（`supabase/schema.sql`）：
  - `repos`——按 `full_name` 去重，跨快照复用；
  - `snapshots`——每天 × 周期 × 语言过滤唯一一条，**每天的快照即历史归档**；
  - `rankings`——某次快照里每个仓库的名次与当时指标。

### ⚠️ 两套解析 / 两条读取路径，改一处要同步全部

前端的 Supabase 查询（`src/api/trending.js`）和服务端的直连 `pg` 查询（`server/store.js`）各自独立做了**同样的 snake_case → camelCase 映射**。scraper 产出的结构（`scrapeTrending.js`）、入库的列（`ingest.js`）、以及两个读取端必须字段名一致（`periodStars` ↔ `period_stars`、`languageColor` ↔ `language_color` 等）。**改一个就要改全部。**

> 注意：`server/store.js`（含 `getTrending` / 内存缓存 / 重新入库逻辑）是一条**线上 SPA 并不使用的备用 API-server 读取路径**——前端是直读 Supabase 的。`schema.sql` 顶部那句「前端通过 /api 走服务端读取」是**过时注释**，描述的是旧路径，别信它，以 `src/api/trending.js` 为准。

### 历史回填（Wayback）

`github.com/trending` 只显示当天。`server/backfill.js` + `scrapeWayback.js` 用 archive.org 的 CDX API 列出每天一份存档快照，**复用同一套 cheerio 解析器**（`parseTrendingHtml`），并以**存档当天的真实日期**入库。可重复跑（按 upsert 幂等）。所以日历高亮的，就是 archive.org 实际抓到的那些天。

> **代理**：archive.org 在部分网络被封。`server/proxy.js` 会读取 `HTTPS_PROXY`/`HTTP_PROXY`/`ALL_PROXY`（Node 原生 fetch 默认不认这些变量），有代理时只把 archive.org 流量走代理。本地在 `.env` 设 `HTTPS_PROXY=http://127.0.0.1:7897` 即可。`npm run ingest`（直连 github.com）和 GitHub Actions 都不需要代理。

### 构建时预渲染（SEO）

`server/prerender.js` 在 `vite build` 之后运行：从 Supabase 拉最新的「daily / 全部语言」快照，把真实榜单作为可被爬虫读取的 HTML 注入 `dist/index.html` 中 `#root` 内的 `<!-- prerender:start -->` / `<!-- prerender:end -->` 标记之间，并补一段 `ItemList` JSON-LD，同时把 `dist/sitemap.xml` 首页 `<lastmod>` 盖成最新快照日期。React 加载后替换 `#root`，用户仍得到完整交互应用；爬虫与 AdSense 审核先看到真实内容。**绝不能让构建失败**：无 Supabase 环境变量或抓取失败时，打印警告并 exit 0，`dist/index.html` 保持不变。

## 前端约定

- **`src/App.jsx`** 是整个应用：报头 + 周期/语言/日历控件 + 仓库列表 + 两个分享弹窗。状态 `since` / `language` / `archiveDate` 驱动 `load()` effect；`archiveDate` 为空 = 最新/实时，选了某天 = 走 `fetchHistory`。
- **i18n**（`src/i18n.jsx`）：`translations` 对象按 `zh` / `en` / `ja` 三键组织，配 `useI18n()` hook（`t`、`locale`）。locale 跟随浏览器自动检测、可手动切换、localStorage 记忆。所有用户可见文案都走 `t('key')`——**加 key 要三种语言都加**。面向 SEO 的文案（index.html、预渲染、`public/*.html` 内容页）以**英文为主**，尽管 UI 是三语。
- **广告**（`src/lib/ads.js`）：完全由环境变量驱动。`VITE_ADSENSE_CLIENT` 不以 `ca-pub-` 开头就什么都不渲染、也不加载脚本，右侧广告栏收起、主榜单变整宽。任何要预留广告空间的布局都应 gate 在 `ADS_VISIBLE` 上。调试布局可设 `VITE_ADS_PLACEHOLDER=1` 显示虚线占位框。
- **Tailwind CSS v4**（经 `@tailwindcss/vite`）。自定义设计 token（`paper` / `ink` / `vermilion` / `muted` 等）和 `rise` / `grain` 效果都在 `src/index.css`。

## 部署（Cloudflare Pages）

1. Cloudflare Pages 连本仓库：构建命令 `npm run build`，输出目录 `dist`，框架选 Vite。
2. Pages 环境变量配 `VITE_SUPABASE_URL` 与 `VITE_SUPABASE_PUBLISHABLE_KEY`。
3. GitHub 仓库 Settings → Secrets → Actions 加 `DATABASE_URL`。
   - `.github/workflows/ingest.yml`：每 6 小时自动入库（也可手动触发）。
   - `.github/workflows/backfill.yml`：每周自动从 Wayback 滚动补最近约 10 天；也可在 Actions 页 **Run workflow** 手动指定 `from/to` 或 `days`、`periods`、`langs` 做一次性历史回填。CI runner 直连 archive.org，无需代理。

> **换域名**：全局替换 `SITE` 常量即可——它硬编码在 `index.html`、`public/robots.txt`、`public/sitemap.xml`、`public/*.html`、`server/prerender.js` 多处。

## SEO & Google AdSense

为搜索引擎收录与 AdSense 申请做的准备（路线 A 静态站）：

- **英文优先（面向海外）**：`index.html`（`lang="en"`、title / description / keywords / OG / Twitter / JSON-LD 全英文）、`server/prerender.js` 注入的爬虫内容，以及 `guide.html` / `about.html` / `privacy.html` / `contact.html` 内容页都以英文为主语言。React UI 仍是中 / 英 / 日三语，跟随浏览器自动切换。单 URL 客户端切换，故不发 per-language `hreflang`，只保留 canonical + `x-default`。
- **`index.html`**：完整 `<head>`——title / description / keywords / canonical / Open Graph / Twitter Card / `theme-color` / 图标 / PWA manifest，外加 `WebSite`、`Organization`、`FAQPage` 三段 JSON-LD（英文，匹配 Googlebot 渲染，可拿 FAQ 富结果）。
- **`public/`**：`robots.txt`、`sitemap.xml`、`ads.txt`（含占位说明）、`site.webmanifest`，以及 `guide.html` / `about.html` / `privacy.html` / `contact.html` 四个独立可爬取内容页（AdSense 审核基本必备，尤其隐私政策）。
- **品牌与图标**：源无关的「Trending」主品牌。源文件 `public/favicon.svg`、`public/icon-maskable.svg`、`public/og.svg`，跑 `node scripts/gen-icons.mjs`（用 `sharp`）光栅化出全套 PNG（favicon、apple-touch-icon、icon-192/512、og.png 1200×630 等）。OG/Twitter 图指向 `og.png`（社交爬虫多数不渲染 SVG）。另有深色变体 `og-dark.png`。
- **原创内容**：首页底部「关于本榜单 + 常见问题（5 条）」段落（三语，见 `src/i18n.jsx`），加上独立长文 `public/guide.html`（英文原创约 1000 词），显著缓解 AdSense「内容单薄 / 无原创」风险。

### 接入 AdSense

广告完全由环境变量驱动，**不配置就完全隐藏**（不渲染 `<ins>`、不加载 `adsbygoogle.js`，右栏收起）。账号通过审核后再开启，无需改代码：

1. 在 Cloudflare Pages 环境变量（或本地 `.env`）填发布商 ID 与各广告单元的 `data-ad-slot` 数字 ID：
   ```bash
   VITE_ADSENSE_CLIENT=ca-pub-XXXXXXXXXXXXXXXX      # 必填，ca-pub- 开头才会启用
   VITE_ADSENSE_SLOT_RAIL_HALFPAGE=1234567890       # 右栏 300×600 半页
   VITE_ADSENSE_SLOT_RAIL_RECTANGLE=1234567891      # 右栏 300×250 中矩形
   VITE_ADSENSE_SLOT_INFEED_MOBILE=1234567892       # 移动端信息流 320×100
   ```
   slot 数字 ID 在 AdSense 后台「广告 → 按广告单元」里，每个单元各有一个。
2. 重新 build / 部署。`src/lib/ads.js` 会动态注入带你 client id 的脚本，`ca-pub-` 前缀校验通过才启用，填错或留空都安全降级为隐藏。
3. 账号通过后，把 `public/ads.txt` 里的 `pub-XXXX` 换成真实 ID 并取消注释。

## 功能

- 每日 / 每周 / 每月 周期切换
- 编程语言过滤（JS / TS / Python / Go / Rust / Java / C++）
- 多语言界面（跟随浏览器，可手动切换，localStorage 记忆）
- 分享卡片：Top 5 汇总，或单个仓库（悬停/点击行内分享按钮），导出 2x PNG
- 历史存档：有快照时出现**日历**入口，点选某天即可回看当天榜单（有数据高亮，无数据置灰）
- 历史回填：`npm run backfill` 从 Internet Archive 拉取过去的 trending 快照
