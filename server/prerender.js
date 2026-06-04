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
const DIST_SITEMAP = new URL('../dist/sitemap.xml', import.meta.url)
const SITE = 'https://trending.magikaru.com' // keep in sync with index.html / sitemap.xml

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

// Mirror src/api/trending.js mapRows() exactly, so the JSON we inject as the
// client's React Query initialData has the same shape as a live fetchTrending()
// result — no missing fields, no visual "pop" when the background refetch lands.
function mapRow(r) {
  return {
    rank: r.rank,
    stars: r.stars,
    forks: r.forks,
    periodStars: r.period_stars,
    owner: r.repos.owner,
    name: r.repos.name,
    fullName: r.repos.full_name,
    url: r.repos.url,
    description: r.repos.description,
    language: r.repos.language,
    languageColor: r.repos.language_color,
  }
}

async function fetchLatestDaily(supabase) {
  // Two most recent daily/all-language snapshots, so we can diff for the ▲/▼/NEW
  // markers exactly like the client does (annotateDeltas).
  const { data: snaps, error } = await supabase
    .from('snapshots')
    .select('id, captured_date')
    .eq('period', 'daily')
    .eq('lang_filter', '')
    .order('captured_at', { ascending: false })
    .limit(2)
  if (error) throw new Error(error.message)
  if (!snaps?.length) return null

  const { data: rows, error: e2 } = await supabase
    .from('rankings')
    .select(
      'rank, stars, forks, period_stars, repos!inner(full_name, owner, name, url, description, language, language_color)',
    )
    .eq('snapshot_id', snaps[0].id)
    .order('rank')
  if (e2) throw new Error(e2.message)

  // Previous snapshot's rank-by-name map for the delta diff (best-effort).
  let prev = null
  if (snaps[1]) {
    const { data: prevRows } = await supabase
      .from('rankings')
      .select('rank, repos!inner(full_name)')
      .eq('snapshot_id', snaps[1].id)
    if (prevRows) prev = new Map(prevRows.map((row) => [row.repos.full_name, row.rank]))
  }

  const repos = (rows || []).map((r) => {
    const m = mapRow(r)
    if (!prev) return { ...m, rankDelta: null, isNew: false }
    const prevRank = prev.get(m.fullName)
    return {
      ...m,
      rankDelta: prevRank === undefined ? null : prevRank - m.rank,
      isNew: prevRank === undefined,
    }
  })

  return { date: snaps[0].captured_date, repos }
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
        <p>Daily Open-Source Digest</p>
        <h1>GitHub Trending — Daily Ranking</h1>
        <p>
          Track the most popular open-source projects on GitHub with daily,
          weekly and monthly rankings, filter by programming language, and
          revisit every day's list from a long-term archive. Below are the
          trending repositories for <strong>${esc(date)}</strong>
          (${repos.length} in total).
        </p>
        <ol>${items}
        </ol>
        <nav aria-label="site">
          <a href="${SITE}/repo/">All repos</a> ·
          <a href="${SITE}/hall-of-fame/">Hall of Fame</a> ·
          <a href="${SITE}/learn">Learn</a> ·
          <a href="${SITE}/guide">Guide</a> ·
          <a href="${SITE}/about">About</a> ·
          <a href="${SITE}/privacy">Privacy</a> ·
          <a href="${SITE}/contact">Contact</a>
        </nav>
        <p>Data from github.com/trending · historical archives from the Internet Archive</p>
      </section>`
}

function renderJsonLd({ date, repos }) {
  const list = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `GitHub Trending — ${date}`,
    description: `The hottest open-source repositories trending on GitHub on ${date}.`,
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

// Inline the daily feed as JSON so the client can hydrate React Query's cache on
// first paint — the live feed renders instantly instead of flashing a loading
// state over the prerendered HTML. `at` is the build time; the client passes it
// as initialDataUpdatedAt so the data reads as stale and silently refetches the
// latest snapshot in the background (no spinner). Escape `<` to keep the JSON
// from breaking out of the <script> element.
function renderInitialData({ repos }, at) {
  const json = JSON.stringify({ at, repos }).replace(/</g, '\\u003c')
  return `<script id="initial-daily" type="application/json">${json}</script>`
}

// Stamp the homepage <lastmod> (the first one in the file) with the latest
// snapshot date, so search engines see the daily ranking as freshly updated.
// Best-effort: a missing/odd sitemap just skips, never breaks the build.
async function stampSitemap(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date))) return
  let xml
  try {
    xml = await readFile(DIST_SITEMAP, 'utf8')
  } catch {
    return // no sitemap in dist — nothing to stamp
  }
  const stamped = xml.replace(/<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/, `<lastmod>${date}</lastmod>`)
  if (stamped !== xml) {
    await writeFile(DIST_SITEMAP, stamped, 'utf8')
    console.log(`[prerender] Stamped sitemap homepage lastmod = ${date}.`)
  }
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

  // ItemList JSON-LD + the client-hydration payload before </head>
  const initial = renderInitialData(data, Date.now())
  html = html.replace('</head>', `    ${renderJsonLd(data)}\n    ${initial}\n  </head>`)

  await writeFile(DIST, html, 'utf8')
  console.log(`[prerender] Injected ${data.repos.length} repos for ${data.date} into dist/index.html.`)

  await stampSitemap(data.date)
}

main().catch((e) => {
  console.warn('[prerender] unexpected error — skipping:', e?.message || e)
})
