// Build-time generator for per-repository trending-history pages (Path A, static).
//
// Runs after `vite build` + prerender. For every repository that has appeared on
// the daily / all-languages ranking on at least MIN_DAYS distinct days, it emits a
// self-contained static HTML page at dist/repo/<owner>/<name>/index.html (served at
// the clean URL /repo/owner/name). Each page carries the repo's rank-over-time chart
// (inline SVG, no JS), a full appearance log, and internal links — real, crawlable
// content that github.com/trending cannot offer, and thousands of indexable URLs.
//
// It also writes a /repo hub index and dist/sitemap-repos.xml.
//
// Reads Supabase with the anon key (same env as prerender.js), so it runs on the
// Cloudflare Pages build. If env is missing or the fetch fails, it logs a warning
// and exits 0 — the build never breaks.

import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const SITE = 'https://trending.magikaru.com' // keep in sync with index.html / sitemap.xml
const DIST_DIR = fileURLToPath(new URL('../dist', import.meta.url))

const MIN_DAYS = 2 // skip repos seen on fewer days → avoid thin / doorway pages
const MAX_PAGES = 8000 // Cloudflare Pages has a ~20k-file deploy cap; stay well under
const HUB_LIMIT = 200 // how many repos to list on the /repo hub
const SLUG_OK = /^[A-Za-z0-9._-]+$/ // GitHub owner/name charset; skip anything odd

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

// Page through a Supabase select 1000 rows at a time.
async function fetchAll(supabase, table, columns, applyFilters = (q) => q) {
  const pageSize = 1000
  const out = []
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await applyFilters(
      supabase.from(table).select(columns).range(from, from + pageSize - 1),
    )
    if (error) throw new Error(`${table}: ${error.message}`)
    out.push(...(data || []))
    if (!data || data.length < pageSize) break
  }
  return out
}

// Rank-over-time chart as inline SVG. Rank 1 sits at the top.
function renderRankChart(series) {
  const W = 720
  const H = 240
  const P = { l: 44, r: 18, t: 18, b: 36 }
  const iw = W - P.l - P.r
  const ih = H - P.t - P.b
  const n = series.length
  const ranks = series.map((s) => s.rank)
  const maxRank = Math.max(...ranks)
  const xAt = (i) => (n === 1 ? P.l + iw / 2 : P.l + (i / (n - 1)) * iw)
  const yAt = (rank) => (maxRank === 1 ? P.t + ih / 2 : P.t + ((rank - 1) / (maxRank - 1)) * ih)

  const pts = series.map((s, i) => `${xAt(i).toFixed(1)},${yAt(s.rank).toFixed(1)}`).join(' ')
  const dots = series
    .map((s, i) => `<circle class="dot" cx="${xAt(i).toFixed(1)}" cy="${yAt(s.rank).toFixed(1)}" r="3" />`)
    .join('')

  const first = series[0].date
  const last = series[n - 1].date
  return `
        <svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img"
             aria-label="Rank on GitHub Trending over time, from ${esc(first)} to ${esc(last)}">
          <line class="grid" x1="${P.l}" y1="${P.t}" x2="${W - P.r}" y2="${P.t}" />
          <line class="grid" x1="${P.l}" y1="${H - P.b}" x2="${W - P.r}" y2="${H - P.b}" />
          <text class="lbl" x="${P.l - 8}" y="${P.t + 4}" text-anchor="end">#1</text>
          <text class="lbl" x="${P.l - 8}" y="${H - P.b + 4}" text-anchor="end">#${maxRank}</text>
          <text class="lbl" x="${P.l}" y="${H - 10}" text-anchor="start">${esc(first)}</text>
          <text class="lbl" x="${W - P.r}" y="${H - 10}" text-anchor="end">${esc(last)}</text>
          <polyline class="line" points="${pts}" />
          ${dots}
        </svg>`
}

