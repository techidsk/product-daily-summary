// Build-time RSS feed generator (Path A, static).
//
// Runs after `vite build`. Emits dist/feed.xml — a daily-digest RSS 2.0 feed with
// one <item> per recent archived day (daily / all-languages), each listing that
// day's top repositories. Reads Supabase with the anon key (same env as the other
// build scripts). Two queries total. Fails safe: missing env or a failed fetch
// logs a warning and exits 0 — the build never breaks.

import { writeFile } from 'node:fs/promises'
import { createClient } from '@supabase/supabase-js'

const SITE = 'https://trending.magikaru.com'
const DIST_FEED = new URL('../dist/feed.xml', import.meta.url)
const DAYS = 15 // how many recent days to include as items
const TOP = 10 // repos listed per day

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

async function main() {
  if (!url || !key) {
    console.warn('[feed] VITE_SUPABASE_URL / KEY not set — skipping.')
    return
  }
  const supabase = createClient(url, key)

  let snaps, rows
  try {
    const { data: s, error: e1 } = await supabase
      .from('snapshots')
      .select('id, captured_date')
      .eq('period', 'daily')
      .eq('lang_filter', '')
      .order('captured_date', { ascending: false })
      .limit(DAYS)
    if (e1) throw new Error(e1.message)
    snaps = s || []
    if (!snaps.length) {
      console.warn('[feed] No snapshots yet — skipping.')
      return
    }
    const { data: r, error: e2 } = await supabase
      .from('rankings')
      .select('rank, period_stars, snapshot_id, repos!inner(full_name, url)')
      .in('snapshot_id', snaps.map((x) => x.id))
      .lte('rank', TOP)
      .order('rank')
    if (e2) throw new Error(e2.message)
    rows = r || []
  } catch (e) {
    console.warn('[feed] Supabase fetch failed — skipping:', e.message)
    return
  }

  const bySnap = new Map()
  for (const row of rows) {
    if (!bySnap.has(row.snapshot_id)) bySnap.set(row.snapshot_id, [])
    bySnap.get(row.snapshot_id).push(row)
  }

  const items = snaps
    .map((s) => {
      const list = (bySnap.get(s.id) || []).sort((a, b) => a.rank - b.rank)
      if (!list.length) return ''
      const li = list
        .map(
          (r) =>
            `<li><a href="${esc(r.repos.url)}">${esc(r.repos.full_name)}</a>${
              r.period_stars > 0 ? ` (+${fmtNum(r.period_stars)})` : ''
            }</li>`,
        )
        .join('')
      const html = `<p>Top ${list.length} trending repositories on GitHub for ${esc(
        s.captured_date,
      )}:</p><ol>${li}</ol>`
      const pubDate = new Date(`${s.captured_date}T12:00:00Z`).toUTCString()
      return `    <item>
      <title>GitHub Trending — ${esc(s.captured_date)}</title>
      <link>${SITE}/</link>
      <guid isPermaLink="false">trending-${esc(s.captured_date)}</guid>
      <pubDate>${pubDate}</pubDate>
      <description><![CDATA[${html}]]></description>
    </item>`
    })
    .filter(Boolean)
    .join('\n')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>GitHub Trending — Daily Digest</title>
    <link>${SITE}/</link>
    <description>The hottest open-source repositories trending on GitHub, summarized daily.</description>
    <language>en</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${SITE}/feed.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`
  await writeFile(DIST_FEED, xml, 'utf8')
  console.log(`[feed] Wrote feed.xml with ${snaps.length} daily items.`)
}

main().catch((e) => {
  console.warn('[feed] unexpected error — skipping:', e?.message || e)
})
