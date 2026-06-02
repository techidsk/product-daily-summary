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
4. `.github/workflows/backfill.yml`：每周一自动从 Wayback 滚动补最近 10 天（修补 ingest 偶尔漏掉的日子）；也可在 Actions 页 **Run workflow** 手动指定 `from/to` 或 `days`、`periods`、`langs` 做一次性历史回填。CI runner 直连 archive.org，无需代理。

## SEO & Google AdSense

为搜索引擎收录与 AdSense 申请做的准备（路线 A 静态站）：

- **英文优先（面向海外）**：`index.html`（`lang="en"`、title / description / keywords / OG / Twitter / JSON-LD 全英文）、`server/prerender.js` 注入的爬虫内容、以及 `about.html` / `privacy.html` / `contact.html` 三个内容页都以英文为主语言（保留少量中文说明）。React UI 仍是中 / 英 / 日三语，跟随浏览器自动切换。单 URL 客户端切换，故不发 per-language `hreflang`（那需要各语言独立 URL），只保留 canonical + `x-default`。
- **`index.html`**：完整 `<head>`——title / description / keywords / canonical / Open Graph / Twitter Card / `theme-color` / 图标 / PWA manifest，外加 `WebSite`、`Organization`、`FAQPage`（英文，匹配 Googlebot 渲染，可拿 FAQ 富结果）三段 JSON-LD。
- **构建时预渲染 `server/prerender.js`**：`npm run build`（= `vite build && node server/prerender.js`）跑完后，从 Supabase 拉最新「daily / 全部语言」快照，把真实榜单作为可被爬虫读取的 HTML 注入 `index.html` 的 `<!-- prerender:start/end -->` 标记之间，并补一段 `ItemList` JSON-LD。React 加载后会替换 `#root`，用户仍得到完整交互应用；爬虫与 AdSense 审核先看到真实内容。同时把 `dist/sitemap.xml` 首页 `<lastmod>` 盖成最新快照日期（让搜索引擎把每日榜单当作新鲜更新）。**无 Supabase 环境变量或抓取失败时自动跳过、不报错**——此时 `sitemap.xml` 保留占位日期。
- **`public/`**：`robots.txt`、`sitemap.xml`、`ads.txt`（含占位说明）、`site.webmanifest`，以及 `guide.html` / `about.html` / `privacy.html` / `contact.html` 四个独立可爬取的内容页（AdSense 审核基本必备，尤其隐私政策）。
- **品牌与图标**：源无关的「Trending」主品牌（上升柱状图 + 趋势箭头，paper/ink/vermilion 配色，未来扩展 ProductHunt / YC 不用换图）。源文件 `public/favicon.svg`（站标）、`public/icon-maskable.svg`（Android 安全区）、`public/og.svg`（OG 卡片，Georgia/monospace 免 web-font 依赖）。运行 `node scripts/gen-icons.mjs` 用 `sharp` 光栅化出 `favicon-16/32.png`、`apple-touch-icon.png`(180)、`icon-192/512.png`、`icon-maskable-512.png`、`og.png`(1200×630)——改了任一 SVG 后重跑即可。OG/Twitter 图指向 **`og.png`**（社交爬虫多数不渲染 SVG）。另有深色变体 `og-dark.svg` → `og-dark.png`（ink 底，社交流里更跳），想用就把 `index.html` 里的 `og:image` / `twitter:image` 从 `og.png` 改成 `og-dark.png`。
- **原创内容**：首页底部「关于本榜单 + 常见问题（5 条）」段落（三语，见 `src/i18n.jsx`），加上独立长文 `public/guide.html`（英文原创，约 1000 词：trending 的真实含义、日/周/月差异、如何读 star/fork、语言筛选、历史归档价值、使用技巧），显著缓解 AdSense「内容单薄 / 无原创」风险。

> **域名**：已配置为 `https://trending.magikaru.com`（`index.html`、`public/robots.txt`、`public/sitemap.xml`、`public/*.html`、`server/prerender.js` 的 `SITE` 常量均已替换）。换域名时全局替换该值即可。
>
> **AdSense（最终目标）**：在 AdSense 后台添加根域 `magikaru.com`（覆盖子域）；审核**不看流量**，只看内容质量/合规/隐私政策——故重点是内容充实与原创（已备 guide + FAQ + about）。`public/ads.txt` 会部署到 `trending.magikaru.com/ads.txt`（投广告的 host，权威位置），保险起见也可在 `magikaru.com/ads.txt` 放同一行。账号通过后填 `VITE_ADSENSE_*` 环境变量即开启广告（见下文）。