const HEAD_STYLE = `
      :root { color-scheme: light; }
      body { margin: 0; background: #f5f1e8; color: #1a1a1a; font-family: -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; line-height: 1.75; }
      .wrap { max-width: 820px; margin: 0 auto; padding: 56px 24px 96px; }
      a { color: #c02a22; }
      h1 { font-size: 2.1rem; margin: 0 0 .2em; letter-spacing: -.01em; line-height: 1.15; word-break: break-word; }
      h1 .owner { color: #8a8a8a; font-weight: 400; }
      h2 { font-size: 1.2rem; margin: 2em 0 .5em; border-top: 1px solid #d8d2c4; padding-top: 1em; }
      .kicker { font-family: ui-monospace, monospace; font-size: .72rem; letter-spacing: .3em; text-transform: uppercase; color: #c02a22; }
      .lead { font-size: 1.1rem; color: #3a3a3a; }
      .desc { color: #4a4a4a; }
      nav { font-family: ui-monospace, monospace; font-size: .72rem; letter-spacing: .15em; text-transform: uppercase; margin-bottom: 40px; border-bottom: 2px solid #1a1a1a; padding-bottom: 12px; }
      nav a { margin-right: 18px; text-decoration: none; color: #6b6b6b; }
      nav a:hover { color: #1a1a1a; }
      .stats { display: flex; flex-wrap: wrap; gap: 10px 28px; margin: 1.2em 0; padding: 0; list-style: none; }
      .stats li { font-family: ui-monospace, monospace; }
      .stats .v { font-size: 1.5rem; color: #1a1a1a; }
      .stats .k { display: block; font-size: .68rem; letter-spacing: .15em; text-transform: uppercase; color: #8a8a8a; }
      .chart { width: 100%; height: auto; margin: .5em 0 1em; }
      .chart .grid { stroke: #d8d2c4; stroke-width: 1; }
      .chart .line { fill: none; stroke: #c02a22; stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }
      .chart .dot { fill: #c02a22; }
      .chart .lbl { font-family: ui-monospace, monospace; font-size: 11px; fill: #8a8a8a; }
      table { border-collapse: collapse; width: 100%; margin: 1em 0; font-size: .95rem; }
      th, td { text-align: left; padding: 7px 10px; border-bottom: 1px solid #d8d2c4; }
      th { font-family: ui-monospace, monospace; font-size: .72rem; letter-spacing: .1em; text-transform: uppercase; color: #6b6b6b; }
      td.num { font-family: ui-monospace, monospace; text-align: right; }
      .dot-lang { display: inline-block; height: 10px; width: 10px; border-radius: 50%; margin-right: 6px; vertical-align: middle; }
      .related a { display: inline-block; margin: 0 14px 8px 0; font-family: ui-monospace, monospace; font-size: .9rem; }
      footer { margin-top: 64px; border-top: 1px solid #d8d2c4; padding-top: 20px; font-family: ui-monospace, monospace; font-size: .72rem; letter-spacing: .15em; text-transform: uppercase; color: #8a8a8a; }`

const NAV = `
      <nav>
        <a href="/">← Home</a>
        <a href="/repo">All repos</a>
        <a href="/hall-of-fame">Hall of Fame</a>
        <a href="/learn">Learn</a>
        <a href="/guide">Guide</a>
        <a href="/about">About</a>
      </nav>`

