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

GitHub 没有官方 trending API，浏览器直连会被 CORS 拦截。本项目在 Vite dev 中间件里**服务端抓取并解析** `github.com/trending`，无第三方 API 依赖。

> 生产部署：把 `server/scrapeTrending.js` 原样搬到 serverless 函数（如 Vercel/Netlify `/api/trending`），前端无需改动。

## 开发 Develop

```bash
npm install
npm run dev      # http://localhost:5173
npm run build
```

## 功能 Features

- 每日 / 每周 / 每月 周期切换
- 编程语言过滤（JS / TS / Python / Go / Rust / Java / C++）
- 多语言界面（跟随浏览器，可手动切换，localStorage 记忆）
- 分享卡片：Top 5 汇总，导出 2x PNG
