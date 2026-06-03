# Google AdSense 验收清单与流程规范

> 适用站点：**trending.magikaru.com**（GitHub Trending Daily）
> 目标：通过 Google AdSense 审核并开始展示广告。
> 最后更新：2026-06-04

本文档回答三件事：
1. AdSense 到底**需要哪些东西**（sitemap.xml 只是其中一项）；
2. 从注册到放广告的**完整验收流程**；
3. Google 官方有没有**硬性规范 / 标准**，以及我们站点目前的落地情况。

---

## 一、AdSense 审核的本质

AdSense 不是「检查文件是否齐全」的机械审核，而是**人工 + 自动**两层判断，核心看三点：

1. **网站所有权**——你能证明这个域名是你的（`ads.txt` / 验证代码）。
2. **内容质量与原创性**——有没有「足够多、有价值、原创」的内容（Google 称为 *thin content* / *low-value content* 是最常见的拒绝原因）。
3. **政策合规**——隐私政策、用户体验、导航、是否有违规内容。

> ⚠️ 关键认知：`sitemap.xml`、`robots.txt`、`ads.txt` 这类文件是**必要但不充分**条件。它们能帮助爬虫抓取，但**通过审核的决定性因素是内容**。我们站点是聚合 GitHub Trending 数据的，必须特别注意「原创增值」问题（见 [第五节](#五本站特有的风险点必读)）。

---

## 二、需要的文件 / 页面清单（带本站现状）

### A. 站点级技术文件（放在根目录 `public/`）

| 文件 | 作用 | AdSense 必需性 | 本站现状 |
|---|---|---|---|
| `robots.txt` | 允许爬虫抓取，声明 sitemap 位置 | 强烈建议 | ✅ 已有，且显式 Allow 了 `Mediapartners-Google` / `AdsBot-Google` |
| `sitemap.xml` | 主站地图，帮助 Google 发现页面 | 强烈建议（非强制） | ✅ 已有 |
| `sitemap-repos.xml` | 仓库详情页地图 | 建议 | ✅ 已验证（2026-06-04）：线上返回 200，含 **913 个** repo URL。由 `gen-repo-pages.js` 在 build 时生成（需 Supabase env，本地无 env 会跳过，属正常） |
| `ads.txt` | 声明授权的广告商，防止假冒库存 | **审核通过后必需** | ✅ 已有 `pub-1476592629109289`。注意：当前只在子域 `trending.magikaru.com/ads.txt`，建议根域 `magikaru.com/ads.txt` 也放一份 |
| `feed.xml` (RSS) | 内容更新分发，利于抓取与「活跃度」信号 | 加分项 | ✅ 已验证（2026-06-04）：线上返回 200。由 `gen-feed.js` 生成（同需 Supabase env） |
| `site.webmanifest` / favicon | 站点完整度信号 | 加分项 | ✅ 已有 |

### B. 必备的「合规内容页」

Google 审核员会**手动找这几类页面**，缺一个都可能被拒：

| 页面 | 为什么必需 | 本站现状 |
|---|---|---|
| **隐私政策 Privacy Policy** | **硬性要求**。必须说明使用 Cookie、第三方广告（Google 用 DoubleClick/AdSense Cookie 做个性化广告）、数据收集。 | ✅ `public/privacy.html` —— **务必检查是否已写明 Google AdSense / 第三方 Cookie 条款**（见第六节） |
| **关于 About** | 证明站点有真实运营者、有目的 | ✅ `public/about.html` |
| **联系方式 Contact** | 审核员判断可信度的关键项 | ✅ `public/contact.html`（最好有可达邮箱，不要只放表单） |
| **服务条款 Terms**（可选但推荐） | 提升可信度 | ❓ 未见独立 terms 页，可考虑补 |

### C. 实质内容页（决定成败）

| 内容 | 本站对应 |
|---|---|
| 多篇原创、有信息增量的页面 | `guide.html` / `learn.html` / `how-to-trend.html` / `stars-forks-watchers.html` / `discovery.html` / `trending-archive.html` + 每个 repo 详情页 |
| 持续更新 | 每日 ingest 的 trending 快照 + 归档 |

---

## 三、完整验收流程（从 0 到放广告）

```
①准备 → ②注册 → ③放验证代码 → ④Google 审核(1~14天) → ⑤通过/驳回 → ⑥放广告单元 → ⑦ads.txt → ⑧持续合规
```

**① 准备（提交前自查）**
- 域名能正常访问、HTTPS 正常、无大量死链。
- 隐私/关于/联系页齐全且能从导航点到。
- 内容「看起来像个真站点」：有导航、有页脚、移动端正常。
- sitemap 提交到 Google Search Console（强烈建议，先让 Google 索引）。

**② 注册 AdSense**
- https://adsense.google.com → 用站点域名注册。
- 填写收款国家/地区、账户类型（个人）。

**③ 放置验证代码**
Google 给一段 `<script>` 形式的 AdSense 代码片段，放进 `<head>`。**三种验证方式任选其一**：
- AdSense code snippet（最常用，放 `index.html` 的 `<head>`）；
- `ads.txt` 片段；
- Meta 标签 / Google Search Console 关联。
> 对本站：直接在 `index.html` 的 `<head>` 加 AdSense snippet 最稳妥（SPA 也只需主文档有即可）。

**④ Google 审核**
- 周期：通常 **几天到两周**，偶尔更久。
- 审核期间 Google 爬虫会抓全站，所以 robots/sitemap 必须放行（本站已放行）。

**⑤ 结果**
- ✅ 通过：账户激活，可创建广告单元。
- ❌ 驳回：邮件给出大类原因（最常见：**Low value content / 内容价值不足**）。修改后可**无限次重新提交**。

**⑥ 创建并放置广告单元**
- 推荐先用 **Auto ads（自动广告）**：一段代码，Google 自动决定广告位。
- 或手动创建 display/in-feed 广告单元，按需插入页面。

**⑦ 部署 ads.txt**
- 通过后 Google 会提示「ads.txt 缺失/未授权」，把 `google.com, pub-XXXX, DIRECT, f08c47fec0942fa0` 放到根目录（本站已就绪）。

**⑧ 持续合规**
- 不点自己的广告、不诱导点击、不放违规内容，否则封号。

---

## 四、有没有「规范 / 标准」？——有，且要逐条对照

Google 的硬性规范主要是这三套（出问题基本都能在里面找到对应条款）：

1. **AdSense Program Policies（计划政策）**
   https://support.google.com/adsense/answer/48182
   - 禁止：成人/暴力/盗版/仇恨/虚假/诱导点击等内容。

2. **Google Publisher Policies / Restrictions（发布商政策）**
   https://support.google.com/publisherpolicies
   - 涵盖内容、行为、广告布局的统一标准。

3. **Webmaster / Search 质量准则（间接但关键）**
   - 「Helpful Content」「原创性」原则——决定是否被判 *thin content*。

4. **必须自建的合规项**（Google 把责任推给站长）：
   - **Cookie/隐私告知**：欧盟 GDPR、加州 CCPA。AdSense 政策要求你的隐私政策披露第三方使用 Cookie。若有欧盟流量，还需 **Consent（同意管理 CMP）**——Google 要求接入认证 CMP（如 Google 自家的 Privacy & messaging / Funding Choices）。

> 没有一份「打勾就过」的官方 checklist——规范是上面这些政策文档，审核是人工对照判断。

---

## 五、本站特有的风险点（必读）

本站是**聚合 GitHub Trending 数据**的站点，这正好踩在 AdSense 最敏感的两条线上：

1. **Scraped / thin content（抓取内容、缺乏增量）**
   - 风险：如果页面只是把 GitHub 的仓库名 + star 数列出来，Google 会判定为「没有原创价值的抓取内容」直接拒。
   - 对策（本站已有部分，需强化）：
     - 每个 repo 详情页要有**原创增量**——趋势解读、历史 star 曲线、为什么上榜、对比，而不仅是镜像 GitHub 数据。
     - `guide` / `learn` / `how-to-trend` 这类**纯原创长文**是过审主力，要保证质量和篇幅。

2. **内容数量与「成熟度」**
   - Google 偏好运营有一段时间、有稳定内容量的站。新站 + 纯聚合最容易被拒。
   - 对策：先靠 backfill 积累历史归档页（已有 archive 机制），让站点显得有纵深。

3. **多语言但单 URL**
   - 本站 client-side 切换语言、canonical 指向 `en` 单一 URL。这对 AdSense 没问题（审核看英文版即可），但 SEO 上无法被多语言索引——与 AdSense 审核无关，知悉即可。

---

## 六、待办 / 自查项（提交审核前逐条确认）

- [x] ~~确认线上 `dist/` 真实包含 `sitemap-repos.xml` 和 `feed.xml`~~ **已于 2026-06-04 验证通过**：`curl` 线上 `/sitemap-repos.xml`（200，913 个 URL）、`/feed.xml`（200）、`/sitemap.xml`、`/robots.txt`、`/ads.txt` 均为 200。本地 `dist/` 缺这两个文件只是因为本地构建无 Supabase env 而跳过，属正常，**非 bug**。
- [x] ~~修正 sitemap 里 `/repo`、`/hall-of-fame` 的 307 跳转~~ **已于 2026-06-04 修复**：`public/sitemap.xml` 两条 `<loc>` 改为带斜杠的最终 URL（`/repo/`、`/hall-of-fame/`），消除多余的一跳。
- [x] ~~`public/privacy.html` 广告/Cookie 条款~~ **已于 2026-06-04 验证**：含 AdSense、third-party、cookie、personalize 等条款，线上 `/privacy` 返回 200。
- [x] ~~`index.html` 的 `<head>` 放入 AdSense snippet~~ **已验证**：硬编码加载 `pagead2.googlesyndication.com/...client=ca-pub-1476592629109289`（第 136–146 行）。
- [x] ~~提交 Google Search Console~~ **用户确认已完成**（外部操作，文档不复核）。
- [x] ~~根域 `magikaru.com/ads.txt`~~ **已于 2026-06-04 验证**：`curl` 根域 ads.txt 返回 200 且含正确 pub-1476592629109289。
- [x] ~~About / Contact 真实可达邮箱~~ **已验证**：`contact.html` 有 `mailto:v1kr4m.n41r@proton.me`，真实可达。
- [x] ~~导航能点到 Privacy / About / Contact~~ **已验证**：三页线上均 200，sitemap 已收录。
- [x] ~~移动端 + Lighthouse~~ **用户确认已完成**（外部操作，文档不复核）。
- [ ]（可选）补一个独立 Terms 页提升可信度 —— 当前 `public/terms.html` 不存在；非硬性要求，可后补。

---

## 七、一句话总结

> **文件（sitemap/robots/ads.txt/隐私页）是入场券，内容原创性与站点成熟度才是裁判。**
> 本站技术文件基本就绪，最大的不确定性是「聚合内容会不会被判 thin content」——重点投入在 repo 详情页的原创增量和原创长文上，并先用 Search Console 把站点喂给 Google 索引一段时间再提交审核。

---

### 参考链接
- AdSense 资格指南：https://support.google.com/adsense/answer/9724
- AdSense 计划政策：https://support.google.com/adsense/answer/48182
- 发布商政策中心：https://support.google.com/publisherpolicies
- ads.txt 规范（IAB）：https://iabtechlab.com/ads-txt/
- Sitemap 协议：https://www.sitemaps.org/protocol.html
- 必备的隐私政策要求：https://support.google.com/adsense/answer/1348695