function renderRepoPage(r) {
  const { owner, name, fullName, url: ghUrl, description, language, languageColor, series, stats, related } = r
  const langPhrase = language ? `a ${esc(language)} project` : 'an open-source project'
  const desc =
    `See ${fullName}'s GitHub Trending history: ${stats.days} days on the daily ranking, ` +
    `peaking at #${stats.peakRank}. Rank-over-time chart and full appearance log.`

  const rows = [...series]
    .reverse()
    .map(
      (s) => `
          <tr>
            <td>${esc(s.date)}</td>
            <td class="num">#${s.rank}</td>
            <td class="num">${fmtNum(s.stars)}</td>
            <td class="num">${s.periodStars > 0 ? '+' + fmtNum(s.periodStars) : '—'}</td>
          </tr>`,
    )
    .join('')

  const relatedHtml = related.length
    ? `
      <h2>Other trending ${language ? esc(language) + ' ' : ''}projects</h2>
      <p class="related">
        ${related
          .map((x) => `<a href="/repo/${x.owner}/${x.name}">${esc(x.fullName)}</a>`)
          .join('\n        ')}
      </p>`
    : ''

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'GitHub Trending', item: SITE + '/' },
      { '@type': 'ListItem', position: 2, name: 'Repositories', item: SITE + '/repo' },
      { '@type': 'ListItem', position: 3, name: fullName, item: `${SITE}/repo/${owner}/${name}` },
    ],
  }

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${esc(fullName)} — GitHub Trending history &amp; rank chart</title>
    <meta name="description" content="${esc(desc)}" />
    <link rel="canonical" href="${SITE}/repo/${owner}/${name}" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <style>${HEAD_STYLE}
    </style>
    <script type="application/ld+json">${JSON.stringify(breadcrumb)}</script>
  </head>
  <body>
    <div class="wrap">${NAV}

      <p class="kicker">Trending history</p>
      <h1><span class="owner">${esc(owner)}/</span>${esc(name)}</h1>
      <p class="lead">
        ${esc(fullName)} is ${langPhrase} that has appeared on GitHub Trending's daily ranking on
        <strong>${stats.days}</strong> days, first seen <strong>${esc(stats.firstSeen)}</strong>.
        It peaked at <strong>rank #${stats.peakRank}</strong> on ${esc(stats.peakDate)}.
      </p>
      ${description ? `<p class="desc">${esc(description)}</p>` : ''}

      <ul class="stats">
        <li><span class="v">${stats.days}</span><span class="k">Days on trending</span></li>
        <li><span class="v">#${stats.peakRank}</span><span class="k">Best rank</span></li>
        <li><span class="v">${fmtNum(stats.latestStars)}</span><span class="k">Stars (latest snapshot)</span></li>
        ${language ? `<li><span class="v"><span class="dot-lang" style="background:${esc(languageColor || '#94a3b8')}"></span>${esc(language)}</span><span class="k">Language</span></li>` : ''}
      </ul>

      <h2>Rank over time</h2>
      ${renderRankChart(series)}
      <p style="font-size:.85rem;color:#6b6b6b;">
        Each point is a day this repository appeared on the daily / all-languages ranking, captured by this site.
        Days with no point are days it was not on the list (or were not archived).
      </p>

      <h2>Appearance log</h2>
      <table>
        <thead>
          <tr><th>Date</th><th class="num">Rank</th><th class="num">Stars</th><th class="num">Gained</th></tr>
        </thead>
        <tbody>${rows}
        </tbody>
      </table>

      <p>
        View the project on
        <a href="${esc(ghUrl)}" rel="nofollow noopener" target="_blank">GitHub</a>,
        or go back to the <a href="/">live ranking</a> and the <a href="/learn">guides</a>.
      </p>
      ${relatedHtml}

      <footer>
        Data from github.com/trending · historical archives from the Internet Archive · not affiliated with GitHub<br />
        <a href="/" style="color:#8a8a8a;">Back to home</a> ·
        <a href="/repo" style="color:#8a8a8a;">All repos</a>
      </footer>
    </div>
  </body>
</html>
`
}

function renderHubPage(list, totalPages) {
  const items = list
    .map(
      (r) => `
        <a class="row" href="/repo/${r.owner}/${r.name}">
          <span class="nm"><span class="owner">${esc(r.owner)}/</span>${esc(r.name)}</span>
          <span class="meta">${r.stats.days} days · best #${r.stats.peakRank}${r.language ? ' · ' + esc(r.language) : ''}</span>
        </a>`,
    )
    .join('')

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>All Repositories — GitHub Trending History Archive</title>
    <meta name="description" content="Browse repositories that have appeared on GitHub Trending, ranked by how many days they stayed on the list. Each has a rank-over-time chart and full appearance history." />
    <link rel="canonical" href="${SITE}/repo/" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <style>${HEAD_STYLE}
      .row { display: flex; justify-content: space-between; align-items: baseline; gap: 16px; text-decoration: none; color: inherit; border-top: 1px solid #d8d2c4; padding: .8em 0; }
      .row:hover .nm { color: #c02a22; }
      .row .nm { font-family: ui-monospace, monospace; font-size: 1rem; word-break: break-word; }
      .row .owner { color: #8a8a8a; }
      .row .meta { font-family: ui-monospace, monospace; font-size: .72rem; letter-spacing: .05em; color: #8a8a8a; white-space: nowrap; }
    </style>
  </head>
  <body>
    <div class="wrap">${NAV}

      <p class="kicker">Archive</p>
      <h1>Repositories on GitHub Trending</h1>
      <p class="lead">
        Every repository below has appeared on GitHub's daily Trending ranking and been archived here. They are
        ordered by staying power — how many days each held a spot. Open any one for its rank-over-time chart and a full
        log of every day it trended. ${totalPages.toLocaleString('en-US')} repositories have a history page.
      </p>
      <div>${items}
      </div>
      <footer>
        Data from github.com/trending · not affiliated with GitHub<br />
        <a href="/" style="color:#8a8a8a;">Back to home</a> ·
        <a href="/learn" style="color:#8a8a8a;">Learn</a>
      </footer>
    </div>
  </body>
</html>
`
}

