// Build-time prerender (Path A, static SPA).
//
// Runs after `vite build`. Fetches the latest live snapshot from Supabase and
// injects it as real, crawlable HTML into dist/index.html — between the
// <!-- prerender:start --> / <!-- prerender:end --> markers inside #root — plus
// an ItemList JSON-LD block. React replaces #root on load, so users still get the
// full interactive app; crawlers and the AdSense reviewer get real content first.
//
// Safe to run anywhere: if Supabase env is missing or the fetch fails, it logs a
// warning, leaves dist/index.html untouched, and exits 0 (build never breaks).

import { readFile, writeFile } from 'node:fs/promises'
import { createClient } from '@supabase/supabase-js'

const DIST = new URL('../dist/index.html', import.meta.url)
const SITE = 'https://your-domain.com' // keep in sync with index.html / sitemap.xml

const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function fmtNum(n) {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k'
  return String(n ?? 0)
}

async function fetchLatestDaily(supabase) {
  const { data: snaps, error } = await supabase
    .from('snapshots')
    .select('id, captured_date')
    .eq('period', 'daily')
    .eq('lang_filter', '')
    .order('captured_at', { ascending: false })
    .limit(1)
  if (error) throw new Error(error.message)
  if (!snaps?.length) return null

  const { data: rows, error: e2 } = await supabase
    .from('rankings')
    .select(
      'rank, stars, forks, period_stars, repos!inner(full_name, owner, name, url, description, language)',
    )
    .eq('snapshot_id', snaps[0].id)
    .order('rank')
  if (e2) throw new Error(e2.message)

  return {
    date: snaps[0].captured_date,
    repos: (rows || []).map((r) => ({
      rank: r.rank,
      stars: r.stars,
      forks: r.forks,
      periodStars: r.period_stars,
      fullName: r.repos.full_name,
      url: r.repos.url,
      description: r.repos.description,
      language: r.repos.language,
    })),
  }
}

function renderContent({ date, repos }) {
  const items = repos
    .map(
      (r) => `
        <li>
          <a href="${esc(r.url)}" rel="noopener">${esc(r.fullName)}</a>
          ${r.language ? `<span> · ${esc(r.language)}</span>` : ''}
          <span> · ★ ${fmtNum(r.stars)}</span>
          ${r.periodStars > 0 ? `<span> · +${fmtNum(r.periodStars)} today</span>` : ''}
          ${r.description ? `<p>${esc(r.description)}</p>` : ''}
        </li>`,
    )
    .join('')

  return `
      <section aria-label="GitHub Trending daily ranking">
        <p>每日开源精选 · Daily Open Source</p>
        <h1>GitHub Trending 每日汇总</h1>
        <p>
          每天追踪 GitHub 上最受关注的开源项目，提供每日 / 每周 / 每月排行榜，
          可按编程语言筛选，并长期归档每一天的榜单。以下是
          <strong>${esc(date)}</strong> 的每日热门项目（共 ${repos.length} 个）。
        </p>
        <ol>${items}
        </ol>
        <nav aria-label="site">
          <a href="${SITE}/about.html">关于 About</a> ·
          <a href="${SITE}/privacy.html">隐私政策 Privacy</a> ·
          <a href="${SITE}/contact.html">联系 Contact</a>
        </nav>
        <p>数据来自 github.com/trending · 历史归档来自 Internet Archive</p>
      </section>`
}

function renderJsonLd({ date, repos }) {
  const list = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `GitHub Trending — ${date}`,
    description: `GitHub 每日最热开源项目排行（${date}）`,
    numberOfItems: repos.length,
    itemListElement: repos.slice(0, 25).map((r) => ({
      '@type': 'ListItem',
      position: r.rank,
      name: r.fullName,
      url: r.url,
      ...(r.description ? { description: r.description } : {}),
    })),
  }
  return `<script type="application/ld+json">${JSON.stringify(list)}</script>`
}

async function main() {
  if (!url || !key) {
    console.warn('[prerender] VITE_SUPABASE_URL / KEY not set — skipping (dist/index.html unchanged).')
    return
  }

  let html
  try {
    html = await readFile(DIST, 'utf8')
  } catch {
    console.warn('[prerender] dist/index.html not found — run after `vite build`. Skipping.')
    return
  }

  let data
  try {
    const supabase = createClient(url, key)
    data = await fetchLatestDaily(supabase)
  } catch (e) {
    console.warn('[prerender] Supabase fetch failed — skipping:', e.message)
    return
  }

  if (!data || !data.repos.length) {
    console.warn('[prerender] No snapshot rows yet — skipping.')
    return
  }

  const start = '<!-- prerender:start -->'
  const end = '<!-- prerender:end -->'
  const i = html.indexOf(start)
  const j = html.indexOf(end)
  if (i === -1 || j === -1) {
    console.warn('[prerender] markers not found in dist/index.html — skipping.')
    return
  }

  const before = html.slice(0, i + start.length)
  const after = html.slice(j)
  html = before + '\n' + renderContent(data) + '\n      ' + after

  // ItemList JSON-LD before </head>
  html = html.replace('</head>', `    ${renderJsonLd(data)}\n  </head>`)

  await writeFile(DIST, html, 'utf8')
  console.log(`[prerender] Injected ${data.repos.length} repos for ${data.date} into dist/index.html.`)
}

main().catch((e) => {
  console.warn('[prerender] unexpected error — skipping:', e?.message || e)
})