### 接入 AdSense

广告完全由环境变量驱动，**不配置就完全隐藏**：不渲染任何 `<ins>` 标签、不加载 `adsbygoogle.js`，右侧广告位自动收起（主榜单变整宽单栏）。账号通过审核后再开启，无需改任何代码：

1. 在 Cloudflare Pages 环境变量（或本地 `.env`）里填发布商 ID 与各广告单元的 `data-ad-slot` 数字 ID：
   ```bash
   VITE_ADSENSE_CLIENT=ca-pub-XXXXXXXXXXXXXXXX      # 必填，ca-pub- 开头才会启用
   VITE_ADSENSE_SLOT_RAIL_HALFPAGE=1234567890       # 右栏 300×600 半页
   VITE_ADSENSE_SLOT_RAIL_RECTANGLE=1234567891      # 右栏 300×250 中矩形
   VITE_ADSENSE_SLOT_INFEED_MOBILE=1234567892       # 移动端信息流 320×100
   ```
   slot 数字 ID 在 AdSense 后台「广告 → 按广告单元」里，每个单元各有一个。
2. 重新 build / 部署。`src/lib/ads.js` 会在 `<head>` 动态注入带你 client id 的脚本，并把三个广告位渲染成真实单元；`ca-pub-` 前缀校验通过才启用，填错或留空都安全降级为隐藏。
3. 账号通过后，把 `public/ads.txt` 里的 `pub-XXXX` 换成真实 ID 并取消注释。

> 布局调试：设 `VITE_ADS_PLACEHOLDER=1` 可在未配 client 时显示虚线占位框（标注尺寸），生产留空。所有变量见 `.env.example`。

## 开发 Develop

```bash
npm install
cp .env.example .env   # 可选：填 Supabase 后启用持久化与历史
npm run dev            # http://localhost:5173
npm run ingest         # 手动抓取今日榜单入库（需 .env）
npm run build

# 历史回填 Backfill：从 Internet Archive（archive.org）拉取过去某天的 trending
npm run backfill -- --from=2024-01-01 --to=2024-03-01
npm run backfill -- --days=90                       # 最近 90 天到今天
npm run backfill -- --days=60 --periods=daily --langs=all,javascript
```

> 回填原理：`github.com/trending` 只显示当天，过去的榜单从 **Wayback Machine** 取。
> `server/backfill.js` 用 archive.org 的 CDX API 列出每天一份存档快照（`daily` 走
> 归档最密的裸 `/trending`，`weekly/monthly` 走对应 `?since=` 变体），按 `id_` 原始
> 模式抓回页面，复用同一套 cheerio 解析器，并以**存档当天的真实日期**入库——所以日历
> 高亮的就是 archive.org 实际抓到的那些天。回填可重复跑（按 upsert 幂等）。
>
> **代理**：archive.org 在部分网络被封。`server/proxy.js` 会读取 `HTTPS_PROXY`/
> `HTTP_PROXY`/`ALL_PROXY`（Node 原生 fetch 默认不认这些变量），有代理时自动把
> archive.org 流量走代理；在 `.env` 里设 `HTTPS_PROXY=http://127.0.0.1:7897` 即可。
> 不影响 `npm run ingest`（直连 github.com）与 GitHub Actions（无需代理）。

## 功能 Features

- 每日 / 每周 / 每月 周期切换
- 编程语言过滤（JS / TS / Python / Go / Rust / Java / C++）
- 多语言界面（跟随浏览器，可手动切换，localStorage 记忆）
- 分享卡片：Top 5 汇总，或单个仓库（悬停/点击行内分享按钮），导出 2x PNG
- 历史存档：有快照时出现**日历**入口，点选某天即可回看当天榜单（有数据的日期高亮，无数据置灰）
- 历史回填：`npm run backfill` 从 Internet Archive 拉取过去的 trending 快照
