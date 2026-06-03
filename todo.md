# TODO · 后续可做的内容

本文件记录 SEO / AdSense / 产品功能方向的后续计划。北极星目标:**通过 AdSense 审核** + **SEO 拿下长尾流量**(英文优先)。

---

## ✅ 已完成(已上线)

- **AdSense 接入**:`index.html` `<head>` 硬编码加载器(`ca-pub-1476592629109289`,带 `data-adsbygoogle`),`ads.txt` 填真实 ID。
- **内容板块**:`/learn` 中心页 + 4 篇英文原创文章(`how-to-trend` / `stars-forks-watchers` / `discovery` / `trending-archive`)。
- **单仓库轨迹页**:`server/gen-repo-pages.js` 为上榜 ≥2 天的仓库各生成 `/repo/owner/name`(内联 SVG 排名曲线 + 上榜日志 + 同语言内链),约 900 个可索引页;`/repo` 中心页 + `sitemap-repos.xml`。
- **名人堂** `/hall-of-fame`:上榜天数 / 单日涨星 / 最高 star 三榜。
- **排名变化标记**:列表每行 ▲/▼/新(对比上一份快照)。
- **首页异动快讯条**:排名上升 + 新入榜。
- **On This Day**:首页回看一个月前 / 一年前的今天。
- **RSS**:`server/gen-feed.js` → `/feed.xml`,每日摘要。

---

## 🔜 Backlog(按优先级)

### 1. AI 摘要 + 每日复盘 ⭐(中成本 · 最利 AdSense)
- **做什么**:用 LLM 给每个仓库生成一句通俗摘要(trending 原始描述常很干瘪),并每天生成一段"今日趋势复盘"短文;可顺带把英文描述翻成中/日。
- **价值**:原创内容自动化工厂,直接消除"内容单薄"拒因;天天更新 = freshness。
- **落地**:
  - 新批处理脚本(仿 `ingest`),只给**还没摘要**的仓库调一次 API。
  - `repos` 表加 `summary` 列(可加 `summary_zh` / `summary_ja`);前端只读缓存,零额外成本。
  - 放进 GitHub Actions,密钥 `OPENROUTER_API_KEY` 走 secret——**只在服务端,绝不进 `VITE_`**。
  - **OpenRouter free 模型**(`:free` 后缀)有速率/每日额度限制,但摘要是批处理、每天仅 ~25 个新仓库,够用。每日复盘可做成独立内容页 + 进 sitemap。

### 2. 按语言落地页 `/trending/rust` 等(中成本 · SEO 规模化)
- **做什么**:构建时为每个语言生成静态落地页,含该语言当前榜单 + **一段独有的原创引言** + 内链到轨迹页。
- **价值**:接 `github trending rust` / `python trending` 这类长尾,规模化 URL。
- **落地**:扩展 `gen-repo-pages.js` 或新增生成器;**每页必须有原创文字**,否则纯列表有薄内容风险。进 sitemap。

### 3. 公开 JSON 数据导出 / 简易 API(低-中成本 · 外链)
- **做什么**:把归档数据以 JSON/CSV 暴露(构建时生成静态 JSON,或 Cloudflare Pages Functions)。
- **价值**:开发者爱用 → 容易被引用换**反向链接**(SEO 最稀缺)。

### 4. 可嵌入"trending 徽章"(中成本 · 外链引擎)
- **做什么**:给开发者可贴进自己 README 的徽章(显示"曾 N 次登上 trending")。
- **价值**:别人贴进 README = 反向链接。
- **落地**:动态徽章需 Cloudflare Pages Functions 返回 SVG;或构建时为每个仓库生成静态 SVG。

### 5. 每个 `/repo` 页动态 OG 图(中成本 · 分发)
- **做什么**:为轨迹页生成社交分享卡片图(可复用现有 `og` 生成思路 / `scripts/gen-icons.mjs`)。
- **价值**:社交分享有好看的卡片 → 带流量。

### 6. 周 / 月回顾文章(中成本 · 内容 + freshness)
- 自动从快照生成"本周/本月 trending 复盘"长文,原创内容 + 定期更新。与 #1 的每日复盘同源,可合并设计。

---

## 🧊 较低优先(锦上添花)

- **站内搜索**:跨归档按名字搜仓库(提升停留)。
- **关注 / 收藏**(localStorage):收藏仓库,再上榜时高亮。
- **仓库对比页** `/compare?a=&b=`:并排看多个仓库的 trending 历史曲线。
- **名人堂拆分**:把三榜拆成独立页(`/leaderboard/most-days` 等),各接不同查询。
- **轨迹页增强**:除 daily/全语言外,展示该仓库在 weekly/monthly/各语言榜的出现情况。
- **性能 / Core Web Vitals**:`index-*.js` 约 465KB,可拆分懒加载(LCP/CLS 是排名因子)。
- **结构化数据增强**:轨迹页加 `SoftwareApplication` schema 等。
- **更多语言过滤**:目前硬编码 7 种(与 ingest 联动)。
- ~~暗色模式~~:已决定不做。

---

## 📌 运维 / 提醒

- **部署**:push 到 `origin/main` → Cloudflare Pages 自动构建。构建会跑 prerender + 生成 ~900 repo 页,耗时略长属正常。
- **环境变量**:Cloudflare Pages 需配 `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY`,否则 prerender / gen-repo-pages / gen-feed 会安全跳过(不报错,但无数据页)。
- **AdSense**:上线验证脚本 + `ads.txt` 后,去 AdSense「网站」提交审核;若以"内容不足"被拒,优先推进 Backlog #1(AI 摘要 / 复盘)再重申。
- **文件数上限**:Cloudflare Pages 单次部署约 2 万文件;`gen-repo-pages.js` 已设 `MAX_PAGES=8000`,接近时再调或分页 sitemap。
- 所有构建期脚本都**失败安全**(无 env / 抓取失败 → 警告 + exit 0,绝不让构建中断)。