function renderSitemap(list) {
  const urls = list
    .map(
      (r) => `  <url>
    <loc>${SITE}/repo/${r.owner}/${r.name}</loc>
    <lastmod>${r.stats.lastSeen}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.5</priority>
  </url>`,
    )
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`
}

function renderHallPage(boards, total) {
  const sections = boards
    .map(
      (b) => `
      <h2>${esc(b.title)}</h2>
      <p class="board-note">${esc(b.note)}</p>
      <ol class="board">
        ${b.rows
          .map(
            (row) => `<li>
          <a href="/repo/${row.owner}/${row.name}"><span class="owner">${esc(row.owner)}/</span>${esc(row.name)}</a>
          <span class="val">${row.value}</span>
        </li>`,
          )
          .join('\n        ')}
      </ol>`,
    )
    .join('\n')

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>GitHub Trending Hall of Fame — Most-Trending Repositories</title>
    <meta name="description" content="The all-time leaderboards of GitHub Trending, built from this site's archive: repositories that stayed on the list the most days, posted the biggest single-day star gains, and reached the highest star counts." />
    <link rel="canonical" href="${SITE}/hall-of-fame/" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <style>${HEAD_STYLE}
      ol.board { list-style: none; counter-reset: r; padding: 0; margin: .5em 0 0; }
      ol.board li { counter-increment: r; display: flex; justify-content: space-between; align-items: baseline; gap: 14px; border-top: 1px solid #d8d2c4; padding: .55em 0; }
      ol.board li::before { content: counter(r); font-family: ui-monospace, monospace; font-size: .8rem; color: #8a8a8a; width: 1.8em; flex: none; }
      ol.board a { flex: 1; font-family: ui-monospace, monospace; font-size: .95rem; text-decoration: none; word-break: break-word; }
      ol.board a:hover { color: #c02a22; }
      ol.board .owner { color: #8a8a8a; }
      ol.board .val { font-family: ui-monospace, monospace; font-size: .82rem; color: #1a1a1a; white-space: nowrap; }
      .board-note { color: #6b6b6b; font-size: .92rem; margin: .2em 0 0; }
    </style>
  </head>
  <body>
    <div class="wrap">${NAV}

      <p class="kicker">Hall of Fame</p>
      <h1>GitHub Trending Hall of Fame</h1>
      <p class="lead">
        All-time leaderboards compiled from this site's archive of GitHub's daily Trending ranking. These are the
        repositories that left the deepest mark — by staying power, by explosive single-day growth, and by sheer
        scale. Drawn from ${total.toLocaleString('en-US')} repositories with a trending history.
      </p>
      ${sections}
      <footer>
        Data from github.com/trending · historical archives from the Internet Archive · not affiliated with GitHub<br />
        <a href="/" style="color:#8a8a8a;">Back to home</a> ·
        <a href="/repo" style="color:#8a8a8a;">All repos</a>
      </footer>
    </div>
  </body>
</html>
`
}

async function main() {
  if (!url || !key) {
    console.warn('[repo-pages] VITE_SUPABASE_URL / KEY not set — skipping.')
    return
  }
  const supabase = createClient(url, key)

  let rankings, repos
  try {
    rankings = await fetchAll(
      supabase,
      'rankings',
      'rank, stars, forks, period_stars, repo_id, snapshots!inner(captured_date, period, lang_filter)',
      (q) => q.eq('snapshots.period', 'daily').eq('snapshots.lang_filter', ''),
    )
    repos = await fetchAll(
      supabase,
      'repos',
      'id, full_name, owner, name, url, description, language, language_color',
    )
  } catch (e) {
    console.warn('[repo-pages] Supabase fetch failed — skipping:', e.message)
    return
  }

  if (!rankings.length || !repos.length) {
    console.warn('[repo-pages] No ranking/repo rows yet — skipping.')
    return
  }

  const repoById = new Map(repos.map((r) => [r.id, r]))
  const seriesByRepo = new Map()
  for (const row of rankings) {
    const date = row.snapshots?.captured_date
    if (!date) continue
    if (!seriesByRepo.has(row.repo_id)) seriesByRepo.set(row.repo_id, [])
    seriesByRepo.get(row.repo_id).push({
      date,
      rank: row.rank,
      stars: row.stars ?? 0,
      forks: row.forks ?? 0,
      periodStars: row.period_stars ?? 0,
    })
  }

  // Build eligible repo objects with computed stats.
  const eligible = []
  for (const [repoId, rawSeries] of seriesByRepo) {
    const repo = repoById.get(repoId)
    if (!repo) continue
    const { owner, name } = repo
    if (!owner || !name || !SLUG_OK.test(owner) || !SLUG_OK.test(name)) continue

    const series = rawSeries.slice().sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    if (series.length < MIN_DAYS) continue

    let peak = series[0]
    for (const s of series) if (s.rank < peak.rank) peak = s
    const stats = {
      days: series.length,
      firstSeen: series[0].date,
      lastSeen: series[series.length - 1].date,
      peakRank: peak.rank,
      peakDate: peak.date,
      latestStars: series[series.length - 1].stars,
      maxStars: Math.max(...series.map((s) => s.stars)),
      maxGain: Math.max(...series.map((s) => s.periodStars)),
    }
    eligible.push({
      owner,
      name,
      fullName: repo.full_name,
      url: repo.url,
      description: repo.description,
      language: repo.language,
      languageColor: repo.language_color,
      series,
      stats,
    })
  }

  // Most-recurring first, then by stars; cap to stay under the file limit.
  eligible.sort((a, b) => b.stats.days - a.stats.days || b.stats.maxStars - a.stats.maxStars)
  const skipped = Math.max(0, eligible.length - MAX_PAGES)
  const pages = eligible.slice(0, MAX_PAGES)

  // Same-language related links (only among repos that have a page).
  const byLang = new Map()
  for (const r of pages) {
    if (!r.language) continue
    if (!byLang.has(r.language)) byLang.set(r.language, [])
    byLang.get(r.language).push(r)
  }

  let written = 0
  for (const r of pages) {
    r.related = (byLang.get(r.language) || []).filter((x) => x !== r).slice(0, 8)
    const dir = path.join(DIST_DIR, 'repo', r.owner, r.name)
    try {
      await mkdir(dir, { recursive: true })
      await writeFile(path.join(dir, 'index.html'), renderRepoPage(r), 'utf8')
      written++
    } catch (e) {
      console.warn(`[repo-pages] failed for ${r.fullName}: ${e.message}`)
    }
  }

  // Hub + sitemap.
  await writeFile(
    path.join(DIST_DIR, 'repo', 'index.html'),
    renderHubPage(pages.slice(0, HUB_LIMIT), pages.length),
    'utf8',
  )
  await writeFile(path.join(DIST_DIR, 'sitemap-repos.xml'), renderSitemap(pages), 'utf8')

  // Hall of Fame — leaderboards drawn from repos that have a page (so every row
  // links to a real /repo page). Top 50 each.
  const board = (rows, value) => rows.map((r) => ({ owner: r.owner, name: r.name, value: value(r) }))
  const boards = [
    {
      title: 'Most days on Trending',
      note: 'Repositories that held a spot on the daily ranking the most days — the truest test of staying power.',
      rows: board(
        [...pages].sort((a, b) => b.stats.days - a.stats.days).slice(0, 50),
        (r) => `${r.stats.days} days`,
      ),
    },
    {
      title: 'Biggest single-day star gain',
      note: 'The largest number of stars a repository picked up on a single archived day.',
      rows: board(
        [...pages].sort((a, b) => b.stats.maxGain - a.stats.maxGain).slice(0, 50),
        (r) => `+${fmtNum(r.stats.maxGain)} in a day`,
      ),
    },
    {
      title: 'Most stars',
      note: 'The highest star count reached while the repository was on the ranking.',
      rows: board(
        [...pages].sort((a, b) => b.stats.maxStars - a.stats.maxStars).slice(0, 50),
        (r) => `${fmtNum(r.stats.maxStars)} stars`,
      ),
    },
  ]
  await mkdir(path.join(DIST_DIR, 'hall-of-fame'), { recursive: true })
  await writeFile(
    path.join(DIST_DIR, 'hall-of-fame', 'index.html'),
    renderHallPage(boards, pages.length),
    'utf8',
  )

  console.log(
    `[repo-pages] Wrote ${written} repo pages (of ${eligible.length} eligible, ` +
      `${skipped} over cap), hub + sitemap-repos.xml.`,
  )
}

main().catch((e) => {
  console.warn('[repo-pages] unexpected error — skipping:', e?.message || e)
})
